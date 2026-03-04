from PIL import Image, ImageOps

try:
    target_size = (2100, 720)
    with Image.open("discord-base.png") as base_img:
        processed_img = ImageOps.fit(base_img, target_size, method=Image.Resampling.LANCZOS)
        processed_img.save("hub_banner_discord_anime.png", "PNG")
        print("Success")
except Exception as e:
    print(f"Error: {e}")
