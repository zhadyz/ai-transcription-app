import { memo, useMemo } from 'react'
import { TranscriptionLanguage, TranscriptionQuality, ExportFormat } from '../../types/transcription.types'

/**
 * Top 10 most commonly used languages (by # of speakers globally)
 * These appear first in the dropdown for optimal UX
 */
const TOP_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'es', name: 'Spanish' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'fr', name: 'French' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'de', name: 'German' },
  { code: 'ko', name: 'Korean' }
] as const

/**
 * Complete Whisper language support (99 languages)
 * Alphabetically sorted for "All Languages" section
 * Source: OpenAI Whisper model specifications
 */
const ALL_LANGUAGES = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic' },
  { code: 'as', name: 'Assamese' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'ba', name: 'Bashkir' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bo', name: 'Tibetan' },
  { code: 'br', name: 'Breton' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'cs', name: 'Czech' },
  { code: 'cy', name: 'Welsh' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'eu', name: 'Basque' },
  { code: 'fa', name: 'Persian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fo', name: 'Faroese' },
  { code: 'fr', name: 'French' },
  { code: 'gl', name: 'Galician' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ha', name: 'Hausa' },
  { code: 'haw', name: 'Hawaiian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hr', name: 'Croatian' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jw', name: 'Javanese' },
  { code: 'ka', name: 'Georgian' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'km', name: 'Khmer' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'la', name: 'Latin' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'ln', name: 'Lingala' },
  { code: 'lo', name: 'Lao' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'mi', name: 'Maori' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ms', name: 'Malay' },
  { code: 'mt', name: 'Maltese' },
  { code: 'my', name: 'Myanmar' },
  { code: 'ne', name: 'Nepali' },
  { code: 'nl', name: 'Dutch' },
  { code: 'nn', name: 'Norwegian Nynorsk' },
  { code: 'no', name: 'Norwegian' },
  { code: 'oc', name: 'Occitan' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'pl', name: 'Polish' },
  { code: 'ps', name: 'Pashto' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sn', name: 'Shona' },
  { code: 'so', name: 'Somali' },
  { code: 'sq', name: 'Albanian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'tg', name: 'Tajik' },
  { code: 'th', name: 'Thai' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tr', name: 'Turkish' },
  { code: 'tt', name: 'Tatar' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' }
] as const

/**
 * Quality presets with performance characteristics
 */
const QUALITY_PRESETS = [
  { value: 'base', label: 'Fast (~30s/min)', description: 'Good for quick drafts' },
  { value: 'small', label: 'Balanced (~1min/min)', description: 'Recommended for most use cases' },
  { value: 'medium', label: 'Deep (~2min/min)', description: 'Higher accuracy' },
  { value: 'large-v2', label: 'Ultra Deep (~4min/min)', description: 'Professional quality' },
  { value: 'large-v3', label: 'Maximum Quality (~5min/min)', description: 'Best possible accuracy' }
] as const

/**
 * Export format options
 */
const EXPORT_FORMATS = [
  { value: 'srt', label: 'SRT (Subtitles)', description: 'Standard subtitle format' },
  { value: 'vtt', label: 'VTT (Web Video)', description: 'WebVTT format' },
  { value: 'txt', label: 'TXT (Plain Text)', description: 'Simple text file' },
  { value: 'csv', label: 'CSV (Spreadsheet)', description: 'Excel compatible' },
  { value: 'json', label: 'JSON (Data)', description: 'Structured data' }
] as const

/**
 * Props for TranscriptionSettings component
 */
interface TranscriptionSettingsProps {
  language: string
  quality: string
  format: string
  onLanguageChange: (lang: string) => void
  onQualityChange: (quality: string) => void
  onFormatChange: (format: string) => void
  disabled?: boolean
}

/**
 * Transcription settings component with intelligent language prioritization
 * 
 * Features:
 * - 99 Whisper languages with smart UX (top 12 languages shown first)
 * - Quality presets with performance indicators
 * - Multiple export formats
 * - Responsive 3-column grid layout
 * - Custom styled selects with accessibility
 * - Memoized for optimal performance
 * - Help text for each option
 * 
 * UX Design:
 * 1. Auto-detect (default, always on top)
 * 2. Top 12 most common languages (90% of users)
 * 3. Separator
 * 4. All 99 languages alphabetically (for edge cases)
 * 
 * @example
 * <TranscriptionSettings
 *   language={language}
 *   quality={quality}
 *   format={format}
 *   onLanguageChange={setLanguage}
 *   onQualityChange={setQuality}
 *   onFormatChange={setFormat}
 *   disabled={isProcessing}
 * />
 */
export const TranscriptionSettings = memo(({
  language,
  quality,
  format,
  onLanguageChange,
  onQualityChange,
  onFormatChange,
  disabled = false
}: TranscriptionSettingsProps) => {
  // Memoize select styling for performance
  const selectClassName = useMemo(() => `
    w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 
    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
    transition-all appearance-none cursor-pointer hover:bg-black/50 
    disabled:opacity-50 disabled:cursor-not-allowed
  `, [])

  const selectStyle = useMemo(() => ({
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1.25rem'
  }), [])

  // Memoize "other languages" list (exclude top languages to avoid duplicates)
  const otherLanguages = useMemo(() => {
    const topCodes = new Set(TOP_LANGUAGES.map(l => l.code))
    return ALL_LANGUAGES.filter(lang => !topCodes.has(lang.code))
  }, [])

  return (
    <div className="space-y-6">
      <h4 className="text-lg font-semibold text-white">Transcription Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Language Selection - Smart Prioritization */}
        <div className="space-y-2">
          <label htmlFor="language-select" className="block text-sm font-medium text-gray-400">
            Language
          </label>
          <select 
            id="language-select"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={disabled}
            className={selectClassName}
            style={selectStyle}
            aria-label="Select transcription language"
          >
            {/* Auto-detect (always first) */}
            <option value="auto">Auto-detect</option>
            
            {/* Separator */}
            <option disabled>──── Most Common ────</option>
            
            {/* Top 12 languages (90% of use cases) */}
            {TOP_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
            
            {/* Separator */}
            <option disabled>──── All Languages (A-Z) ────</option>
            
            {/* Remaining 87 languages alphabetically */}
            {otherLanguages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">99 languages • Auto-detect recommended</p>
        </div>

        {/* Quality Selection */}
        <div className="space-y-2">
          <label htmlFor="quality-select" className="block text-sm font-medium text-gray-400">
            Quality
          </label>
          <select 
            id="quality-select"
            value={quality}
            onChange={(e) => onQualityChange(e.target.value)}
            disabled={disabled}
            className={selectClassName}
            style={selectStyle}
            aria-label="Select transcription quality"
          >
            {QUALITY_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {QUALITY_PRESETS.find(p => p.value === quality)?.description || 'Select quality'}
          </p>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label htmlFor="format-select" className="block text-sm font-medium text-gray-400">
            Export Format
          </label>
          <select 
            id="format-select"
            value={format}
            onChange={(e) => onFormatChange(e.target.value)}
            disabled={disabled}
            className={selectClassName}
            style={selectStyle}
            aria-label="Select export format"
          >
            {EXPORT_FORMATS.map(fmt => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {EXPORT_FORMATS.find(f => f.value === format)?.description || 'Select format'}
          </p>
        </div>
      </div>
    </div>
  )
})

TranscriptionSettings.displayName = 'TranscriptionSettings'