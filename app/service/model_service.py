import torch
from PIL import Image
import numpy as np
from core.beit3_processor import load_model_and_processor, Processor


class ModelService:
    def __init__(
        self,
        model_checkpoint: str,
        tokenizer_checkpoint: str,
        device: str = 'cuda'
    ):
        self.device = device
        self.model, self.processor = load_model_and_processor(model_checkpoint, tokenizer_checkpoint)
        self.model = self.model.to(device)
        self.model.eval()

    def embedding(self, query_text: str):
        """
        Return list[float] length D (hoặc bọc [emb_list] nếu schema cần list[list[float]])
        """
        with torch.no_grad():
            text_description, padding_mask, _ = self.processor.get_text_segment(query_text)
            _, query_embedding = self.model(
                text_description=text_description.to(self.device),
                padding_mask=padding_mask.to(self.device),
                only_infer=True
            )
            query_embedding = query_embedding / query_embedding.norm(dim=-1, keepdim=True)

        # (B, D) -> (D,) -> list[float]
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
