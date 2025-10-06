import { motion, AnimatePresence } from 'framer-motion'

/**
 * Props for FileUploadZone component
 */
interface FileUploadZoneProps {
  selectedFile: File | null
  isDragging: boolean
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onRemoveFile: () => void
  disabled?: boolean
  inputId?: string
}

/**
 * File upload zone with drag & drop support
 * 
 * Features:
 * - Drag and drop interface
 * - File type indicators
 * - Selected file preview
 * - Smooth animations
 * - Accessible (keyboard navigation, ARIA labels)
 * 
 * @example
 * <FileUploadZone
 *   selectedFile={fileUpload.selectedFile}
 *   isDragging={fileUpload.isDragging}
 *   onFileSelect={fileUpload.handleFileSelect}
 *   onDragOver={fileUpload.handleDragOver}
 *   onDragLeave={fileUpload.handleDragLeave}
 *   onDrop={fileUpload.handleDrop}
 *   onRemoveFile={() => fileUpload.setSelectedFile(null)}
 * />
 */
export const FileUploadZone = ({
  selectedFile,
  isDragging,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveFile,
  disabled = false,
  inputId = 'file-input'
}: FileUploadZoneProps) => {
  return (
    <div
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      onClick={disabled ? undefined : () => document.getElementById(inputId)?.click()}
      className={`
        relative overflow-hidden backdrop-blur-xl bg-white/5 
        border border-white/10 rounded-3xl p-16 text-center
        transition-all duration-500 ease-out
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isDragging 
          ? 'border-blue-400/50 bg-blue-500/10 shadow-2xl shadow-blue-500/50 scale-[1.02]' 
          : 'hover:border-white/20 hover:bg-white/8 hover:shadow-xl hover:shadow-black/20'
        }
      `}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="File upload zone"
      aria-disabled={disabled}
    >
      <input
        id={inputId}
        type="file"
        accept="video/*,audio/*"
        onChange={onFileSelect}
        className="hidden"
        aria-label="File upload input"
        disabled={disabled}
      />
      
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6">
        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">{selectedFile.name}</h3>
                <p className="text-sm text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveFile()
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all duration-200"
                aria-label="Remove selected file"
                disabled={disabled}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remove file
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  {isDragging ? 'Drop your file here' : 'Upload audio or video'}
                </h3>
                <p className="text-gray-400">Drag and drop or click to browse</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                {['MP4', 'AVI', 'MOV', 'MP3', 'WAV', 'M4A'].map(fmt => (
                  <span key={fmt} className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">{fmt}</span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}