/**
 * Session management hook - now consumes SessionContext
 * 
 * BEFORE: Created DistributedSession directly (WebSocket #1)
 * AFTER: Consumes shared session from context (no WebSocket duplication)
 */

import { useSessionContext } from '@/core/SessionContext'

/**
 * Hook to access the shared session.
 * 
 * This hook now simply returns the session from context.
 * All session creation, management, and recovery logic lives in SessionContext.
 * 
 * @param backendUrl - Ignored (kept for backward compatibility, context handles this)
 * @returns Session state and controls
 */
export function useSession(_backendUrl?: string) {
  return useSessionContext()
}

export default useSession