import os
import shutil

BASE_DIR = "."  # Đang ở trong archive

def rename_and_move():
    # B1: Đổi Lxx -> Hxx
    for name in os.listdir(BASE_DIR):
        if os.path.isdir(name) and name.startswith("L") and name[1:].isdigit():
            new_name = "H" + name[1:]
            os.rename(name, new_name)
            print(f"🔄 Đổi tên: {name} → {new_name}")

    # B2: Duyệt các Hxx để di chuyển Lxx bên trong ra ngoài
    for name in os.listdir(BASE_DIR):
        if os.path.isdir(name) and name.startswith("H") and name[1:].isdigit():
            hxx_path = os.path.join(BASE_DIR, name)
            lxx_name = "L" + name[1:]  # Tên mới khi ra ngoài
            dst_path = os.path.join(BASE_DIR, lxx_name)

            inner_lxx_path = os.path.join(hxx_path, "kaggle", "working", lxx_name)
            if os.path.exists(inner_lxx_path):
                print(f"📂 Di chuyển từ {inner_lxx_path} → {dst_path}")
                os.makedirs(dst_path, exist_ok=True)

                for item in os.listdir(inner_lxx_path):
                    s = os.path.join(inner_lxx_path, item)
                    d = os.path.join(dst_path, item)
                    if os.path.exists(d):
                        print(f"⚠ Bỏ qua vì đã tồn tại: {d}")
                        continue
                    shutil.move(s, d)

            # B3: Xóa thư mục Hxx
            shutil.rmtree(hxx_path, ignore_errors=True)
            print(f"🗑 Xóa {hxx_path}")

    print("✅ Hoàn tất hjhj.")

if __name__ == "__main__":
    rename_and_move()
