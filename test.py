
import torch, sys
print("python:", sys.executable)
print("torch:", torch.__version__)
print("cuda_available:", torch.cuda.is_available())
print("has_mps:", hasattr(torch.backends, "mps"))
print("mps_available:", hasattr(torch.backends,"mps") and torch.backends.mps.is_available())
