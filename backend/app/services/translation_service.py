"""
═══════════════════════════════════════════════════════════════════════════
NLLB-200 TRANSLATION SERVICE
═══════════════════════════════════════════════════════════════════════════

Real-time translation using Meta's NLLB-200 (No Language Left Behind) model.
- 200+ languages supported
- 85-92% accuracy (near-API quality)
- 100% free and open source
- GPU accelerated
"""

import logging
import torch
from typing import Optional
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

logger = logging.getLogger(__name__)

# Language code mapping for common languages
LANGUAGE_CODES = {
    "en": "eng_Latn",  # English
    "es": "spa_Latn",  # Spanish
    "fr": "fra_Latn",  # French
    "de": "deu_Latn",  # German
    "it": "ita_Latn",  # Italian
    "pt": "por_Latn",  # Portuguese
    "ru": "rus_Cyrl",  # Russian
    "zh": "zho_Hans",  # Chinese (Simplified)
    "ja": "jpn_Jpan",  # Japanese
    "ko": "kor_Hang",  # Korean
    "ar": "arb_Arab",  # Arabic
    "hi": "hin_Deva",  # Hindi
    "tr": "tur_Latn",  # Turkish
    "pl": "pol_Latn",  # Polish
    "nl": "nld_Latn",  # Dutch
    "sv": "swe_Latn",  # Swedish
    "da": "dan_Latn",  # Danish
    "fi": "fin_Latn",  # Finnish
    "no": "nob_Latn",  # Norwegian
    "cs": "ces_Latn",  # Czech
    "uk": "ukr_Cyrl",  # Ukrainian
    "vi": "vie_Latn",  # Vietnamese
    "th": "tha_Thai",  # Thai
    "id": "ind_Latn",  # Indonesian
}


class NLLBTranslationService:
    """NLLB-200 translation service for real-time caption translation."""

    def __init__(self, model_size: str = "1.3B"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        model_name = f"facebook/nllb-200-distilled-{model_size}"

        logger.info(f"Loading NLLB-200 translation model ({model_size})...")
        
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir="./models",
            use_safetensors=True
        )
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            model_name,
            cache_dir="./models",
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            use_safetensors=True
        ).to(self.device)

        logger.info(f"✓ NLLB-200 ({model_size}) loaded on {self.device}")
        
        if self.device == "cuda":
            self.model.eval()

    def get_language_code(self, lang: str) -> str:
        return LANGUAGE_CODES.get(lang.lower(), "eng_Latn")

    async def translate(self, text: str, source_lang: str = "en", target_lang: str = "es") -> Optional[str]:
        if not text or len(text.strip()) == 0:
            return None

        try:
            src_code = self.get_language_code(source_lang)
            tgt_code = self.get_language_code(target_lang)
            
            self.tokenizer.src_lang = src_code
            inputs = self.tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512).to(self.device)

            with torch.no_grad():
                translated = self.model.generate(
                    **inputs,
                    forced_bos_token_id=self.tokenizer.lang_code_to_id[tgt_code],
                    max_length=512,
                    num_beams=4,
                    early_stopping=True
                )

            result = self.tokenizer.batch_decode(translated, skip_special_tokens=True)[0]
            logger.debug(f"Translated [{source_lang}→{target_lang}]: \"{text}\" → \"{result}\"")
            return result

        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return None


_translation_service: Optional[NLLBTranslationService] = None

def get_translation_service(model_size: Optional[str] = None) -> NLLBTranslationService:
    """
    Get singleton translation service instance.

    Args:
        model_size: Optional model size override. If not provided, uses config setting.
    """
    global _translation_service
    if _translation_service is None:
        from app.config import settings
        size = model_size or settings.NLLB_MODEL_SIZE
        _translation_service = NLLBTranslationService(model_size=size)
    return _translation_service
