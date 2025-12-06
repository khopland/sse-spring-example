import { useEffect, useRef } from 'react'
import { sseStore } from './useSSE.store'

export interface SSEMessage {
  event: string
  data: string
  id?: string
  comment?: string
}

const MAX_RECONNECT_DELAY = 30000
const INITIAL_RECONNECT_DELAY = 1000
const FETCH_TIMEOUT = 10000

// SSE line prefixes for parsing
const SSE_PREFIXES = {
  event: 'event:',
  data: 'data:',
  id: 'id:',
  comment: ':',
} as const

type StartConnectionParams = {
  connectionId: string
  url: string
  clientId: string
  abortController: AbortController
  onMessage: (message: SSEMessage) => void
  onError?: (error: Event) => void
}

function startConnection({
  connectionId,
  url,
  clientId,
  abortController,
  onMessage,
  onError,
}: StartConnectionParams) {
  let currentEvent = ''
  let currentData = ''
  let currentId = ''
  let currentComment = ''

  const resetMessage = () => {
    currentEvent = ''
    currentData = ''
    currentId = ''
    currentComment = ''
  }

  const scheduleReconnect = () => {
    sseStore.clearReconnectTimer(connectionId)

    if (abortController.signal.aborted || sseStore.getIsConnecting(connectionId)) {
      return
    }

    const currentDelay = sseStore.getReconnectDelay(connectionId) || INITIAL_RECONNECT_DELAY

    sseStore.updateConnectionStatus(
      connectionId,
      'reconnecting',
      currentDelay,
    )

    sseStore.scheduleReconnectTimer(connectionId, currentDelay, () => {
      if (!abortController.signal.aborted) {
        connect()
      }
    })

    sseStore.setReconnectDelay(
      connectionId,
      Math.min(currentDelay * 2, MAX_RECONNECT_DELAY),
    )
  }

  const connect = async () => {
    if (sseStore.getIsConnecting(connectionId)) {
      return
    }

    sseStore.setIsConnecting(connectionId, true)
    sseStore.updateConnectionStatus(connectionId, 'connecting')

    try {
      const fetchPromise = fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          klientId: clientId,
        },
        signal: abortController.signal,
      })

      // Capture timeout id to ensure proper cleanup
      let timeoutId: number | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error('Fetch timeout: Request took longer than 10 seconds'))
        }, FETCH_TIMEOUT)
      })

      let response: Response
      try {
        response = (await Promise.race([fetchPromise, timeoutPromise])) as Response
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId)
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null - not a valid SSE stream')
      }

      sseStore.updateConnectionStatus(connectionId, 'connected')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          sseStore.setIsConnecting(connectionId, false)
          sseStore.updateConnectionStatus(connectionId, 'disconnected')
          scheduleReconnect()
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith(SSE_PREFIXES.event)) {
            currentEvent = line.substring(SSE_PREFIXES.event.length).trim()
          } else if (line.startsWith(SSE_PREFIXES.data)) {
            currentData = line.substring(SSE_PREFIXES.data.length).trim()
          } else if (line.startsWith(SSE_PREFIXES.id)) {
            currentId = line.substring(SSE_PREFIXES.id.length).trim()
          } else if (line.startsWith(SSE_PREFIXES.comment)) {
            currentComment = line.substring(SSE_PREFIXES.comment.length).trim()
          } else if (line === '') {
            if (currentData) {
              const message: SSEMessage = {
                event: currentEvent || 'message',
                data: currentData,
                id: currentId || undefined,
                comment: currentComment || undefined,
              }
              sseStore.addMessage(connectionId, message)
              onMessage(message)
              resetMessage()
            }
          }
        }
      }
    } catch (error) {
      sseStore.setIsConnecting(connectionId, false)

      // Suppress abort errors (expected during cleanup)
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      // Normalize error to Error instance
      const errorObj = error instanceof Error ? error : new Error(String(error))
      sseStore.addError(connectionId, errorObj)
      sseStore.updateConnectionStatus(connectionId, 'error')

      console.error('SSE error:', error)
      if (onError) {
        onError(error as Event)
      }

      scheduleReconnect()
    }
  }

  connect()
}

export function useSSE(
  url: string,
  clientId: string,
  onMessage: (message: SSEMessage) => void,
  onError?: (error: Event) => void,
) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const connectionIdRef = useRef<string>(
    `sse-${btoa(`${clientId}`).replace(/[+/=]/g, '')}`,
  )


  useEffect(() => {
    const connectionId = connectionIdRef.current

    // If an active controller exists, another hook/consumer already manages this connection.
    if (sseStore.hasActiveConnection(connectionId)) return

    // If there's a leftover connection record without an active controller, remove it.
    if (sseStore.getConnection(connectionId) && !sseStore.hasActiveConnection(connectionId)) {
      sseStore.unregisterConnection(connectionId)
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const registered = sseStore.registerConnection(
      connectionId,
      url,
      clientId,
      abortController,
    )
    if (!registered) {
      return
    }

    // start the connection worker for this registration
    startConnection({
      connectionId,
      url,
      clientId,
      abortController,
      onMessage,
      onError,
    })

    return () => {
      sseStore.unregisterConnection(connectionId, () => {
        abortController.abort()
        sseStore.resetConnectionState(connectionId)
      })
    }
  }, [url, clientId])
}
