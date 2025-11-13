from fastapi import APIRouter, Request
from fastapi.responses import Response

router = APIRouter(prefix="/capabilities", tags=["Capabilities"])

@router.head("")
async def get_capabilities(request: Request):
    """
    Return system capabilities via headers.
    Automatically detects HTTP vs HTTPS and adjusts streaming support.
    
    - HTTPS (HTTP/2 available) → streaming enabled
    - HTTP (HTTP/1.1 only) → streaming disabled
    """
    # Detect if request is over HTTPS
    is_https = request.url.scheme == "https"
    
    # Streaming requires HTTP/2, which requires HTTPS
    supports_streaming = "true" if is_https else "false"
    
    return Response(
        status_code=200,
        headers={
            "x-supports-streaming": supports_streaming,  # ← Dynamic!
            "x-max-chunk-size": "262144",  # 256KB
            "x-supports-resume": "true",
            "x-supports-parallel": "true",
            "x-protocol": request.url.scheme  # ← Debug: show detected protocol
        }
    )


@router.get("")
async def get_capabilities_json():
    """
    Alternative JSON endpoint for capability discovery.
    """
    return {
        "streaming": True,
        "maxChunkSize": 262144,
        "resume": True,
        "parallel": True,
        "compression": ["gzip", "brotli"]
    }