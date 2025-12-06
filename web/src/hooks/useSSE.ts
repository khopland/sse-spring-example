import { useEffect, useRef } from 'react'

export interface SSEMessage {
  event: string
  data: string
  id?: string
  comment?: string
}

export function useSSE(
  url: string,
  clientId: string,
  onMessage: (message: SSEMessage) => void,
  onError?: (error: Event) => void,
) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectDelayRef = useRef<number>(1000) // Start with 1 second
  const isConnectingRef = useRef<boolean>(false)

  // Keep refs up to date without triggering re-connection
  useEffect(() => {
    onMessageRef.current = onMessage
    onErrorRef.current = onError
  }, [onMessage, onError])

  useEffect(() => {
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    let currentEvent = ''
    let currentData = ''
    let currentId = ''
    let currentComment = ''

    const MAX_RECONNECT_DELAY = 30000 // 30 seconds max
    const INITIAL_RECONNECT_DELAY = 1000 // 1 second initial

    const scheduleReconnect = () => {
      // Clear any existing timeout
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      // Don't reconnect if aborted
      if (abortController.signal.aborted) {
        return
      }

      // Don't reconnect if already connecting
      if (isConnectingRef.current) {
        return
      }

      console.log(
        `SSE: Reconnecting in ${reconnectDelayRef.current}ms...`,
      )
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (!abortController.signal.aborted) {
          connect()
        }
      }, reconnectDelayRef.current)

      // Exponential backoff: double the delay, but cap at MAX_RECONNECT_DELAY
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY,
      )
    }

    const connect = async () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnectingRef.current) {
        return
      }

      isConnectingRef.current = true

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            klientId: clientId,
          },
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Reset reconnect delay on successful connection
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        console.log('SSE: Connected successfully')

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No reader available')
        }

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Connection closed by server
            console.log('SSE: Connection closed by server, reconnecting...')
            isConnectingRef.current = false
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
              // Empty line indicates end of message
              if (currentData) {
                onMessageRef.current({
                  event: currentEvent || 'message',
                  data: currentData,
                  id: currentId || undefined,
                  comment: currentComment || undefined,
                })
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
          return // Cleanup, not an error
        }

        console.error('SSE error:', error)
        if (onErrorRef.current) {
          onErrorRef.current(error as Event)
        }

        // Schedule reconnection on error
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      abortController.abort()
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
      isConnectingRef.current = false
    }
  }, [url, clientId])
}

