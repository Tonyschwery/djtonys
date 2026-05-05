import os
from PIL import Image

def process_logo(input_path, output_path):
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # Change all dark pixels (background) to transparent
            # The background is very dark blue/black. We can check if r, g, b are all below a threshold.
            if item[0] < 50 and item[1] < 50 and item[2] < 50:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Processed logo and saved to {output_path}")
    except Exception as e:
        print(f"Error processing logo: {e}")

def optimize_photo(input_path, output_path, max_width=1920):
    try:
        img = Image.open(input_path)
        # Convert to RGB if it's RGBA
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        
        # Resize if width is larger than max_width
        w, h = img.size
        if w > max_width:
            new_h = int((max_width / w) * h)
            img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
        
        # Save as optimized JPEG
        img.save(output_path, "JPEG", quality=85, optimize=True)
        print(f"Optimized photo and saved to {output_path}")
    except Exception as e:
        print(f"Error optimizing photo {input_path}: {e}")

if __name__ == "__main__":
    public_images_dir = os.path.join("public", "images")
    if not os.path.exists(public_images_dir):
        os.makedirs(public_images_dir)

    # We assume the user saves the images to the project root with specific names
    logo_input = "raw_logo.jpg"
    logo_output = os.path.join(public_images_dir, "logo.png")
    
    if os.path.exists(logo_input):
        process_logo(logo_input, logo_output)
    else:
        print(f"Please save the logo image as '{logo_input}' in the project root folder.")

    # Process photo 1
    photo1_input = "raw_photo1.jpg"
    photo1_output = os.path.join(public_images_dir, "dj-photo-1.jpg")
    if os.path.exists(photo1_input):
        optimize_photo(photo1_input, photo1_output)
    else:
        print(f"Please save the first DJ photo as '{photo1_input}' in the project root folder.")

    # Process photo 2
    photo2_input = "raw_photo2.jpg"
    photo2_output = os.path.join(public_images_dir, "dj-photo-2.jpg")
    if os.path.exists(photo2_input):
        optimize_photo(photo2_input, photo2_output)
    
    # Process photo 3
    photo3_input = "raw_photo3.jpg"
    photo3_output = os.path.join(public_images_dir, "dj-photo-3.jpg")
    if os.path.exists(photo3_input):
        optimize_photo(photo3_input, photo3_output)

    print("Image processing complete!")
