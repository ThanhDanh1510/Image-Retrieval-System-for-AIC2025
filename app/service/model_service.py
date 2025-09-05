import os
import torch
import numpy as np
from core.beit3_processor import load_model_and_processor, Processor


def pick_device():
    # Cho phép ép device qua biến môi trường: DEVICE=cpu|cuda|mps
    forced = os.getenv("DEVICE", "").lower()
    if forced in {"cpu", "cuda", "mps"}:
        return torch.device(forced)

    # Ưu tiên MPS cho Apple Silicon
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    # Nếu chạy trên máy có NVIDIA thì dùng CUDA
    if torch.cuda.is_available():
        return torch.device("cuda")
    # Mặc định CPU
    return torch.device("cpu")


class ModelService:
    def __init__(
        self,
        model_checkpoint: str,
        tokenizer_checkpoint: str,
        device: str | None = None,   # đổi mặc định: không ép 'cuda'
    ):
        # chọn device: ưu tiên tham số -> env -> auto-detect
        self.device = torch.device(device) if device else pick_device()

        self.model, self.processor = load_model_and_processor(model_checkpoint, tokenizer_checkpoint)
        self.model = self.model.to(self.device)   # dùng self.device
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
