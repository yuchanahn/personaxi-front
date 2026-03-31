# Virtual Model Upload Guide

How to connect 2.5D (Live2D) and 3D (VRM) models to a character.

## Where to Upload

- Upload in the media/model area of `edit`
- For Live2D, use **Live2D Advanced Editor** after save to tune motions/expressions/audio/runtime behavior

## 1) Live2D

- **Recommended Input**: `.zip` package or complete `.model3.json` set
- **Required Files**: `model3.json`, `.moc3`, textures, motion/expression resources
- **Advanced Editable Items**:
  - Motion/expression aliases
  - AI action mapping
  - Audio mapping
  - Runtime sensitivity/offset values

## 2) VRM (3D)

- **Supported File**: `.vrm` (0.x / 1.0)
- **Recommended**: Standard humanoid rig and optimized texture/polygon size

## Practical Tips

- Keep a separate thumbnail image even when using a model.
- After replacing a model, run a quick chat test for motion/expression/voice behavior.
- Verify the model license first (redistribution/commercial restrictions).
