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
      <label htmlFor="file-input" className="block cursor-pointer group">
        <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-12 text-center transition-all duration-300 hover:border-blue-400/40 hover:bg-gradient-to-br hover:from-blue-500/5 hover:to-purple-500/5 active:scale-[0.98]">
          {/* Glow Effect on Hover */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-xl -z-10" />

          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-2">Select File</p>
            <p className="text-sm text-gray-400">Audio or video files supported</p>
          </div>
        </div>
      </label>

      {error && (
        <div className="mt-4 p-4 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}