"""
System information endpoints
"""

from fastapi import APIRouter
import torch

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/device-info")
async def get_device_info():
    """
    Get current compute device information.
    Returns whether using CPU or GPU for transcription.
    """
    cuda_available = torch.cuda.is_available()
    
    if cuda_available:
        device_name = torch.cuda.get_device_name(0)
        device_type = "GPU"
        memory_total = torch.cuda.get_device_properties(0).total_memory / (1024**3)  # GB
        memory_used = torch.cuda.memory_allocated(0) / (1024**3)  # GB
        
        return {
            "device_type": device_type,
            "device_name": device_name,
            "cuda_version": torch.version.cuda,
            "memory_total_gb": round(memory_total, 2),
            "memory_used_gb": round(memory_used, 2),
            "pytorch_version": torch.__version__
        }
    else:
        return {
            "device_type": "CPU",
            "device_name": "CPU",
            "cuda_version": None,
            "memory_total_gb": None,
            "memory_used_gb": None,
            "pytorch_version": torch.__version__
        }