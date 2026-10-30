"""
Train the Patra Lens tomato model and export it for the website.

  python train_patra.py --data data --out runs/patra                 # GPU recommended (Google Colab T4 is fine)
  python train_patra.py --data data --out runs/patra --arch small    # smaller, faster model (about 6 MB)

What it does
  1. Fine-tunes MobileNetV3 (ImageNet weights) on PlantVillage + PlantDoc tomato photos.
     Field photos (PlantDoc) are sampled more often, because the app is used in the field.
  2. Keeps the epoch with the best validation macro-F1 (average of lab and field).
  3. Calibrates confidence with temperature scaling on the validation set.
  4. Measures the metrics promised in the PPT: accuracy and macro-F1 on lab and field tests,
     the lab-to-field gap, calibration error (ECE) and "not sure" (abstain) quality.
  5. Exports patra.onnx with two outputs: logits [1,10] and cam [1,10,7,7].
     cam is the exact Grad-CAM of the last convolution block, computed inside the model,
     so the website can draw "Where the model looked" on the phone without a server.

Output folder: best.pt, patra.onnx, labels.json, calibration.json, metrics.json, METRICS.md
Copy patra.onnx, labels.json and calibration.json into the website's public/model/ folder.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageOps
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

CLASSES = [
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]
NAMES = ["Bacterial spot", "Early blight", "Late blight", "Leaf mold", "Septoria leaf spot",
         "Spider mite damage", "Target spot", "Tomato yellow leaf curl virus", "Tomato mosaic virus", "Healthy"]
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
ABSTAIN_BELOW = 0.50  # same threshold as the website's EXPERT level


# ----------------------------------------------------------------------------- data
class FolderSet(Dataset):
    def __init__(self, root: Path, tf):
        self.items = []
        for idx, cls in enumerate(CLASSES):
            d = root / cls
            if d.exists():
                for p in sorted(d.iterdir()):
                    if p.suffix.lower() in IMG_EXT:
                        self.items.append((p, idx, "field" if p.name.startswith("pdoc__") else "lab"))
        self.tf = tf

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        p, y, src = self.items[i]
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        return self.tf(im), y, int(src == "field")


def make_transforms(size=224):
    train = transforms.Compose([
        transforms.RandomResizedCrop(size, scale=(0.5, 1.0), ratio=(0.75, 1.33)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(0.2),
        transforms.RandomRotation(20),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.03),
        transforms.RandomApply([transforms.GaussianBlur(5, sigma=(0.1, 2.0))], p=0.2),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    evaluate = transforms.Compose([  # must match the website: short side 256, centre crop 224
        transforms.Resize(256),
        transforms.CenterCrop(size),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    return train, evaluate


# ----------------------------------------------------------------------------- model
def build_model(arch: str, pretrained: bool) -> nn.Module:
    if arch == "large":
        w = models.MobileNet_V3_Large_Weights.IMAGENET1K_V2 if pretrained else None
        m = models.mobilenet_v3_large(weights=w)
    else:
        w = models.MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
        m = models.mobilenet_v3_small(weights=w)
    m.classifier[3] = nn.Linear(m.classifier[3].in_features, len(CLASSES))
    return m


class PatraExport(nn.Module):
    """logits and exact Grad-CAM (last conv block) for every class, in one forward pass.

    torchvision MobileNetV3 head: z = mean(A) -> u = W1 z + b1 -> h = hardswish(u) -> logits = W2 h + b2.
    d logit_k / d A[c,i,j] = (1/hw) * sum_h W2[k,h] * hardswish'(u_h) * W1[h,c], the same for every (i,j),
    so Grad-CAM weights alpha[k,c] are that value and cam_k = relu(sum_c alpha[k,c] * A[c]).
    """

    def __init__(self, m: nn.Module):
        super().__init__()
        self.features = m.features
        fc1, act, _drop, fc2 = m.classifier
        assert isinstance(act, nn.Hardswish), "unexpected MobileNetV3 head"
        self.fc1, self.fc2 = fc1, fc2

    def forward(self, x):
        a = self.features(x)                                   # B,C,h,w
        b, c, hh, ww = a.shape
        z = a.mean(dim=(2, 3))                                 # B,C
        u = self.fc1(z)                                        # B,H
        h = u * torch.clamp(u + 3.0, 0.0, 6.0) / 6.0           # hardswish
        logits = self.fc2(h)                                   # B,K
        dh = torch.where(u < -3.0, torch.zeros_like(u),
                         torch.where(u > 3.0, torch.ones_like(u), (2.0 * u + 3.0) / 6.0))
        g = torch.matmul(self.fc2.weight.unsqueeze(0) * dh.unsqueeze(1), self.fc1.weight)  # B,K,C
        alpha = g / float(hh * ww)
        cam = torch.relu(torch.matmul(alpha, a.flatten(2))).reshape(b, -1, hh, ww)          # B,K,h,w
        return logits, cam


# ----------------------------------------------------------------------------- metrics
def macro_f1(y, p, labels):
    f1s = []
    for k in labels:
        tp = int(((p == k) & (y == k)).sum()); fp = int(((p == k) & (y != k)).sum()); fn = int(((p != k) & (y == k)).sum())
        f1s.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return float(np.mean(f1s)) if f1s else float("nan")


def ece(probs, y, bins=15):
    conf = probs.max(1); pred = probs.argmax(1); acc = (pred == y).astype(float)
    edges = np.linspace(0, 1, bins + 1); e = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            e += m.mean() * abs(acc[m].mean() - conf[m].mean())
    return float(e)


def summary(logits, y, temperature=1.0):
    if len(y) == 0:
        return None
    probs = torch.softmax(torch.from_numpy(logits) / temperature, 1).numpy()
    pred = probs.argmax(1); conf = probs.max(1)
    present = sorted(set(y.tolist()))
    answered = conf >= ABSTAIN_BELOW
    per_class = {NAMES[k]: round(macro_f1(y, pred, [k]), 3) for k in present}
    cm = np.zeros((len(CLASSES), len(CLASSES)), int)
    for t, q in zip(y, pred):
        cm[t, q] += 1
    return {
        "n": int(len(y)),
        "accuracy": round(float((pred == y).mean()), 4),
        "macro_f1": round(macro_f1(y, pred, present), 4),
        "ece": round(ece(probs, y), 4),
        "answered_share": round(float(answered.mean()), 4),
        "accuracy_on_answered": round(float((pred[answered] == y[answered]).mean()), 4) if answered.any() else None,
        "f1_per_class": per_class,
        "confusion": cm.tolist(),
    }


@torch.no_grad()
def predict(model, loader, device):
    model.eval(); out, ys, srcs = [], [], []
    for x, y, s in loader:
        out.append(model(x.to(device)).float().cpu()); ys.append(y); srcs.append(s)
    if not out:
        return np.zeros((0, len(CLASSES)), np.float32), np.zeros(0, int), np.zeros(0, int)
    return torch.cat(out).numpy(), torch.cat(ys).numpy(), torch.cat(srcs).numpy()


def fit_temperature(logits, y):
    lg, yt = torch.from_numpy(logits), torch.from_numpy(y).long()
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad(); loss = F.cross_entropy(lg / log_t.exp(), yt); loss.backward(); return loss
    opt.step(closure)
    return float(log_t.exp().item())


# ----------------------------------------------------------------------------- export
def check_cam(model, x):
    """Compare the built-in CAM with autograd Grad-CAM on the same input."""
    exp = PatraExport(model).eval()
    with torch.no_grad():
        logits, cam = exp(x)
    a = model.features(x).detach().requires_grad_(True)
    head = lambda t: model.classifier(torch.flatten(model.avgpool(t), 1))
    lg = head(a)
    worst = 0.0
    for k in range(lg.shape[1]):
        g, = torch.autograd.grad(lg[0, k], a, retain_graph=True)
        ref = torch.relu((g.mean(dim=(2, 3), keepdim=True) * a).sum(1))[0]
        diff = (ref - cam[0, k]).abs().max().item() / (ref.abs().max().item() + 1e-8)
        worst = max(worst, diff)
    assert torch.allclose(logits, lg, atol=1e-4, rtol=1e-4), "export logits differ from the model"
    return worst


def export_onnx(model, path: Path, size=224):
    exp = PatraExport(model).eval().cpu()
    dummy = torch.randn(1, 3, size, size)
    kw = dict(input_names=["input"], output_names=["logits", "cam"], opset_version=18)
    try:
        torch.onnx.export(exp, (dummy,), str(path), dynamo=True, external_data=False, **kw)
    except TypeError:  # older PyTorch without the dynamo/external_data arguments
        torch.onnx.export(exp, (dummy,), str(path), **kw)
    return exp


def verify_onnx(exp, path: Path, x: torch.Tensor):
    import onnx
    import onnxruntime as ort
    onnx.checker.check_model(str(path))
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    names = [o.name for o in sess.get_outputs()]
    lo, co = sess.run(["logits", "cam"], {"input": x.numpy().astype(np.float32)})
    with torch.no_grad():
        lt, ct = exp(x)
    dl = float(np.abs(lo - lt.numpy()).max()); dc = float(np.abs(co - ct.numpy()).max() / (np.abs(ct.numpy()).max() + 1e-8))
    return names, list(lo.shape), list(co.shape), dl, dc


# ----------------------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="runs/patra")
    ap.add_argument("--arch", choices=["large", "small"], default="large")
    ap.add_argument("--epochs", type=int, default=12, help="0 = skip training (only for testing the export)")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--head-epochs", type=int, default=1, help="epochs with the backbone frozen first")
    ap.add_argument("--field-weight", type=float, default=3.0, help="how much more often to sample field photos")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-pretrained", action="store_true", help="random start (only for offline testing)")
    args = ap.parse_args(argv)

    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    data, out = Path(args.data), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    tf_train, tf_eval = make_transforms()
    sets = {s: FolderSet(data / s, tf_train if s == "train" else tf_eval) for s in ("train", "val", "test_lab", "test_field")}
    for s, d in sets.items():
        c = Counter(src for _, _, src in d.items)
        print(f"{s:10s} {len(d):6d} photos  (lab {c['lab']}, field {c['field']})")
    if len(sets["train"]) == 0:
        sys.exit("No training photos found. Run prepare_data.py first.")

    model = build_model(args.arch, not args.no_pretrained).to(device)
    loaders = {s: DataLoader(d, batch_size=args.batch, shuffle=False, num_workers=args.workers)
               for s, d in sets.items() if s != "train"}
    best_path = out / "best.pt"

    if args.epochs > 0:
        cls_count = Counter(y for _, y, _ in sets["train"].items)
        weights = [(1.0 / cls_count[y]) * (args.field_weight if src == "field" else 1.0) for _, y, src in sets["train"].items]
        sampler = WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)
        train_loader = DataLoader(sets["train"], batch_size=args.batch, sampler=sampler,
                                  num_workers=args.workers, drop_last=len(sets["train"]) > args.batch)
        criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
        use_amp = device == "cuda"
        scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
        best = -1.0
        for epoch in range(args.epochs):
            frozen = epoch < args.head_epochs
            for p in model.features.parameters():
                p.requires_grad = not frozen
            if epoch in (0, args.head_epochs):
                params = [p for p in model.parameters() if p.requires_grad]
                lr = args.lr * (3 if frozen else 1)
                opt = torch.optim.AdamW(params, lr=lr, weight_decay=1e-4)
                steps = max(1, (args.epochs - epoch) * len(train_loader)) if not frozen else max(1, len(train_loader))
                sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps, pct_start=0.1)
            model.train(); t0 = time.time(); loss_sum = n = 0
            for x, y, _ in train_loader:
                x, y = x.to(device), y.to(device)
                opt.zero_grad(set_to_none=True)
                with torch.autocast(device_type="cuda", enabled=use_amp):
                    loss = criterion(model(x), y)
                scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
                if sched.last_epoch + 1 < sched.total_steps:
                    sched.step()
                loss_sum += loss.item() * len(y); n += len(y)
            lv, yv, sv = predict(model, loaders["val"], device)
            f_lab = macro_f1(yv[sv == 0], lv[sv == 0].argmax(1), sorted(set(yv[sv == 0].tolist()))) if (sv == 0).any() else float("nan")
            f_field = macro_f1(yv[sv == 1], lv[sv == 1].argmax(1), sorted(set(yv[sv == 1].tolist()))) if (sv == 1).any() else float("nan")
            score = float(np.nanmean([f_lab, f_field]))
            print(f"epoch {epoch + 1:2d}/{args.epochs}  loss {loss_sum / max(n, 1):.4f}  val F1 lab {f_lab:.3f} field {f_field:.3f}"
                  f"  {'(head only) ' if frozen else ''}{time.time() - t0:.0f}s")
            if score > best:
                best = score; torch.save({"arch": args.arch, "state_dict": model.state_dict()}, best_path)
    if best_path.exists():
        model.load_state_dict(torch.load(best_path, map_location=device)["state_dict"])
    else:
        torch.save({"arch": args.arch, "state_dict": model.state_dict()}, best_path)

    # calibration and metrics
    lv, yv, _ = predict(model, loaders["val"], device)
    temperature = fit_temperature(lv, yv) if len(yv) else 1.0
    metrics = {"arch": args.arch, "temperature": round(temperature, 4), "abstain_below": ABSTAIN_BELOW}
    for s in ("test_lab", "test_field"):
        lg, y, _ = predict(model, loaders[s], device)
        metrics[s] = {"uncalibrated": summary(lg, y, 1.0), "calibrated": summary(lg, y, temperature)}
    lab, field = metrics["test_lab"]["calibrated"], metrics["test_field"]["calibrated"]
    if lab and field:
        metrics["lab_to_field_gap_macro_f1"] = round(lab["macro_f1"] - field["macro_f1"], 4)

    # export
    model = model.cpu().eval()
    sample = next(iter(DataLoader(sets["val"] if len(sets["val"]) else sets["train"], batch_size=1)))[0]
    cam_err = check_cam(model, sample)
    onnx_path = out / "patra.onnx"
    exp = export_onnx(model, onnx_path)
    names, lshape, cshape, dl, dc = verify_onnx(exp, onnx_path, sample)
    metrics["export"] = {"onnx_outputs": names, "logits_shape": lshape, "cam_shape": cshape,
                         "cam_vs_autograd_max_rel_err": round(cam_err, 6), "onnx_vs_torch_logits_max_abs": round(dl, 6),
                         "onnx_vs_torch_cam_max_rel": round(dc, 6), "onnx_mb": round(onnx_path.stat().st_size / 1e6, 2)}
    (out / "labels.json").write_text(json.dumps(
        [{"index": i, "label": c, "name": NAMES[i]} for i, c in enumerate(CLASSES)], indent=1))
    (out / "calibration.json").write_text(json.dumps({"temperature": round(temperature, 4)}))
    (out / "metrics.json").write_text(json.dumps(metrics, indent=1))
    write_markdown(metrics, out / "METRICS.md")
    print(json.dumps(metrics["export"], indent=1))
    print(f"\nDone. Copy {onnx_path.name}, labels.json and calibration.json from {out} to public/model/.")


def write_markdown(m, path: Path):
    def row(name, s):
        if not s:
            return f"| {name} | no photos | | | | |"
        return (f"| {name} | {s['n']} | {s['accuracy']:.1%} | {s['macro_f1']:.3f} | {s['ece']:.3f} | "
                f"{s['answered_share']:.0%} answered, {s['accuracy_on_answered']:.1%} correct |"
                if s['accuracy_on_answered'] is not None else
                f"| {name} | {s['n']} | {s['accuracy']:.1%} | {s['macro_f1']:.3f} | {s['ece']:.3f} | none answered |")
    lines = ["# Patra Lens model results", "",
             f"Model: MobileNetV3-{m['arch']}. Temperature: {m['temperature']}. "
             f"\"Not sure\" below {m['abstain_below']:.0%} confidence.", "",
             "| Test set | Photos | Accuracy | Macro-F1 | ECE | Not-sure rule |", "|---|---|---|---|---|---|",
             row("Lab photos (PlantVillage)", m["test_lab"]["calibrated"]),
             row("Field photos (PlantDoc)", m["test_field"]["calibrated"]), ""]
    if "lab_to_field_gap_macro_f1" in m:
        lines.append(f"Lab-to-field gap (macro-F1): {m['lab_to_field_gap_macro_f1']:.3f}")
    u, c = m["test_field"]["uncalibrated"], m["test_field"]["calibrated"]
    if u and c:
        lines.append(f"Field ECE before calibration: {u['ece']:.3f}, after: {c['ece']:.3f}")
    lines += ["", "PlantDoc has no Target spot photos, so the field macro-F1 covers the other classes.",
              "Report these numbers as measured on public datasets, not on local farms."]
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
