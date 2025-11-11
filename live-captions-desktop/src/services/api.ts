import {
  TranscriptionRequest,
  TranscriptionProgress,
  TranscriptionResult,
} from '../types/transcription.types'

const hostname = window.location.hostname
const API_BASE = `http://${hostname}:8000`

export const transcriptionAPI = {
  async uploadFile(
    file: File,
    options: TranscriptionRequest
  ): Promise<{ task_id: string; status: string; message: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', options.language || 'auto')
    formData.append('quality', options.quality || 'small')
    formData.append('export_format', options.export_format || 'srt')

    const response = await fetch(`${API_BASE}/transcribe/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    return response.json()
  },

  async getProgress(taskId: string): Promise<TranscriptionProgress> {
    const response = await fetch(`${API_BASE}/transcribe/progress/${taskId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to get progress: ${response.statusText}`)
    }

    return response.json()
  },

  async getResult(taskId: string): Promise<TranscriptionResult> {
    const response = await fetch(`${API_BASE}/transcribe/result/${taskId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to get result: ${response.statusText}`)
    }

    return response.json()
  },

  getDownloadUrl(taskId: string): string {
    return `${API_BASE}/transcribe/download/${taskId}`
  },
}