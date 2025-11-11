export enum TranscriptionQuality {
  /** Base model, ~30s for 1min audio */
  FAST = 'base',
  /** Small model, ~1min for 1min audio */
  BALANCED = 'small',
  /** Medium model, ~2min for 1min audio */
  DEEP = 'medium'
  // Note: 'large' and 'large-v3' could be added for higher quality if needed
}

export enum TranscriptionLanguage {
  /** Auto-detect language */
  AUTO = 'auto',
  /** Afrikaans */
  AFRIKAANS = 'af',
  /** Amharic */
  AMHARIC = 'am',
  /** Arabic */
  ARABIC = 'ar',
  /** Assamese */
  ASSAMESE = 'as',
  /** Azerbaijani */
  AZERBAIJANI = 'az',
  /** Bashkir */
  BASHKIR = 'ba',
  /** Belarusian */
  BELARUSIAN = 'be',
  /** Bengali */
  BENGALI = 'bn',
  /** Bosnian */
  BOSNIAN = 'bs',
  /** Bulgarian */
  BULGARIAN = 'bg',
  /** Catalan */
  CATALAN = 'ca',
  /** Chinese */
  CHINESE = 'zh',
  /** Czech */
  CZECH = 'cs',
  /** Danish */
  DANISH = 'da',
  /** Dutch */
  DUTCH = 'nl',
  /** English */
  ENGLISH = 'en',
  /** Esperanto */
  ESPERANTO = 'eo',
  /** Estonian */
  ESTONIAN = 'et',
  /** Faroese */
  FAROESE = 'fo',
  /** Finnish */
  FINNISH = 'fi',
  /** French */
  FRENCH = 'fr',
  /** Galician */
  GALICIAN = 'gl',
  /** Georgian */
  GEORGIAN = 'ka',
  /** German */
  GERMAN = 'de',
  /** Greek */
  GREEK = 'el',
  /** Gujarati */
  GUJARATI = 'gu',
  /** Hausa */
  HAUSA = 'ha',
  /** Hawaiian */
  HAWAIIAN = 'haw',
  /** Hebrew */
  HEBREW = 'he',
  /** Hindi */
  HINDI = 'hi',
  /** Hungarian */
  HUNGARIAN = 'hu',
  /** Icelandic */
  ICELANDIC = 'is',
  /** Indonesian */
  INDONESIAN = 'id',
  /** Italian */
  ITALIAN = 'it',
  /** Japanese */
  JAPANESE = 'ja',
  /** Javanese */
  JAVANESE = 'jw',
  /** Kannada */
  KANNADA = 'kn',
  /** Kazakh */
  KAZAKH = 'kk',
  /** Khmer */
  KHMER = 'km',
  /** Korean */
  KOREAN = 'ko',
  /** Lao */
  LAO = 'lo',
  /** Latin */
  LATIN = 'la',
  /** Latvian */
  LATVIAN = 'lv',
  /** Lingala */
  LINGALA = 'ln',
  /** Lithuanian */
  LITHUANIAN = 'lt',
  /** Luxembourgish */
  LUXEMBOURGISH = 'lb',
  /** Macedonian */
  MACEDONIAN = 'mk',
  /** Malagasy */
  MALAGASY = 'mg',
  /** Malay */
  MALAY = 'ms',
  /** Malayalam */
  MALAYALAM = 'ml',
  /** Mandarin Chinese (alias for zh) */
  MANDARIN_CHINESE = 'zh',
  /** Maori */
  MAORI = 'mi',
  /** Marathi */
  MARATHI = 'mr',
  /** Moldovan (Romanian variant) */
  MOLDOVAN = 'ro',
  /** Mongolian */
  MONGOLIAN = 'mn',
  /** Myanmar */
  MYANMAR = 'my',
  /** Nepali */
  NEPALI = 'ne',
  /** Norwegian */
  NORWEGIAN = 'no',
  /** Occitan */
  OCCITAN = 'oc',
  /** Pashto */
  PASHTO = 'ps',
  /** Persian */
  PERSIAN = 'fa',
  /** Polish */
  POLISH = 'pl',
  /** Portuguese */
  PORTUGUESE = 'pt',
  /** Punjabi */
  PUNJABI = 'pa',
  /** Romanian */
  ROMANIAN = 'ro',
  /** Russian */
  RUSSIAN = 'ru',
  /** Scottish Gaelic */
  SCOTTISH_GAELIC = 'gd',
  /** Serbian */
  SERBIAN = 'sr',
  /** Shona */
  SHONA = 'sn',
  /** Slovak */
  SLOVAK = 'sk',
  /** Slovenian */
  SLOVENIAN = 'sl',
  /** Somali */
  SOMALI = 'so',
  /** Spanish */
  SPANISH = 'es',
  /** Sundanese */
  SUNDANESE = 'su',
  /** Swahili */
  SWAHILI = 'sw',
  /** Swedish */
  SWEDISH = 'sv',
  /** Tagalog */
  TAGALOG = 'tl',
  /** Tajik */
  TAJIK = 'tg',
  /** Tamil */
  TAMIL = 'ta',
  /** Tatar */
  TARTAR = 'tt',
  /** Telugu */
  TELUGU = 'te',
  /** Thai */
  THAI = 'th',
  /** Tibetan */
  TIBETAN = 'bo',
  /** Turkish */
  TURKISH = 'tr',
  /** Turkmen */
  TURKMEN = 'tk',
  /** Ukrainian */
  UKRAINIAN = 'uk',
  /** Urdu */
  URDU = 'ur',
  /** Uzbek */
  UZBEK = 'uz',
  /** Vietnamese */
  VIETNAMESE = 'vi',
  /** Welsh */
  WELSH = 'cy',
  /** Yiddish */
  YIDDISH = 'yi',
  /** Yoruba */
  YORUBA = 'yo'
  // Note: This enum covers all 99 languages supported by OpenAI Whisper. Some may have variants or aliases.
}

export enum ExportFormat {
  SRT = 'srt',
  VTT = 'vtt',
  TXT = 'txt',
  CSV = 'csv',
  JSON = 'json'
}

export interface TranscriptionRequest {
  /** Language for transcription (defaults to AUTO if omitted) */
  language?: TranscriptionLanguage;
  /** Quality level for transcription (defaults to BALANCED if omitted) */
  quality?: TranscriptionQuality;
  /** Export format (defaults to SRT if omitted) */
  export_format?: ExportFormat;
}

export interface TranscriptionProgress {
  task_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step, e.g., 'Extracting audio', 'Transcribing', 'Generating subtitles' */
  current_step: string;
  /** Estimated time remaining in seconds */
  estimated_time_remaining?: number;
}

export interface Segment {
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Transcribed text for this segment */
  text: string;
}

export interface TranscriptionResult {
  task_id: string;
  /** Full transcribed text */
  text: string;
  /** Detected language code */
  language_detected: string;
  /** List of segments with timestamps */
  segments: Segment[];
  /** URL or path to download the exported file */
  download_url: string;
  export_format: ExportFormat;
}