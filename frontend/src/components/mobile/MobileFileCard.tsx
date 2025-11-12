/**
 * Mobile file card - Shows selected file with upload progress
 */

import { motion } from 'framer-motion'

export interface MobileFileCardProps {
  file: File
  uploading: boolean
  uploadProgress: number
  success: boolean
  onCancel: () => void
  onUpload: () => void
  onStartTranscription: () => void
  hasTaskId: boolean
}

export function MobileFileCard({
  file,
  uploading,
  uploadProgress,
  success,
  onCancel,
  onUpload,
  onStartTranscription,
  hasTaskId
}: MobileFileCardProps) {
  return (
    <div>
      <div className="bg-gradient-to-b from-white/3 via-black/10 to-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-lg" style={{ boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-light truncate text-sm tracking-tight">{file.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500 font-light">Uploading</span>
              <span className="text-blue-400 font-light">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {success && !hasTaskId && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-400/80">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-light text-sm tracking-tight">Upload Complete</span>
            </div>
            <button
              onClick={onStartTranscription}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600/90 to-blue-500/90 text-white font-light text-sm rounded-2xl shadow-lg shadow-black/30 hover:shadow-lg/50 transition-all duration-300"
              style={{ boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)' }}
            >
              Start Transcription
            </button>
          </div>
        )}
      </div>

      {!success && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            disabled={uploading}
            className="px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-2xl font-light text-sm hover:bg-white/10 transition-colors duration-300 disabled:opacity-50"
            style={{ boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.15)' }}
          >
            Cancel
          </button>
          <button
            onClick={onUpload}
            disabled={uploading || success}
            className="px-6 py-3 bg-gradient-to-r from-blue-600/90 to-blue-500/90 text-white font-light text-sm rounded-2xl shadow-lg shadow-black/30 hover:shadow-lg/50 transition-all duration-300 disabled:opacity-50"
            style={{ boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)' }}
          >
            {uploading ? 'Uploading' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  )
}