import os

# Debug __file__ và dirname
print(f"__file__ = {__file__}")
print(f"os.path.dirname(__file__) = {os.path.dirname(__file__)}")
print(f"os.path.abspath(__file__) = {os.path.abspath(__file__)}")
print(f"os.path.dirname(os.path.abspath(__file__)) = {os.path.dirname(os.path.abspath(__file__))}")

# Debug IMAGES_DIR calculation
images_dir_calc = os.path.join(os.path.dirname(__file__), "..", "images")
print(f"Calculated IMAGES_DIR = {images_dir_calc}")
print(f"Absolute IMAGES_DIR = {os.path.abspath(images_dir_calc)}")
print(f"IMAGES_DIR exists = {os.path.exists(images_dir_calc)}")
