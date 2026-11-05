"""Accuracy panel data shown after a scan: accuracy, top-3, per-class recall / precision / F1 and confusion
matrices for the tomato diseases, on both test sets (PlantDoc field photos and the close-up tomato set).
It only measures; it changes nothing in the model.
Usage: make_accuracy.py <plantdoc features.npz> <closeup features.npz> <new head.json> <old head.json> <out accuracy.json>"""
import json
import sys

import numpy as np

from train_head_classes import PD_TO_PV

pd_npz, pv_npz, new_path, old_path, out = sys.argv[1:6]
classes = sorted(PD_TO_PV)
PV_TO_PD = {"Tomato___Bacterial_spot": "Tomato leaf bacterial spot", "Tomato___Early_blight": "Tomato Early blight leaf",
            "Tomato___Late_blight": "Tomato leaf late blight", "Tomato___Leaf_Mold": "Tomato mold leaf",
            "Tomato___Septoria_leaf_spot": "Tomato Septoria leaf spot", "Tomato___healthy": "Tomato leaf"}
TOMATO = ["Tomato leaf bacterial spot", "Tomato Early blight leaf", "Tomato leaf late blight", "Tomato mold leaf", "Tomato Septoria leaf spot", "Tomato leaf"]
SHORT = {"Tomato leaf bacterial spot": "Bacterial spot", "Tomato Early blight leaf": "Early blight", "Tomato leaf late blight": "Late blight",
         "Tomato mold leaf": "Leaf mold", "Tomato Septoria leaf spot": "Septoria leaf spot", "Tomato leaf": "Healthy"}


def test_set(path, mapping=None):
    d = np.load(path, allow_pickle=False)
    y_txt = d["label"].astype(str)
    if mapping:
        y_txt = np.array([mapping.get(t, "") for t in y_txt])
    m = (d["split"].astype(str) == "test") & np.isin(y_txt, classes)
    return d["feat"][m].astype(np.float64), np.array([classes.index(t) for t in y_txt[m]])


def probs(head, X):
    W, b, T = np.array(head["weights"]), np.array(head["bias"]), head["temperature"]
    z = (X @ W.T + b) / T
    z -= z.max(axis=1, keepdims=True)
    P = np.exp(z)
    return P / P.sum(axis=1, keepdims=True)


def measure(head, X, y, only=None):
    P = probs(head, X)
    order = np.argsort(-P, axis=1)
    pred = order[:, 0]
    top1, top3 = float((pred == y).mean()), float((order[:, :3] == y[:, None]).any(1).mean())
    rng = np.random.default_rng(0)
    hits = pred == y
    lo, hi = np.percentile([hits[rng.integers(0, len(y), len(y))].mean() for _ in range(3000)], [2.5, 97.5])
    names = only or [classes[i] for i in sorted(set(y))]
    per = []
    for c in names:
        i = classes.index(c)
        tp = int(((pred == i) & (y == i)).sum()); n_true = int((y == i).sum()); n_pred = int((pred == i).sum())
        rec = tp / n_true if n_true else 0.0
        prec = tp / n_pred if n_pred else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        per.append({"name": SHORT.get(c, c), "photos": n_true, "recall": round(rec, 3), "precision": round(prec, 3), "f1": round(f1, 3)})
    out = {"n": int(len(y)), "accuracy": round(top1, 3), "top3": round(top3, 3), "ci": [round(float(lo), 3), round(float(hi), 3)],
           "macroF1": round(float(np.mean([p["f1"] for p in per])), 3), "perClass": per}
    # Confusion matrix for the tomato diseases: rows = true, columns = predicted; anything else counts as "Other".
    tom_idx = [classes.index(c) for c in TOMATO]
    rows = [i for i in tom_idx if (y == i).any()]
    if rows:
        cols = tom_idx + [-1]
        M = [[int(((y == r) & ((pred == c) if c >= 0 else ~np.isin(pred, tom_idx))).sum()) for c in cols] for r in rows]
        out["confusion"] = {"labels": [SHORT[classes[r]] for r in rows], "columns": [SHORT[classes[c]] for c in tom_idx] + ["Other crop / disease"], "matrix": M}
    return out


new, old = json.load(open(new_path)), json.load(open(old_path))
Xf, yf = test_set(pd_npz)
Xc, yc = test_set(pv_npz, PV_TO_PD)
tom_f = np.isin(yf, [classes.index(c) for c in TOMATO])
report = {
    "model": new["version"],
    "note": "Each test set was scored once with the final model. Field = PlantDoc test photos (real farms, mixed backgrounds). Close-up = held-out photos from the tomato dataset (one leaf, plain background).",
    "field": measure(new, Xf, yf),
    "fieldTomato": measure(new, Xf[tom_f], yf[tom_f], TOMATO),
    "closeup": measure(new, Xc, yc, TOMATO),
    "before": {"field": round(float((probs(old, Xf).argmax(1) == yf).mean()), 3), "closeup": round(float((probs(old, Xc).argmax(1) == yc).mean()), 3)},
}
json.dump(report, open(out, "w"), separators=(",", ":"))
print("field", report["field"]["accuracy"], "field tomato", report["fieldTomato"]["accuracy"], "close-up", report["closeup"]["accuracy"], "| before", report["before"])
for p in report["closeup"]["perClass"]:
    print(f'  close-up {p["name"]:20s} recall {p["recall"]:.2f} precision {p["precision"]:.2f} (n={p["photos"]})')
