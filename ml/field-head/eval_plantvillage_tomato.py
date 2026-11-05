"""Scores the on-phone AI (DINOv2 features + the field head in public/model/field-head.json) on a folder of tomato
leaf photos laid out as <dir>/<split>/<Tomato___Class>/<photo>.jpg (the PlantVillage tomato set).
Reads photos only; nothing in the dataset is executed. Usage: eval_plantvillage_tomato.py <dataset dir> <split> [max per class]"""
import json
import os
import sys
import time
from collections import defaultdict

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

root, split = sys.argv[1], sys.argv[2]
cap = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
here = os.path.dirname(os.path.abspath(__file__))
model = os.path.join(here, "..", "..", "public", "model", "field-dino-int8.onnx")
head = json.load(open(os.path.join(here, "..", "..", "public", "model", "field-head.json")))
W, b, T = np.array(head["weights"]), np.array(head["bias"]), head["temperature"]
names = [l["label"] for l in head["labels"]]  # e.g. Tomato___Early_blight

MEAN, STD = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)
opts = ort.SessionOptions(); opts.intra_op_num_threads = 8
sess = ort.InferenceSession(model, opts, providers=["CPUExecutionProvider"])


def prep(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = im.size
    s = 256 / min(w, h)
    im = im.resize((max(256, int(w * s)), max(256, int(h * s))), Image.BILINEAR)
    w, h = im.size
    l, t = round((w - 224) / 2), round((h - 224) / 2)
    return ((np.asarray(im.crop((l, t, l + 224, t + 224)), np.float32) / 255 - MEAN) / STD).transpose(2, 0, 1)[None]


classes = sorted(os.listdir(f"{root}/{split}"))
truth_ids = {c: names.index(c) for c in classes if c in names}
print("classes:", classes, "| in the head:", len(truth_ids), flush=True)
right, top3, tot = defaultdict(int), defaultdict(int), defaultdict(int)
conf_ok, conf_bad, levels = [], [], defaultdict(lambda: [0, 0])
confusion = defaultdict(lambda: defaultdict(int))
t0 = time.time()
for c in classes:
    files = sorted(os.listdir(f"{root}/{split}/{c}"))[:cap]
    for f in files:
        _, feats = sess.run(["logits", "features"], {"pixel_values": prep(f"{root}/{split}/{c}/{f}")})
        z = (feats[0] @ W.T + b) / T
        p = np.exp(z - z.max()); p /= p.sum()
        order = np.argsort(-p)
        tot[c] += 1
        ok = names[order[0]] == c
        right[c] += ok
        top3[c] += c in [names[i] for i in order[:3]]
        confusion[c][names[order[0]]] += 1
        (conf_ok if ok else conf_bad).append(p[order[0]])
        lvl = "EXPERT" if p[order[0]] < 0.5 else "CHECK" if p[order[0]] - p[order[1]] < 0.2 else "CLEAR"
        levels[lvl][0] += 1; levels[lvl][1] += ok
    print(f"  {c}: {right[c]}/{tot[c]} right so far, {time.time() - t0:.0f}s", flush=True)

n, r = sum(tot.values()), sum(right.values())
print(f"\nON-PHONE AI ON YOUR TOMATO {split.upper()} PHOTOS: top-1 {r}/{n} = {r / n:.1%}, top-3 {sum(top3.values()) / n:.1%}")
for c in classes:
    wrong = {k.replace('Tomato___', ''): v for k, v in sorted(confusion[c].items(), key=lambda kv: -kv[1]) if k != c}
    print(f"  {c:32s} {right[c]:4d}/{tot[c]:<4d} {right[c] / tot[c]:6.1%}   mistaken for: {dict(list(wrong.items())[:3])}")
for k, (cnt, ok) in levels.items():
    print(f"  answer level {k}: {cnt} photos ({cnt / n:.0%}), right {ok / max(cnt, 1):.0%}")
print(f"  mean confidence when right {np.mean(conf_ok):.2f}, when wrong {np.mean(conf_bad) if conf_bad else 0:.2f}")
