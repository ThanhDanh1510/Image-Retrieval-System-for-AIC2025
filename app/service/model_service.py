# Project-relative path: app/service/model_service.py
import torch
from PIL import Image
import numpy as np
from typing import List

# Import các hàm và lớp từ file beit3_processor.py của bạn
from core.beit3_processor import load_model_and_processor, Processor

def get_device():
    if torch.backends.mps.is_available():
        print("✅ Using Apple MPS (Metal Performance Shaders)")
        return torch.device("mps")
    elif torch.cuda.is_available():
        print("✅ Using CUDA GPU")
        return torch.device("cuda")
    else:
        print("⚙️ Using CPU")
        return torch.device("cpu")


class ModelService:
    def __init__(
        self,
        model_checkpoint: str,
        tokenizer_checkpoint: str,
        device = get_device(),
    ):
        """
        Khởi tạo ModelService.
        Hàm này được gọi 1 lần duy nhất bởi ServiceFactory khi ứng dụng khởi động.

        Args:
            model_checkpoint (str): Đường dẫn đến file checkpoint .pth của BEIT-3.
            tokenizer_checkpoint (str): Đường dẫn đến file tokenizer .spm của BEIT-3.
            device (str, optional): Thiết bị để chạy model ('cuda' hoặc 'cpu').
        """
        self.device = device

        # Tải mô hình và bộ xử lý (từ beit3_processor.py)
        self.model, self.processor = load_model_and_processor(
            model_checkpoint, tokenizer_checkpoint
        )
        self.model = self.model.to(self.device)
        self.model.eval() # Chuyển model sang chế độ inference

    def embedding(self, query_text: str) -> List[float]:
        """
        Tạo vector embedding cho MỘT câu văn bản.
        Đây là hàm hiện có của bạn.

        Args:
            query_text (str): Câu văn bản đầu vào.

        Returns:
            List[float]: Vector embedding đã được chuẩn hóa (normalized).
        """
        with torch.no_grad(): # Tắt tính toán gradient để tiết kiệm bộ nhớ và tăng tốc
            # Sử dụng processor để tokenize văn bản (từ beit3_processor.py)
            text_description, padding_mask, _ = self.processor.get_text_segment(query_text)

            # Đưa dữ liệu qua model BEIT-3
            _, query_embedding = self.model(
                text_description=text_description.to(self.device),
                padding_mask=padding_mask.to(self.device),
                only_infer=True
            )

            # Chuẩn hóa vector embedding (L2 normalization)
            query_embedding = query_embedding / query_embedding.norm(dim=-1, keepdim=True)

        # Chuyển tensor (B, D) -> (D,) -> list[float]
        emb = query_embedding.squeeze(0).detach().cpu().float().ravel().tolist()
        return emb
    
    def embedding_image(self, image: Image.Image) -> list[float]:
        """
        Tạo vector embedding từ một đối tượng ảnh PIL.
        """
        with torch.no_grad():
            image = image.convert("RGB")
            processed_image = self.processor.image_processor(image).unsqueeze(0).to(self.device)
            
            image_features, _ = self.model(image=processed_image, only_infer=True)
            
            # Bây giờ image_features là một Tensor và có thể gọi .norm()
            image_embedding = image_features / image_features.norm(dim=-1, keepdim=True)
            
        return image_embedding.squeeze(0).cpu().float().ravel().tolist()

    # --- HÀM MỚI ĐƯỢC THÊM VÀO ĐỂ HỖ TRỢ DP ---

    def embed_texts(self, query_texts: List[str]) -> List[List[float]]:
        """
        Tạo vector embedding cho MỘT DANH SÁCH (batch) các câu văn bản.
        Hàm này được dùng cho thuật toán Video Ranking (DP).

        Args:
            query_texts (List[str]): Một danh sách các câu văn bản (ví dụ: N sự kiện).

        Returns:
            List[List[float]]: Một danh sách các vector embedding.
        """
        batch_embeddings = []
        with torch.no_grad():
            # Lặp qua từng câu và gọi hàm embedding đơn lẻ
            # Vì beit3_processor.py (get_text_segment) hiện tại xử lý từng câu một.
            # Nếu processor hỗ trợ batch, có thể tối ưu hóa thêm ở đây.
            for text in query_texts:
                batch_embeddings.append(self.embedding(text))

        return batch_embeddings
