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

  useEffect(() => {
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    let currentEvent = ''
    let currentData = ''
    let currentId = ''
    let currentComment = ''

    const connect = async () => {
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

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No reader available')
        }

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
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
                onMessage({
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
        if (error instanceof Error && error.name === 'AbortError') {
          return // Cleanup, not an error
        }
        console.error('SSE error:', error)
        if (onError) {
          onError(error as Event)
        }
      }
    }

    connect()

    return () => {
      abortController.abort()
    }
  }, [url, clientId, onMessage, onError])
}

