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

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Fetch timeout: Request took longer than 10 seconds'))
        }, FETCH_TIMEOUT)
      })

      const response = await Promise.race([fetchPromise, timeoutPromise])

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
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim()
          } else if (line.startsWith('data:')) {
            currentData = line.substring(5).trim()
          } else if (line.startsWith('id:')) {
            currentId = line.substring(3).trim()
          } else if (line.startsWith(':')) {
            currentComment = line.substring(1).trim()
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
              currentEvent = ''
              currentData = ''
              currentId = ''
              currentComment = ''
            }
          }
        }
      }
    } catch (error) {
      sseStore.setIsConnecting(connectionId, false)

      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

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

    const existingController = sseStore.getAbortController(connectionId)
    if (existingController && !existingController.signal.aborted) {
      return
    }

    const existingConnection = sseStore.getConnection(connectionId)
    if (existingConnection && (!existingController || existingController.signal.aborted)) {
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
        sseStore.clearReconnectTimer(connectionId)
        sseStore.setReconnectDelay(connectionId, INITIAL_RECONNECT_DELAY)
        sseStore.setIsConnecting(connectionId, false)
      })
    }
  }, [url, clientId])
}
