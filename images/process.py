from PIL import Image, ImageOps
import sys

def main():
    try:
        # Get target size
        with Image.open("hub_banner_event_anime.png") as target_img:
            target_size = target_img.size
            print(f"Target size: {target_size}")
            
        # Process the discord base image
        with Image.open("discord-base.jpg") as base_img:
            # Crop and resize to exactly match the target size
            processed_img = ImageOps.fit(base_img, target_size, method=Image.Resampling.LANCZOS)
            processed_img.save("hub_banner_discord_anime.png", "PNG")
            print("Successfully saved hub_banner_discord_anime.png!")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
