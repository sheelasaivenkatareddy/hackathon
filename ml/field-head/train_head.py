"""Field-tuned head on DINOv2 features, trained on PlantDoc. The test split is scored once, after every choice is made.
Usage: train_head.py <features.npz> <dino config.json> <out head.json>"""
import json
import sys

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler

npz, cfg_path, out = sys.argv[1:4]
d = np.load(npz, allow_pickle=False)
X, L, y_txt, split, name, flip = d["feat"].astype(np.float64), d["logit"], d["label"].astype(str), d["split"].astype(str), d["name"].astype(str), d["flip"]
id2label = {int(k): v for k, v in json.load(open(cfg_path))["id2label"].items()}

from train_head_classes import PD_TO_PV  # noqa: E402
untested = sorted(set(y_txt) - set(PD_TO_PV))
print("left out, no test photos:", {u: int(((y_txt == u) & ~flip).sum()) for u in untested})
known = np.isin(y_txt, list(PD_TO_PV))
X, L, y_txt, split, name, flip = X[known], L[known], y_txt[known], split[known], name[known], flip[known]
assert set(y_txt) == set(PD_TO_PV), set(y_txt) ^ set(PD_TO_PV)
assert set(PD_TO_PV.values()) <= set(id2label.values())
classes = sorted(PD_TO_PV)
y = np.array([classes.index(t) for t in y_txt])

te, tr = split == "test", split == "train"
# Leakage guard: drop training photos that also appear in the test split, exactly or almost exactly.
exact = np.isin(name[tr], name[te])
A = X[te] / np.linalg.norm(X[te], axis=1, keepdims=True)
B = X[tr] / np.linalg.norm(X[tr], axis=1, keepdims=True)
near = (B @ A.T).max(axis=1) > 0.995
leaked = set(name[tr][exact | near])
keep = tr & ~np.isin(name, list(leaked))
print(f"train photos {len(set(name[tr]))}, test photos {te.sum()}, removed from train as duplicates of test: {len(leaked)}")


def softmax(z, axis=1):
    z = z - z.max(axis=axis, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=axis, keepdims=True)


def fit(Xa, ya, C):
    sc = StandardScaler().fit(Xa)
    m = LogisticRegression(C=C, max_iter=2000, solver="lbfgs").fit(sc.transform(Xa), ya)
    return sc, m


# ---- choose C and the temperature on the training photos only (folds keep a photo and its flip together)
Xk, yk, gk, fk = X[keep], y[keep], name[keep], flip[keep]
best = None
for C in (0.001, 0.003, 0.01, 0.03, 0.1):
    oof = np.zeros((len(yk), len(classes)))
    for a, b in StratifiedGroupKFold(5, shuffle=True, random_state=0).split(Xk, yk, gk):
        sc, m = fit(Xk[a], yk[a], C)
        oof[b] = m.decision_function(sc.transform(Xk[b]))
    v = ~fk
    acc = (oof[v].argmax(1) == yk[v]).mean()
    print(f"C={C}: cross-validated field accuracy {acc:.3f}")
    if best is None or acc > best[0]:
        best = (acc, C, oof.copy())
cv_acc, C, oof = best
v = ~fk


def nll(T):
    p = softmax(oof[v] / T)
    return -np.log(p[np.arange(v.sum()), yk[v]] + 1e-12).mean()


Ts = np.exp(np.linspace(np.log(0.3), np.log(5), 200))
T = float(Ts[np.argmin([nll(t) for t in Ts])])
print(f"chosen C={C}, temperature={T:.3f}, cross-validated accuracy {cv_acc:.3f}")

# ---- final fit, then the single look at the test split
sc, m = fit(Xk, yk, C)
W = m.coef_ / sc.scale_
b = m.intercept_ - (W * sc.mean_).sum(axis=1)
Xt, yt = X[te], y[te]
P = softmax((Xt @ W.T + b) / T)
assert np.allclose(Xt @ W.T + b, m.decision_function(sc.transform(Xt)))


def report(P, yt, title):
    order = np.argsort(-P, axis=1)
    top1, top3 = (order[:, 0] == yt).mean(), (order[:, :3] == yt[:, None]).any(1).mean()
    f1 = f1_score(yt, order[:, 0], average="macro")
    conf = P.max(1)
    bins = np.minimum((conf * 10).astype(int), 9)
    ece = sum(abs((order[:, 0] == yt)[bins == i].mean() - conf[bins == i].mean()) * (bins == i).mean() for i in range(10) if (bins == i).any())
    print(f"{title}: top-1 {top1:.3f}, top-3 {top3:.3f}, macro F1 {f1:.3f}, ECE {ece:.3f}")
    return top1, top3, f1, ece


pv_ids = [next(i for i, l in id2label.items() if l == PD_TO_PV[c]) for c in classes]
base_all = softmax(L[te])
base_pred = np.array([id2label[i] for i in base_all.argmax(1)])
base_top1 = (base_pred == np.array([PD_TO_PV[classes[i]] for i in yt])).mean()
print(f"\nBASELINE original model, all 38 classes, field test: top-1 {base_top1:.3f}, mean confidence {base_all.max(1).mean():.3f}")
report(softmax(L[te][:, pv_ids]), yt, "BASELINE restricted to the same 27 classes")
top1, top3, f1, ece = report(P, yt, "FIELD-TUNED")

rng = np.random.default_rng(0)
hits = P.argmax(1) == yt
boot = [hits[rng.integers(0, len(hits), len(hits))].mean() for _ in range(5000)]
lo, hi = np.percentile(boot, [2.5, 97.5])
print(f"95% interval for top-1: {lo:.3f} to {hi:.3f} (n={len(yt)})")

# Answer levels, using the kit's thresholds
s = np.sort(P, axis=1)
expert, check = s[:, -1] < 0.5, (s[:, -1] >= 0.5) & (s[:, -1] - s[:, -2] < 0.2)
clear = ~expert & ~check
for nm, mask in (("CLEAR", clear), ("CHECK", check), ("EXPERT", expert)):
    print(f"  {nm}: {mask.mean() * 100:.0f}% of photos, top-1 right {hits[mask].mean() * 100 if mask.any() else 0:.0f}%, top-3 right {((np.argsort(-P, 1)[:, :3] == yt[:, None]).any(1)[mask].mean()) * 100 if mask.any() else 0:.0f}%")
tom = np.array([classes[i].lower().startswith("tomato") for i in yt])
print(f"  tomato only: top-1 {hits[tom].mean():.3f} (n={tom.sum()})")
for i, c in enumerate(classes):
    mk = yt == i
    print(f"    {c:32s} {hits[mk].sum()}/{mk.sum()}")


def nice(pv):
    plant, cond = pv.split("___")
    plant = {"Pepper,_bell": "Bell pepper", "Cherry_(including_sour)": "Cherry", "Corn_(maize)": "Corn"}.get(plant, plant)
    cond = {"healthy": "Healthy", "Apple_scab": "Apple scab", "Cedar_apple_rust": "Cedar apple rust", "Common_rust_": "Common rust", "Cercospora_leaf_spot Gray_leaf_spot": "Gray leaf spot",
            "Northern_Leaf_Blight": "Northern leaf blight", "Leaf_Mold": "Leaf mold", "Tomato_mosaic_virus": "Tomato mosaic virus", "Tomato_Yellow_Leaf_Curl_Virus": "Tomato yellow leaf curl virus"}.get(cond, cond.replace("_", " "))
    # Tomato keeps the plain kit names, so the risk rules and translations still match.
    return plant, cond if plant == "Tomato" else f"{plant}: {cond}"


labels = [{"index": i, "label": PD_TO_PV[c], "plant": nice(PD_TO_PV[c])[0], "name": nice(PD_TO_PV[c])[1]} for i, c in enumerate(classes)]
json.dump({
    "version": "dinov2-small-int8 + PlantDoc head", "temperature": round(T, 4), "labels": labels,
    "weights": [[float(f"{v:.5g}") for v in row] for row in W], "bias": [float(f"{v:.5g}") for v in b],
    "metrics": {"fieldTop1": round(float(top1), 3), "fieldTop3": round(float(top3), 3), "fieldMacroF1": round(float(f1), 3), "ece": round(float(ece), 3), "ci": [round(float(lo), 3), round(float(hi), 3)], "n": int(len(yt)), "baselineTop1": round(float(base_top1), 3), "trainPhotos": int((~fk).sum())},
}, open(out, "w"), separators=(",", ":"))
print("wrote", out)
