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
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{file.name}</p>
            <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Uploading...</span>
              <span className="text-blue-400 font-medium">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
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
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Upload complete! Desktop notified via CRDT</span>
            </div>
            <button
              onClick={onStartTranscription}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl"
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
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onUpload}
            disabled={uploading || success}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : success ? 'Done!' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  )
}