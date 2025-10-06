/**
 * Mobile file upload zone - Tap to select files
 */

export interface MobileFileUploadZoneProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  error: string | null
}

export function MobileFileUploadZone({ onFileSelect, error }: MobileFileUploadZoneProps) {
  return (
    <div>
      <input
        type="file"
        id="file-input"
        accept="video/*,audio/*"
        onChange={onFileSelect}
        className="hidden"
      />
      <label htmlFor="file-input" className="block cursor-pointer">
        <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:border-blue-400/50 hover:bg-blue-500/5 transition-all">
          <svg className="w-16 h-16 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-white font-semibold mb-2">Tap to select file</p>
          <p className="text-sm text-gray-400">Video or audio files</p>
        </div>
      </label>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}