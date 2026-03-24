import os
import requests
from PIL import Image, ImageDraw, ImageFont

def download_file(url, filename):
    if not os.path.exists(filename):
        print(f"Downloading {filename}...")
        r = requests.get(url, allow_redirects=True)
        with open(filename, 'wb') as f:
            f.write(r.content)

# Download Pretendard fonts (macOS/Windows friendly)
font_bold_url = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf"
font_regular_url = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Medium.otf"
download_file(font_bold_url, "Pretendard-Bold.otf")
download_file(font_regular_url, "Pretendard-Medium.otf")

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        bbox = draw.textbbox((0, 0), candidate, font=font)
        width = bbox[2] - bbox[0]
        if width <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines

def draw_text_with_shadow(draw, position, text, font, fill, shadow_color=(0, 0, 0, 200), shadow_offset=3):
    x, y = position
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)
    draw.text((x, y), text, font=font, fill=fill)

# Open base image
try:
    base = Image.open("og-image-base.jpg").convert("RGBA")
except Exception as e:
    print("Failed to open og-image-base.jpg:", e)
    exit(1)

# Target size 1200x630
w, h = base.size
target_ratio = 1200 / 630
current_ratio = w / h

if current_ratio > target_ratio:
    # crop width
    new_w = int(h * target_ratio)
    left = (w - new_w) // 2
    base = base.crop((left, 0, left + new_w, h))
else:
    # crop height
    new_h = int(w / target_ratio)
    top = (h - new_h) // 2
    base = base.crop((0, top, w, top + new_h))

base = base.resize((1200, 630), Image.Resampling.LANCZOS)

# Create an overlay for the gradient
overlay = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Dark gradient from left (to make text readable)
for x in range(1200):
    alpha = int(255 * (1 - (x / 760))) # Fade out at 760px
    if alpha < 0: alpha = 0
    draw.line([(x, 0), (x, 630)], fill=(8, 8, 12, int(alpha * 0.88)))

# Subtle dark gradient from bottom
for y in range(630):
    alpha = int(255 * (1 - ((630 - y) / 300)))
    if alpha < 0: alpha = 0
    draw.line([(0, y), (1200, y)], fill=(8, 8, 12, int(alpha * 0.58)))

base = Image.alpha_composite(base, overlay)
draw = ImageDraw.Draw(base)

# Load fonts
try:
    font_brand = ImageFont.truetype("Pretendard-Bold.otf", 54)
    font_main = ImageFont.truetype("Pretendard-Medium.otf", 34)
except Exception as e:
    print("Font error:", e)
    font_brand = font_main = ImageFont.load_default()

brand_text = "PXI"
main_text = "AI Chat, Your Way"

x_offset = 84

# Brand mark
draw_text_with_shadow(
    draw,
    (x_offset, 84),
    brand_text,
    font_brand,
    fill=(255, 196, 102),
    shadow_color=(0, 0, 0, 200),
)

# Minimal support line
draw_text_with_shadow(
    draw,
    (x_offset, 154),
    main_text,
    font_main,
    fill=(196, 201, 214),
    shadow_color=(0, 0, 0, 190),
    shadow_offset=3,
)

base = base.convert("RGB")
base.save("og-image-v3.png", quality=95)
print("Successfully generated og-image-v3.png")
