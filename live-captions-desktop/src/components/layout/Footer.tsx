/**
 * Desktop footer component
 *
 * Features:
 * - GitHub and LinkedIn links
 * - Terms and Privacy links
 * - Copyright notice
 * - Responsive layout
 */
import faviconIcon from '../../assets/favicon.ico'
import { open } from '@tauri-apps/plugin-shell'

export const Footer = () => {
  const openUrl = async (url: string) => {
    try {
      await open(url)
    } catch (error) {
      console.error('Failed to open URL:', error)
    }
  }
  return (
    <footer role="contentinfo" className="mt-auto border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-3 ml-80">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2">
            <img src={faviconIcon} alt="OnyxLab Logo" className="w-5 h-5" />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.2em]"
              style={{ color: "rgba(200, 140, 35, 0.4)" }}
            >
              © {new Date().getFullYear()}{' '}
              <span
                style={{
                  background: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #7c3aed 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }}
              >
                Onyxlab
              </span>
              . All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => openUrl('https://github.com/zhadyz/ai-transcription-app/')}
              className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-300 group cursor-pointer"
              style={{ color: "rgba(200, 140, 35, 0.6)" }}
              aria-label="Visit GitHub repository"
            >
              <svg
                className="w-4 h-4 group-hover:scale-110 transition-transform duration-300"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(200, 140, 35, 0.3))"
                }}
              >
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span
                className="group-hover:text-amber-300 transition-colors duration-300"
                style={{
                  textShadow: "0 0 10px rgba(200, 140, 35, 0.3)"
                }}
              >
                GitHub
              </span>
            </button>
          </div>

          <div className="flex items-center gap-5">
            <button
              onClick={() => openUrl('https://onyxlab.ai/terms')}
              className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-300 group cursor-pointer"
              style={{ color: "rgba(200, 140, 35, 0.6)" }}
              aria-label="View Terms of Service"
            >
              <svg
                className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(200, 140, 35, 0.3))"
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span
                className="group-hover:text-amber-300 transition-colors duration-300"
                style={{
                  textShadow: "0 0 10px rgba(200, 140, 35, 0.3)"
                }}
              >
                Terms
              </span>
            </button>
            <button
              onClick={() => openUrl('https://onyxlab.ai/privacy')}
              className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-300 group cursor-pointer"
              style={{ color: "rgba(200, 140, 35, 0.6)" }}
              aria-label="View Privacy Policy"
            >
              <svg
                className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(200, 140, 35, 0.3))"
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span
                className="group-hover:text-amber-300 transition-colors duration-300"
                style={{
                  textShadow: "0 0 10px rgba(200, 140, 35, 0.3)"
                }}
              >
                Privacy
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}