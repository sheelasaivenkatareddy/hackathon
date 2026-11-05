"""Field head trained on PlantDoc (field photos) plus a tomato set laid out like PlantVillage (clean close-ups).
Settings are chosen by cross-validation on the PlantDoc training photos only, so the extra close-ups cannot buy
lab accuracy at the cost of field accuracy. Each test split (PlantDoc test, close-up test) is scored once at the end.
Usage: train_head_mixed.py <plantdoc features.npz> <closeup features.npz> <current head.json> <out head.json>"""
import json
import sys

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler

pd_npz, pv_npz, cur_path, out = sys.argv[1:5]

# Same class list and names as train_head.py (PlantDoc folder name -> PlantVillage label)
from train_head_classes import PD_TO_PV  # noqa: E402

PV_TO_PD = {
    "Tomato___Bacterial_spot": "Tomato leaf bacterial spot", "Tomato___Early_blight": "Tomato Early blight leaf",
    "Tomato___Late_blight": "Tomato leaf late blight", "Tomato___Leaf_Mold": "Tomato mold leaf",
    "Tomato___Septoria_leaf_spot": "Tomato Septoria leaf spot", "Tomato___healthy": "Tomato leaf",
}
classes = sorted(PD_TO_PV)


def load(path, source):
    d = np.load(path, allow_pickle=False)
    y_txt = d["label"].astype(str)
    if source == "pv":
        y_txt = np.array([PV_TO_PD.get(t, "") for t in y_txt])
    keep = np.isin(y_txt, classes)
    split = np.char.add(f"{source}_", d["split"].astype(str))[keep]
    name = np.char.add(f"{source}_", d["name"].astype(str))[keep]
    return d["feat"].astype(np.float64)[keep], np.array([classes.index(t) for t in y_txt[keep]]), split, name, d["flip"][keep]


Xp, yp, sp, np_, fp = load(pd_npz, "pd")
Xv, yv, sv, nv, fv = load(pv_npz, "pv")
X, y, split, name, flip = np.vstack([Xp, Xv]), np.concatenate([yp, yv]), np.concatenate([sp, sv]), np.concatenate([np_, nv]), np.concatenate([fp, fv])
is_pd = np.char.startswith(split, "pd_")
te_pd, te_pv = split == "pd_test", split == "pv_test"
tr = (split == "pd_train") | (split == "pv_train")

# Leakage guard: drop training photos that are the same as, or almost the same as, any test photo.
T_all = X[te_pd | te_pv]
A = T_all / np.linalg.norm(T_all, axis=1, keepdims=True)
B = X[tr] / np.linalg.norm(X[tr], axis=1, keepdims=True)
near = (B @ A.T).max(axis=1) > 0.995
leaked = set(name[tr][near])
keep = tr & ~np.isin(name, list(leaked))
print(f"train photos: field {len(set(name[keep & is_pd]))}, close-up {len(set(name[keep & ~is_pd]))}; removed as near-duplicates of test: {len(leaked)}")


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def fit(Xa, ya, C, wa=None):
    sc = StandardScaler().fit(Xa)
    return sc, LogisticRegression(C=C, max_iter=3000, solver="lbfgs").fit(sc.transform(Xa), ya, sample_weight=wa)


Xk, yk, gk, fk, pdk = X[keep], y[keep], name[keep], flip[keep], is_pd[keep]
# Close-up photos get a weight below 1 so they cannot crowd out the field photos. The weight and C are chosen
# on the training photos only: best cross-validated FIELD accuracy, with close-up accuracy at least 0.85.
best = None
for w_pv in (0.15, 0.3, 0.6, 1.0):
    wk = np.where(pdk, 1.0, w_pv)
    for C in (0.003, 0.01, 0.03):
        oof = np.zeros((len(yk), len(classes)))
        for a, b in StratifiedGroupKFold(5, shuffle=True, random_state=0).split(Xk, yk, gk):
            sc, m = fit(Xk[a], yk[a], C, wk[a])
            oof[b] = m.decision_function(sc.transform(Xk[b]))
        v = ~fk
        acc_field = (oof[v & pdk].argmax(1) == yk[v & pdk]).mean()
        acc_close = (oof[v & ~pdk].argmax(1) == yk[v & ~pdk]).mean()
        print(f"weight={w_pv} C={C}: cross-validated field {acc_field:.3f}, close-up {acc_close:.3f}")
        if acc_close >= 0.85 and (best is None or acc_field > best[0]):
            best = (acc_field, C, oof.copy(), w_pv)
cv_field, C, oof, W_PV = best
print(f"chosen close-up weight {W_PV}")
v = ~fk & pdk  # temperature is set on field photos, where confidence matters most


def nll(T):
    p = softmax(oof[v] / T)
    return -np.log(p[np.arange(v.sum()), yk[v]] + 1e-12).mean()


Ts = np.exp(np.linspace(np.log(0.3), np.log(5), 200))
T = float(Ts[np.argmin([nll(t) for t in Ts])])
print(f"chosen C={C}, temperature={T:.3f}")

sc, m = fit(Xk, yk, C, np.where(pdk, 1.0, W_PV))
W = m.coef_ / sc.scale_
b = m.intercept_ - (W * sc.mean_).sum(axis=1)


def score(P, yt, title):
    order = np.argsort(-P, axis=1)
    top1, top3 = (order[:, 0] == yt).mean(), (order[:, :3] == yt[:, None]).any(1).mean()
    f1 = f1_score(yt, order[:, 0], average="macro", labels=np.unique(yt))
    conf = P.max(1)
    bins = np.minimum((conf * 10).astype(int), 9)
    ece = sum(abs((order[:, 0] == yt)[bins == i].mean() - conf[bins == i].mean()) * (bins == i).mean() for i in range(10) if (bins == i).any())
    print(f"  {title}: top-1 {top1:.3f}, top-3 {top3:.3f}, macro F1 {f1:.3f}, ECE {ece:.3f} (n={len(yt)})")
    return float(top1), float(top3), float(f1), float(ece)


cur = json.load(open(cur_path))
assert [l["label"] for l in cur["labels"]] == [PD_TO_PV[c] for c in classes], "current head uses a different class order"
Wc, bc, Tc = np.array(cur["weights"]), np.array(cur["bias"]), cur["temperature"]
print("\nCURRENT head (field only):")
old_pd = score(softmax((X[te_pd] @ Wc.T + bc) / Tc), y[te_pd], "field test (PlantDoc)")
old_pv = score(softmax((X[te_pv] @ Wc.T + bc) / Tc), y[te_pv], "close-up test (your tomato set)")
print("NEW head (field + your tomato set):")
P_pd = softmax((X[te_pd] @ W.T + b) / T)
new_pd = score(P_pd, y[te_pd], "field test (PlantDoc)")
new_pv = score(softmax((X[te_pv] @ W.T + b) / T), y[te_pv], "close-up test (your tomato set)")
tom = np.array([classes[i].lower().startswith("tomato") for i in y[te_pd]])
print(f"  field tomato only: current {((X[te_pd] @ Wc.T + bc).argmax(1) == y[te_pd])[tom].mean():.3f} -> new {(P_pd.argmax(1) == y[te_pd])[tom].mean():.3f} (n={tom.sum()})")

hits = P_pd.argmax(1) == y[te_pd]
rng = np.random.default_rng(0)
lo, hi = np.percentile([hits[rng.integers(0, len(hits), len(hits))].mean() for _ in range(5000)], [2.5, 97.5])

labels = cur["labels"]
json.dump({
    "version": "dinov2-small-int8 + PlantDoc + PlantVillage-tomato head", "temperature": round(T, 4), "labels": labels,
    "weights": [[float(f"{x:.5g}") for x in row] for row in W], "bias": [float(f"{x:.5g}") for x in b],
    "metrics": {"fieldTop1": round(new_pd[0], 3), "fieldTop3": round(new_pd[1], 3), "fieldMacroF1": round(new_pd[2], 3), "ece": round(new_pd[3], 3),
                "ci": [round(float(lo), 3), round(float(hi), 3)], "n": int(te_pd.sum()), "baselineTop1": cur["metrics"].get("baselineTop1"),
                "trainPhotos": int((~fk).sum()), "closeupTomatoTop1": round(new_pv[0], 3), "closeupTomatoN": int(te_pv.sum())},
}, open(out, "w"), separators=(",", ":"))
print("wrote", out)
print(f"DECISION DATA field {old_pd[0]:.3f}->{new_pd[0]:.3f}  close-up {old_pv[0]:.3f}->{new_pv[0]:.3f}")
