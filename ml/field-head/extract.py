"""DINOv2 features and original logits for every PlantDoc photo (and a horizontal flip of the training photos).
Pre-processing matches the kit's preprocess(): short side 256 (bilinear), centre crop 224, ImageNet mean/std.
Usage: extract.py <model.onnx> <dataset dir> <out.npz>"""
import os
import sys
import time

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

model, root, out = sys.argv[1:4]
opts = ort.SessionOptions()
opts.intra_op_num_threads = 8
sess = ort.InferenceSession(model, opts, providers=["CPUExecutionProvider"])
MEAN, STD = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)


def prep(im):
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    s = 256 / min(w, h)
    im = im.resize((max(256, int(w * s)), max(256, int(h * s))), Image.BILINEAR)
    w, h = im.size
    left, top = round((w - 224) / 2), round((h - 224) / 2)
    return im.crop((left, top, left + 224, top + 224))


def run(im):
    x = (np.asarray(im, np.float32) / 255 - MEAN) / STD
    logits, feats = sess.run(["logits", "features"], {"pixel_values": x.transpose(2, 0, 1)[None]})
    return logits[0], feats[0]


rows = {k: [] for k in ("feat", "logit", "label", "split", "name", "flip")}
items = [(split, c, f) for split in ("test", "train") for c in sorted(os.listdir(f"{root}/{split}")) for f in sorted(os.listdir(f"{root}/{split}/{c}"))]
print(len(items), "photos", flush=True)
t0, bad = time.time(), 0
for i, (split, c, f) in enumerate(items):
    try:
        im = prep(Image.open(f"{root}/{split}/{c}/{f}"))
    except Exception as e:
        bad += 1
        print("unreadable", f, type(e).__name__, flush=True)
        continue
    for flip in ([False, True] if split == "train" else [False]):
        lg, ft = run(ImageOps.mirror(im) if flip else im)
        for k, v in zip(rows, (ft, lg, c, split, f, flip)):
            rows[k].append(v)
    if i % 200 == 0:
        print(i, f"{time.time() - t0:.0f}s", flush=True)
np.savez_compressed(out, **{k: np.array(v) for k, v in rows.items()})
print("done", len(rows["feat"]), "rows, unreadable", bad, f"{time.time() - t0:.0f}s", flush=True)
