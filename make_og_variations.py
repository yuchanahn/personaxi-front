import os
from PIL import Image, ImageDraw, ImageFont

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
    new_w = int(h * target_ratio)
    left = (w - new_w) // 2
    base = base.crop((left, 0, left + new_w, h))
else:
    new_h = int(w / target_ratio)
    top = (h - new_h) // 2
    base = base.crop((0, top, w, top + new_h))

base = base.resize((1200, 630), Image.Resampling.LANCZOS)

def create_og(filename, gradient=True, text_color=(255, 255, 255), shadow_color=(0, 0, 0, 180)):
    # Clone base
    img = base.copy()
    
    if gradient:
        # Create an overlay for the gradient
        overlay = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Dark gradient from left (to make text readable)
        for x in range(1200):
            alpha = int(255 * (1 - (x / 800))) # Fade out at 800px
            if alpha < 0: alpha = 0
            draw.line([(x, 0), (x, 630)], fill=(10, 10, 15, int(alpha * 0.95)))

        # Dark gradient from bottom
        for y in range(630):
            alpha = int(255 * (1 - ((630 - y) / 300)))
            if alpha < 0: alpha = 0
            draw.line([(0, y), (1200, y)], fill=(10, 10, 15, int(alpha * 0.90)))

        img = Image.alpha_composite(img, overlay)
    
    draw = ImageDraw.Draw(img)

    # Load fonts
    try:
        font_main = ImageFont.truetype("Pretendard-Bold.otf", 68)
        font_sub = ImageFont.truetype("Pretendard-Medium.otf", 36)
        font_logo = ImageFont.truetype("Pretendard-Bold.otf", 42)
    except:
        font_main = font_sub = font_logo = ImageFont.load_default()

    text_main1 = "상상하던 모든 관계,"
    text_main2 = "모든 이야기"
    text_sub = "차원이 다른 AI 채팅, PersonaXi"

    x_offset = 80
    y_main1 = 300
    y_main2 = 390
    y_sub = 510

    def draw_text_with_shadow(draw, position, text, font, fill, shadow):
        x, y = position
        if shadow:
            # Drop shadow
            draw.text((x+3, y+3), text, font=font, fill=shadow)
        draw.text((x, y), text, font=font, fill=fill)

    # Draw main texts
    draw_text_with_shadow(draw, (x_offset, y_main1), text_main1, font_main, fill=text_color, shadow=shadow_color)
    draw_text_with_shadow(draw, (x_offset, y_main2), text_main2, font_main, fill=text_color, shadow=shadow_color)

    # Draw sub text
    # #ec4899 = (236, 72, 153)
    draw_text_with_shadow(draw, (x_offset, y_sub), text_sub, font_sub, fill=(236, 72, 153), shadow=shadow_color)

    # Paste logo
    try:
        logo = Image.open("logo.png").convert("RGBA")
        logo = logo.resize((64, 64), Image.Resampling.LANCZOS)
        img.paste(logo, (80, 80), logo)
        
        # Determine text color for 'PersonaXi' next to logo
        logo_text_color = text_color
        if text_color == (255, 183, 3): # If gold
            logo_text_color = (255,255,255)
            
        draw_text_with_shadow(draw, (160, 90), "PersonaXi", font_logo, fill=logo_text_color, shadow=shadow_color)
    except Exception as e:
        print("Logo skipped:", e)

    img = img.convert("RGB")
    img.save(filename, quality=95)
    print(f"Generated {filename}")


# Version 1: Warm Gold (Matches character's eye color) with gradient
create_og("og-image-gold.png", gradient=True, text_color=(255, 183, 3), shadow_color=(0, 0, 0, 180))

# Version 2: Deep Navy/Charcoal without heavy gradient, pure clean anime style background
# Dark text doesn't need a black shadow, maybe a very subtle white halo, or just no shadow
create_og("og-image-dark.png", gradient=False, text_color=(20, 25, 45), shadow_color=(255, 255, 255, 180))

# Version 3: Classic Red with gradient
create_og("og-image-red.png", gradient=True, text_color=(239, 68, 68), shadow_color=(0, 0, 0, 180))

print("All variations generated.")
