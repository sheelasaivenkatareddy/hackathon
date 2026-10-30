Model files for Patra Lens (on-device mode)

patra.onnx        Add this after training: MobileNetV3 fine-tuned on PlantVillage + PlantDoc tomato
                  images, exported from PyTorch with torch.onnx.export (input 1x3x224x224, output 10 logits).
labels.json       Class order. It matches the PlantVillage tomato folders as sorted by torchvision
                  ImageFolder. If your training data uses other folders, regenerate it from
                  your dataset's class_to_idx so the order matches the model output.
calibration.json  Temperature for calibration. Keep 1.0 until you fit the temperature on your
                  validation set (temperature scaling), then put the fitted value here.

Until patra.onnx exists, the website runs in Demo mode (sample photos only, clearly labelled).
