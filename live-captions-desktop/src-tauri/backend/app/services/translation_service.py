"""
═══════════════════════════════════════════════════════════════════════════
NLLB-200 TRANSLATION SERVICE - CTRANSLATE2 (GPU-ACCELERATED)
═══════════════════════════════════════════════════════════════════════════

Real-time translation using Meta's NLLB-200 with CTranslate2 backend.
- 200+ languages supported
- GPU acceleration via CTranslate2 (works with RTX 5080!)
- 10-20x faster than PyTorch CPU
- 100% free and open source
"""

import logging
import ctranslate2
from transformers import AutoTokenizer
from typing import Optional
from pathlib import Path

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
    """NLLB-200 translation service using CTranslate2 for GPU acceleration."""

    def __init__(self, model_size: str = "1.3B"):
        # Use pre-converted CTranslate2 model (FP16 for GPU speed)
        model_id = f"JustFrederik/nllb-200-distilled-{model_size}-ct2-float16"

        logger.info(f"Loading NLLB-200-CT2 translation model ({model_size})...")

        # Download model if not cached
        # Use default HuggingFace cache (~/.cache/huggingface/hub)
        # to avoid issues with relative paths in installed apps
        from huggingface_hub import snapshot_download
        model_path = snapshot_download(
            repo_id=model_id,
            cache_dir=None,  # Use HF default cache location
            local_files_only=False
        )
        logger.info(f"Model downloaded to: {model_path}")

        # Auto-detect device (CTranslate2 will use CUDA if available)
        device_count = ctranslate2.get_cuda_device_count()
        if device_count > 0:
            self.device = "cuda"
            self.device_index = 0
            logger.info(f"✓ GPU acceleration enabled ({device_count} CUDA device(s) available)")
        else:
            self.device = "cpu"
            self.device_index = 0
            logger.info("Using CPU (no CUDA devices found)")

        # Load CTranslate2 model
        self.translator = ctranslate2.Translator(
            model_path,
            device=self.device,
            device_index=self.device_index,
            compute_type="float16" if self.device == "cuda" else "float32",
        )

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_id,
            cache_dir=None  # Use HF default cache location
        )

        logger.info(f"✓ NLLB-200-CT2 ({model_size}) loaded on {self.device}")

    def get_language_code(self, lang: str) -> str:
        return LANGUAGE_CODES.get(lang.lower(), "eng_Latn")

    async def translate(self, text: str, source_lang: str = "en", target_lang: str = "es") -> Optional[str]:
        if not text or len(text.strip()) == 0:
            return None

        try:
            src_code = self.get_language_code(source_lang)
            tgt_code = self.get_language_code(target_lang)

            # Tokenize input
            self.tokenizer.src_lang = src_code
            tokens = self.tokenizer.convert_ids_to_tokens(
                self.tokenizer.encode(text)
            )

            # Translate using CTranslate2
            results = self.translator.translate_batch(
                [tokens],
                target_prefix=[[tgt_code]],
                beam_size=1,  # Greedy decoding for speed
                max_decoding_length=512,
            )

            # Decode result
            output_tokens = results[0].hypotheses[0]
            result = self.tokenizer.decode(
                self.tokenizer.convert_tokens_to_ids(output_tokens),
                skip_special_tokens=True
            )

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
