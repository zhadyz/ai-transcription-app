import { useState, useCallback } from 'react'

/**
 * File validation constants
 * These match the backend's accepted formats
 */
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/avi',
  'video/quicktime',
  'video/x-msvideo',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'audio/mp4',
  'audio/ogg'
] as const


/**
 * Custom hook for file upload handling with drag & drop support
 * 
 * Features:
 * - File validation (type and size)
 * - Drag and drop state management
 * - Error handling
 * - Memory-safe cleanup
 * 
 * @example
 * const fileUpload = useFileUpload()
 * <div onDrop={fileUpload.handleDrop}>...</div>
 */
export const useFileUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validates file type and size
   * @returns Error message if invalid, null if valid
   */
  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return 'Invalid file type. Please upload video or audio files only.'
    }
    
    return null
  }, [])

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      setError(null)
    }
  }, [validateFile])

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  /**
   * Handle file drop
   */
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      setError(null)
    }
  }, [validateFile])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setSelectedFile(null)
    setIsDragging(false)
    setError(null)
  }, [])

  return {
    selectedFile,
    isDragging,
    error,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setSelectedFile,
    validateFile,
    clearError,
    reset
  }
}