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

# Open base image
try:
    base = Image.open("og-base.jpg").convert("RGBA")
except Exception as e:
    print("Failed to open og-base.jpg:", e)
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
    alpha = int(255 * (1 - (x / 800))) # Fade out at 800px
    if alpha < 0: alpha = 0
    draw.line([(x, 0), (x, 630)], fill=(10, 10, 15, int(alpha * 0.90)))

# Dark gradient from bottom
for y in range(630):
    alpha = int(255 * (1 - ((630 - y) / 300)))
    if alpha < 0: alpha = 0
    draw.line([(0, y), (1200, y)], fill=(10, 10, 15, int(alpha * 0.90)))

base = Image.alpha_composite(base, overlay)
draw = ImageDraw.Draw(base)

# Load fonts
try:
    font_main = ImageFont.truetype("Pretendard-Bold.otf", 68)
    font_sub = ImageFont.truetype("Pretendard-Medium.otf", 36)
    font_logo = ImageFont.truetype("Pretendard-Bold.otf", 42)
except Exception as e:
    print("Font error:", e)
    font_main = font_sub = font_logo = ImageFont.load_default()

text_main1 = "상상하던 모든 관계,"
text_main2 = "모든 이야기"
text_sub = "차원이 다른 AI 채팅, PersonaXi"

x_offset = 80
y_main1 = 300
y_main2 = 390
y_sub = 510

def draw_text_with_shadow(draw, position, text, font, fill, shadow_color=(0,0,0,180)):
    x, y = position
    draw.text((x+3, y+3), text, font=font, fill=shadow_color)
    draw.text((x, y), text, font=font, fill=fill)

# Draw main texts
draw_text_with_shadow(draw, (x_offset, y_main1), text_main1, font_main, fill=(255, 255, 255))
draw_text_with_shadow(draw, (x_offset, y_main2), text_main2, font_main, fill=(255, 255, 255))

# Draw sub text in PersonaXi pink gradient-ish color
# #ec4899 = (236, 72, 153)
draw_text_with_shadow(draw, (x_offset, y_sub), text_sub, font_sub, fill=(236, 72, 153))

# Paste logo
try:
    logo = Image.open("logo.png").convert("RGBA")
    logo = logo.resize((64, 64), Image.Resampling.LANCZOS)
    base.paste(logo, (80, 80), logo)
    draw_text_with_shadow(draw, (160, 90), "PersonaXi", font_logo, fill=(255, 255, 255))
except Exception as e:
    print("Logo skipped:", e)

base = base.convert("RGB")
base.save("og-image.png", quality=95)
print("Successfully generated og-image.png")
