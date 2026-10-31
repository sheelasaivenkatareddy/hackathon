"""Accuracy figures shown after a scan, from the same test photos as train_head.py. It only measures; it changes nothing in the model.
Usage: make_report.py <features.npz> <field-head.json> <out field-report.json>"""
import json
import sys

import numpy as np

npz, head_path, out = sys.argv[1:4]
d = np.load(npz, allow_pickle=False)
head = json.load(open(head_path))
W, b, T = np.array(head["weights"]), np.array(head["bias"]), head["temperature"]
mask = d["split"].astype(str) == "test"
X, y_txt = d["feat"][mask].astype(np.float64), d["label"][mask].astype(str)
classes = sorted(set(y_txt))
assert len(classes) == len(head["labels"]) and len(y_txt) == head["metrics"]["n"]
y = np.array([classes.index(t) for t in y_txt])
z = (X @ W.T + b) / T
z -= z.max(axis=1, keepdims=True)
P = np.exp(z)
P /= P.sum(axis=1, keepdims=True)
order = np.argsort(-P, axis=1)
hit1, hit3 = order[:, 0] == y, (order[:, :3] == y[:, None]).any(axis=1)
assert round(float(hit1.mean()), 3) == head["metrics"]["fieldTop1"]
s = np.sort(P, axis=1)
levels = {"EXPERT": s[:, -1] < 0.5, "CHECK": (s[:, -1] >= 0.5) & (s[:, -1] - s[:, -2] < 0.2)}
levels["CLEAR"] = ~levels["EXPERT"] & ~levels["CHECK"]
report = {
    "testPhotos": int(len(y)),
    "levels": {k: {"photos": int(m.sum()), "top1": int(hit1[m].sum()), "top3": int(hit3[m].sum())} for k, m in levels.items()},
    "conditions": {head["labels"][i]["name"]: {"photos": int((y == i).sum()), "right": int(hit1[y == i].sum())} for i in range(len(classes))},
}
json.dump(report, open(out, "w"), separators=(",", ":"))
print(json.dumps(report["levels"]))
print({k: f'{v["right"]}/{v["photos"]}' for k, v in list(report["conditions"].items())[:5]})
