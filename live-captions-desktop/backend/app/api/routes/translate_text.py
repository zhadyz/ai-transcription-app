"""
═══════════════════════════════════════════════════════════════════════════
TRANSCENDENT TRANSLATION API - With Health Checking
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging

from app.services.translation_service import get_translation_service

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
    """Check if NLLB translation service is available and healthy."""
    try:
        translation_service = get_translation_service()
        return {
            "available": True,
            "model": "NLLB-200 (1.3B)",
            "device": translation_service.device,
            "languages_supported": len(translation_service.tokenizer.lang_code_to_id) if hasattr(translation_service.tokenizer, 'lang_code_to_id') else 200
        }
    except Exception as e:
        logger.error(f"Translation service error: {e}")
        return {"available": False, "error": str(e)}


@router.get("/languages")
async def get_languages():
    """Get list of supported translation languages"""
    from app.services.translation_service import LANGUAGE_CODES

    languages = [
        {"code": code, "name": full_code.split("_")[0].title(), "nllb_code": full_code}
        for code, full_code in LANGUAGE_CODES.items()
    ]

    return {
        "languages": languages,
        "total": len(languages),
        "note": "NLLB-200 supports 200+ languages total"
    }


@router.post("/text")
async def translate_text(request: TranslateRequest):
    """Translate plain text using NLLB-200"""
    try:
        translation_service = get_translation_service()

        translation = await translation_service.translate(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )

        if not translation:
            raise HTTPException(500, "Translation failed")

        return {
            "original_text": request.text,
            "translated_text": translation,
            "source_language": request.source_lang,
            "target_language": request.target_lang
        }
    except Exception as e:
        logger.error(f"Translation error: {e}", exc_info=True)
        raise HTTPException(500, f"Translation failed: {str(e)}")


@router.post("/segments")
async def translate_segments(request: TranslateSegmentsRequest):
    """Translate transcription segments with timestamps"""
    try:
        translation_service = get_translation_service()

        translated_segments = []
        for segment in request.segments:
            text = segment.get("text", "")
            if not text:
                translated_segments.append(segment)
                continue

            translation = await translation_service.translate(
                text=text,
                source_lang=request.source_lang,
                target_lang=request.target_lang
            )

            translated_segment = {
                **segment,
                "text": translation if translation else text,
                "original_text": text
            }
            translated_segments.append(translated_segment)

        return {
            "segments": translated_segments,
            "source_language": request.source_lang,
            "target_language": request.target_lang,
            "total_segments": len(translated_segments)
        }
    except Exception as e:
        logger.error(f"Segment translation error: {e}", exc_info=True)
        raise HTTPException(500, f"Segment translation failed: {str(e)}")