from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class TranscriptionQuality(str, Enum):
    """Enum for transcription quality levels, mapping to Whisper model sizes."""
    FAST = "base"           # Base model, ~30s for 1min audio
    BALANCED = "small"      # Small model, ~1min for 1min audio
    DEEP = "medium"         # Medium model, ~2min for 1min audio
    ULTRA = "large-v2"      # Large-v2 model, ~4min for 1min audio
    MAXIMUM = "large-v3"    # Large-v3 model, ~5min for 1min audio (best quality)


class TranscriptionLanguage(str, Enum):
    """Enum for supported transcription languages, including all Whisper-supported languages."""
    AUTO = "auto"
    AFRIKAANS = "af"
    AMHARIC = "am"
    ARABIC = "ar"
    ASSAMESE = "as"
    AZERBAIJANI = "az"
    BASHKIR = "ba"
    BELARUSIAN = "be"
    BENGALI = "bn"
    BOSNIAN = "bs"
    BULGARIAN = "bg"
    CATALAN = "ca"
    CHINESE = "zh"
    CZECH = "cs"
    DANISH = "da"
    DUTCH = "nl"
    ENGLISH = "en"
    ESPERANTO = "eo"  # Note: Added based on common lists, confirm if exact
    ESTONIAN = "et"
    FAROESE = "fo"
    FINNISH = "fi"
    FRENCH = "fr"
    GALICIAN = "gl"
    GEORGIAN = "ka"
    GERMAN = "de"
    GREEK = "el"
    GUJARATI = "gu"
    HAUSA = "ha"
    HAWAIIAN = "haw"
    HEBREW = "he"
    HINDI = "hi"
    HUNGARIAN = "hu"
    ICELANDIC = "is"
    INDONESIAN = "id"
    ITALIAN = "it"
    JAPANESE = "ja"
    JAVANESE = "jw"
    KANNADA = "kn"
    KAZAKH = "kk"
    KHMER = "km"
    KOREAN = "ko"
    LAO = "lo"
    LATIN = "la"
    LATVIAN = "lv"
    LINGALA = "ln"
    LITHUANIAN = "lt"
    LUXEMBOURGISH = "lb"
    MACEDONIAN = "mk"
    MALAGASY = "mg"
    MALAY = "ms"
    MALAYALAM = "ml"
    MANDARIN_CHINESE = "zh"  # Alias for zh
    MAORI = "mi"
    MARATHI = "mr"
    MOLDOVAN = "ro"  # Romanian variant
    MONGOLIAN = "mn"
    MYANMAR = "my"
    NEPALI = "ne"
    NORWEGIAN = "no"
    OCCITAN = "oc"
    PASHTO = "ps"
    PERSIAN = "fa"
    POLISH = "pl"
    PORTUGUESE = "pt"
    PUNJABI = "pa"
    ROMANIAN = "ro"
    RUSSIAN = "ru"
    SCOTTISH_GAELIC = "gd"  # Added based on lists
    SERBIAN = "sr"
    SHONA = "sn"
    SLOVAK = "sk"
    SLOVENIAN = "sl"
    SOMALI = "so"
    SPANISH = "es"
    SUNDANESE = "su"
    SWAHILI = "sw"
    SWEDISH = "sv"
    TAGALOG = "tl"
    TAJIK = "tg"
    TAMIL = "ta"
    TARTAR = "tt"  # Tatar
    TELUGU = "te"
    THAI = "th"
    TIBETAN = "bo"
    TURKISH = "tr"
    TURKMEN = "tk"
    UKRAINIAN = "uk"
    URDU = "ur"
    UZBEK = "uz"
    VIETNAMESE = "vi"
    WELSH = "cy"
    YIDDISH = "yi"
    YORUBA = "yo"
    # Note: This list is based on Whisper's 99 supported languages. Some may have variants or aliases.


class ExportFormat(str, Enum):
    """Enum for supported export formats."""
    SRT = "srt"
    VTT = "vtt"
    TXT = "txt"
    CSV = "csv"
    JSON = "json"


class TranscriptionRequest(BaseModel):
    """Model for transcription request parameters."""
    language: TranscriptionLanguage = TranscriptionLanguage.AUTO
    quality: TranscriptionQuality = TranscriptionQuality.BALANCED
    export_format: ExportFormat = ExportFormat.SRT


class TranscriptionProgress(BaseModel):
    """Model for transcription progress updates."""
    task_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    progress: float = Field(ge=0, le=100, description="Progress percentage")
    current_step: str = Field(description="e.g., 'Extracting audio', 'Transcribing', 'Generating subtitles'")
    estimated_time_remaining: Optional[int] = None  # seconds


class Segment(BaseModel):
    """Model for a single transcription segment with timestamps."""
    start: float  # Start time in seconds
    end: float  # End time in seconds
    text: str


class TranscriptionResult(BaseModel):
    """Model for transcription result."""
    task_id: str
    text: str  # Full transcribed text
    language_detected: str  # Detected language code
    segments: list[Segment]  # List of segments with timestamps
    download_url: str  # URL or path to download the exported file
    export_format: ExportFormat