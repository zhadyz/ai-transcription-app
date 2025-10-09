import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useSessionContext } from './SessionContext'

interface WebSocketContextValue {
  socket: WebSocket | null
  isConnected: boolean
  sendMessage: (message: any) => void
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
  sendMessage: () => {}
})

export const useWebSocket = () => useContext(WebSocketContext)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useSessionContext()
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!sessionId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = window.location.port === '5173' ? '8000' : window.location.port
    const wsUrl = `${protocol}//${host}:${port}/ws/${sessionId}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setIsConnected(true)
      ws.send(JSON.stringify({ type: 'subscribe' }))
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    ws.onerror = () => {
      setIsConnected(false)
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [sessionId])

  const sendMessage = useCallback((message: any) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message))
    }
  }, [socket, isConnected])

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}