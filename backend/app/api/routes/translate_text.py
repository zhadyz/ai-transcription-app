"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT TRANSLATION API - With Health Checking
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging

from app.services.translation_service import translation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["translation"])


class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str


class TranslateSegmentsRequest(BaseModel):
    segments: List[dict]
    source_lang: str
    target_lang: str


@router.get("/status")
async def get_translation_status():
    """
    Check if translation service is available and healthy.
    Returns service metrics and availability status.
    """
    try:
        # Check if service is initialized
        languages = translation_service.get_supported_languages()
        
        if not languages:
            logger.warning("Translation service returned no languages")
            return {
                "available": False,
                "error": "Translation service not initialized",
                "languages_count": 0
            }
        
        # Get service metrics
        try:
            metrics = translation_service.get_metrics()
        except Exception as e:
            logger.warning(f"Could not get metrics: {e}")
            metrics = {}
        
        logger.info(f"✅ Translation service healthy: {len(languages)} languages")
        
        return {
            "available": True,
            "service": "LibreTranslate",
            "url": translation_service.api_url,
            "languages_count": len(languages),
            "metrics": metrics
        }
        
    except Exception as e:
        logger.error(f"❌ Translation service error: {e}", exc_info=True)
        return {
            "available": False,
            "error": str(e),
            "languages_count": 0
        }


@router.get("/languages")
async def get_languages():
    """Get list of supported translation languages"""
    try:
        languages = translation_service.get_supported_languages()
        logger.debug(f"Returning {len(languages)} languages")
        return {"languages": languages}
    except Exception as e:
        logger.error(f"Error getting languages: {e}")
        raise HTTPException(500, f"Failed to get languages: {str(e)}")


@router.post("/text")
async def translate_text(request: TranslateRequest):
    """Translate plain text"""
    
    if not request.text:
        raise HTTPException(400, "Text is required")
    
    logger.info(f"🌍 Translating text: {request.source_lang} → {request.target_lang}")
    
    try:
        translated = translation_service.translate(
            request.text,
            request.source_lang,
            request.target_lang
        )
        
        if translated is None:
            raise HTTPException(500, "Translation returned None")
        
        return {
            "original": request.text,
            "translated": translated,
            "source_lang": request.source_lang,
            "target_lang": request.target_lang
        }
        
    except Exception as e:
        logger.error(f"Translation error: {e}", exc_info=True)
        raise HTTPException(500, f"Translation failed: {str(e)}")


@router.post("/segments")
async def translate_segments(request: TranslateSegmentsRequest):
    """Translate transcription segments with timestamps"""
    
    if not request.segments:
        raise HTTPException(400, "Segments are required")
    
    logger.info(
        f"🌍 Translating {len(request.segments)} segments: "
        f"{request.source_lang} → {request.target_lang}"
    )
    
    try:
        translated = translation_service.translate_segments(
            request.segments,
            request.source_lang,
            request.target_lang
        )
        
        logger.info(f"✅ Translated {len(translated)} segments")
        
        return {
            "segments": translated,
            "source_lang": request.source_lang,
            "target_lang": request.target_lang
        }
        
    except Exception as e:
        logger.error(f"Segment translation error: {e}", exc_info=True)
        raise HTTPException(500, f"Translation failed: {str(e)}")