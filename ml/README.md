# Train the Patra Lens model (for the AI/ML lead)

Produces `patra.onnx`, `labels.json`, `calibration.json` and `METRICS.md`.

## Google Colab (free GPU)
1. Runtime > Change runtime type > T4 GPU.
2. Upload `prepare_data.py` and `train_patra.py`.
3. Run:
```
!pip -q install onnx onnxscript onnxruntime
!python prepare_data.py --out data
!python train_patra.py --data data --out runs/patra --epochs 12
```
4. Download from `runs/patra/`: put `patra.onnx`, `labels.json`, `calibration.json` in the website's `public/model/`.
   Copy the numbers from `METRICS.md` into `src/config.ts` > `measured`.

Quick trial first: `python prepare_data.py --out data --max-per-class 200` then `--epochs 3`.
Smaller model (about 6 MB instead of 17 MB): add `--arch small`.

## What it does
- PlantVillage (lab) is split by leaf, so photos of the same leaf never sit in both train and test.
- PlantDoc (field) photos are sampled 3x more often; PlantDoc test = the field test set.
- Temperature scaling calibrates confidence. "Not sure" below 50%.
- Reports accuracy, macro-F1, ECE and the lab-to-field gap.
- The ONNX file outputs `logits` [1,10] and `cam` [1,10,7,7]: the exact Grad-CAM, so the heatmap works on the phone.

## Checked before delivery
The script ran end to end on a small sample. The built-in Grad-CAM equals PyTorch autograd Grad-CAM
(max relative error about 1e-6), ONNX equals PyTorch, and the file runs in onnxruntime-web (the website's engine).
The tiny test run's accuracy numbers mean nothing; real numbers come from your full run.

Say results are "measured on public datasets (PlantVillage, PlantDoc)", not on local farms.
Dataset licences: PlantVillage CC BY-SA 3.0, PlantDoc CC BY 4.0.
