const API_BASE = 'http://localhost:8000'

export interface TranslationLanguage {
  code: string
  name: string
}

export const translationAPI = {
  async getLanguages(): Promise<TranslationLanguage[]> {
    const response = await fetch(`${API_BASE}/translate/languages`)
    const data = await response.json()
    
    return Object.entries(data.languages).map(([code, name]) => ({
      code,
      name: name as string
    }))
  },

  async translateSegments(
    segments: any[],
    sourceLang: string,
    targetLang: string
  ) {
    const response = await fetch(`${API_BASE}/translate/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments,
        source_lang: sourceLang,
        target_lang: targetLang
      })
    })

    if (!response.ok) {
      throw new Error('Translation failed')
    }

    return response.json()
  }
}