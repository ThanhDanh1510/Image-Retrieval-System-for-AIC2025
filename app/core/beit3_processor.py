import torch
from torchvision import transforms
from transformers import XLMRobertaTokenizer
from timm import create_model
from timm.data.constants import IMAGENET_INCEPTION_MEAN, IMAGENET_INCEPTION_STD


class Processor:
    def __init__(self, tokenizer):
        self.image_processor = transforms.Compose([
            transforms.Resize((384, 384), interpolation=3),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_INCEPTION_MEAN, std=IMAGENET_INCEPTION_STD)
        ])
        self.tokenizer = tokenizer

    def get_text_segment(self, text, max_len=64):
        tokens = self.tokenizer.tokenize(text)
        tokens = self.tokenizer.convert_tokens_to_ids(tokens)

        if len(tokens) > max_len - 2:
            tokens = tokens[:max_len - 2]

        tokens = [self.tokenizer.bos_token_id] + tokens[:] + [self.tokenizer.eos_token_id]
        num_tokens = len(tokens)
        padding_mask = [0] * num_tokens + [1] * (max_len - num_tokens)
        language_tokens = tokens + [self.tokenizer.pad_token_id] * (max_len - num_tokens)
        return torch.tensor([language_tokens]), torch.tensor([padding_mask]), num_tokens


def load_model_and_processor(model_checkpoint, tokenizer_checkpoint):
    checkpoint = torch.load(model_checkpoint)
    model = create_model('beit3_large_patch16_384_retrieval')
    model.load_state_dict(checkpoint['model'])
    tokenizer = XLMRobertaTokenizer(tokenizer_checkpoint)
    processor = Processor(tokenizer)
    return model, processor
