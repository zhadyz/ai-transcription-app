/**
 * Mobile error screen - Displays error messages
 */

export interface MobileErrorScreenProps {
  title: string
  message: string
}

export function MobileErrorScreen({ title, message }: MobileErrorScreenProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-md text-center">
        <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  )
}