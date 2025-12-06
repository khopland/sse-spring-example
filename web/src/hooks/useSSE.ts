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

export function useSSE(
  url: string,
  clientId: string,
  onMessage: (message: SSEMessage) => void,
  onError?: (error: Event) => void,
) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectDelayRef = useRef<number>(INITIAL_RECONNECT_DELAY)
  const isConnectingRef = useRef<boolean>(false)
  const connectionIdRef = useRef<string>(
    `sse-${btoa(`${url}:${clientId}`).replace(/[+/=]/g, '')}`,
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

    let currentEvent = ''
    let currentData = ''
    let currentId = ''
    let currentComment = ''

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      if (abortController.signal.aborted || isConnectingRef.current) {
        return
      }

      sseStore.updateConnectionStatus(
        connectionId,
        'reconnecting',
        reconnectDelayRef.current,
      )

      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (!abortController.signal.aborted) {
          connect()
        }
      }, reconnectDelayRef.current)

      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY,
      )
    }

    const connect = async () => {
      if (isConnectingRef.current) {
        return
      }

      isConnectingRef.current = true
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

        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        sseStore.updateConnectionStatus(connectionId, 'connected')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            isConnectingRef.current = false
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
        isConnectingRef.current = false

        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        const errorObj =
          error instanceof Error ? error : new Error(String(error))
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

    return () => {
      sseStore.unregisterConnection(connectionId, () => {
        abortController.abort()
        if (reconnectTimeoutRef.current !== null) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        isConnectingRef.current = false
      })
    }
  }, [url, clientId])
}
