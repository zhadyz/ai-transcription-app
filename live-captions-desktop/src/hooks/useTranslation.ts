/**
 * Translation hook - intelligent batching, caching, and streaming WITH DEBUGGING
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { LRUCache } from '../core/FileOperationEngine'
import { TranscriptionSegment } from './useTranscription'

interface Language {
  code: string
  name: string
}

const CACHE_SIZE = 1000
const BATCH_SIZE = 50

export const useTranslation = (backendUrl: string) => {
  const [translatedSegments, setTranslatedSegments] = useState<TranscriptionSegment[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([])
  const [error, setError] = useState<string | null>(null)

  const cacheRef = useRef<LRUCache<string, string>>(new LRUCache(CACHE_SIZE))
  const abortRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  const cache = cacheRef.current

  useEffect(() => {
    isMountedRef.current = true
    const controller = new AbortController()

    fetch(`${backendUrl}/translate/languages`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (isMountedRef.current) {
          setAvailableLanguages(
            Object.entries(data.languages).map(([code, name]) => ({
              code,
              name: name as string
            }))
          )
        }
      })
      .catch(() => {})

    return () => {
      isMountedRef.current = false
      controller.abort()
    }
  }, [backendUrl])

  const getCacheKey = useCallback((text: string, source: string, target: string) => {
    return `${source}:${target}:${text}`
  }, [])

  const translate = useCallback(
    async (segments: TranscriptionSegment[], sourceLang: string, targetLang: string) => {
      console.group('🌐 [Translation] Starting')
      console.log('Input segments:', segments)
      console.log('Is array:', Array.isArray(segments))
      console.log('Length:', segments?.length)
      console.log('Source lang:', sourceLang)
      console.log('Target lang:', targetLang)
      console.groupEnd()

      // SAFETY CHECK
      if (!segments || !Array.isArray(segments)) {
        console.error('❌ [Translation] segments is not an array:', segments)
        setError('Invalid segments data')
        return
      }

      if (!segments?.length) {
        setError('No segments to translate')
        return
      }

      setIsTranslating(true)
      setError(null)

      abortRef.current = new AbortController()

      try {
        const results: TranscriptionSegment[] = []
        const uncached: { segment: TranscriptionSegment; index: number }[] = []

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          
          if (!seg || typeof seg !== 'object') {
            console.error('❌ [Translation] Invalid segment at index', i, ':', seg)
            continue
          }

          const key = getCacheKey(seg.text, sourceLang, targetLang)
          const cached = cache.get(key)

          if (cached) {
            results[i] = { ...seg, text: cached }
          } else {
            uncached.push({ segment: seg, index: i })
          }
        }

        console.log('📊 [Translation] Cache stats:', {
          total: segments.length,
          cached: segments.length - uncached.length,
          uncached: uncached.length
        })

        if (uncached.length === 0) {
          console.log('✅ [Translation] All segments cached')
          if (isMountedRef.current) {
            setTranslatedSegments(results)
            setShowTranslation(true)
            setIsTranslating(false)
          }
          return
        }

        const batches: typeof uncached[] = []
        for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
          batches.push(uncached.slice(i, i + BATCH_SIZE))
        }

        console.log('📦 [Translation] Processing', batches.length, 'batches')

        for (const batch of batches) {
          console.log('📤 [Translation] Sending batch of', batch.length, 'segments')
          
          const response = await fetch(`${backendUrl}/translate/segments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              segments: batch.map(b => b.segment),
              source_lang: sourceLang,
              target_lang: targetLang
            }),
            signal: abortRef.current.signal
          })

          if (!response.ok) throw new Error('Translation failed')

          const data = await response.json()
          console.log('📥 [Translation] Received response:', data)

          if (!data.segments || !Array.isArray(data.segments)) {
            console.error('❌ [Translation] Response segments is not an array:', data.segments)
            throw new Error('Invalid translation response')
          }

          if (!data.segments?.length) {
            console.error('❌ [Translation] No translation data in response')
            throw new Error('No translation data')
          }

          batch.forEach((item, i) => {
            const translated = data.segments[i]
            
            if (!translated || typeof translated !== 'object') {
              console.error('❌ [Translation] Invalid translated segment at index', i, ':', translated)
              return
            }

            results[item.index] = translated

            const key = getCacheKey(item.segment.text, sourceLang, targetLang)
            cache.set(key, translated.text)
          })
        }

        console.log('✅ [Translation] Complete, setting', results.length, 'segments')
        console.log('Results:', results)

        if (isMountedRef.current) {
          setTranslatedSegments(results)
          setShowTranslation(true)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && isMountedRef.current) {
          console.error('❌ [Translation] Error:', err)
          setError('Translation failed')
        }
      } finally {
        if (isMountedRef.current) {
          setIsTranslating(false)
        }
        abortRef.current = null
      }
    },
    [backendUrl, cache, getCacheKey]
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setTranslatedSegments([])
    setIsTranslating(false)
    setShowTranslation(false)
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const cacheStats = useMemo(
    () => ({
      size: cache.getSize(),
      hitRate: cache.getSize() / CACHE_SIZE
    }),
    [cache]
  )

  return {
    translatedSegments,
    isTranslating,
    showTranslation,
    targetLanguage,
    availableLanguages,
    error,
    cacheStats,
    translate,
    setShowTranslation,
    setTargetLanguage,
    reset
  }
}

export const getLanguageName = (code: string): string => {
  const names: Record<string, string> = {
    ar: 'Arabic',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    zh: 'Chinese',
    de: 'German',
    ja: 'Japanese',
    ru: 'Russian',
    hi: 'Hindi',
    pt: 'Portuguese',
    bn: 'Bengali',
    ko: 'Korean',
    it: 'Italian',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish'
  }
  return names[code] || code.toUpperCase()
}

export default useTranslation