import { Store } from '@tanstack/store'
import type { SSEMessage } from './useSSE'

export interface SSEConnection {
  id: string
  url: string
  clientId: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'
  connectedAt: number | null
  disconnectedAt: number | null
  reconnectDelay: number
  messageCount: number
  errorCount: number
  lastMessage: SSEMessage | null
  lastError: Error | null
  messages: SSEMessage[]
  errors: Array<{ error: Error; timestamp: number }>
}

interface SSEStoreState {
  connections: Map<string, SSEConnection>
  activeConnections: Set<string>
}

const MAX_MESSAGES = 100
const MAX_ERRORS = 50
const CLEANUP_DELAY = 100

const initialState: SSEStoreState = {
  connections: new Map(),
  activeConnections: new Set(),
}

const createConnection = (
  id: string,
  url: string,
  clientId: string,
): SSEConnection => ({
  id,
  url,
  clientId,
  status: 'connecting',
  connectedAt: null,
  disconnectedAt: null,
  reconnectDelay: 0,
  messageCount: 0,
  errorCount: 0,
  lastMessage: null,
  lastError: null,
  messages: [],
  errors: [],
})

// Core store instance (TanStack recommended pattern: store + actions)
const store = new Store<SSEStoreState>(initialState)

// Internal maps for controllers, refs and timers
const abortControllers = new Map<string, AbortController>()
const connectionRefs = new Map<string, number>()
const pendingCleanups = new Map<string, number>()
const reconnectTimeouts = new Map<string, number | null>()
const isConnectingMap = new Map<string, boolean>()

function cancelPendingCleanup(id: string) {
  const timeoutId = pendingCleanups.get(id)
  if (timeoutId) {
    clearTimeout(timeoutId)
    pendingCleanups.delete(id)
  }
}

function incrementRefCount(id: string) {
  const refCount = connectionRefs.get(id) || 0
  connectionRefs.set(id, refCount + 1)
}

function scheduleCleanup(id: string, onFinalCleanup: () => void) {
  const timeoutId = window.setTimeout(() => {
    const currentRefs = connectionRefs.get(id) || 0
    if (currentRefs === 0) {
      cleanup(id)
      onFinalCleanup()
    }
  }, CLEANUP_DELAY)

  pendingCleanups.set(id, timeoutId)
}

function cleanup(id: string) {
  abortControllers.delete(id)
  connectionRefs.delete(id)
  pendingCleanups.delete(id)

  store.setState((state) => {
    const newConnections = new Map(state.connections)
    const newActiveConnections = new Set(state.activeConnections)

    newConnections.delete(id)
    newActiveConnections.delete(id)

    return {
      connections: newConnections,
      activeConnections: newActiveConnections,
    }
  })
}

function updateConnectionField(id: string, updates: Partial<SSEConnection>) {
  store.setState((state) => {
    const connection = state.connections.get(id)
    if (!connection) return state

    const newConnections = new Map(state.connections)
    newConnections.set(id, { ...connection, ...updates })

    return { ...state, connections: newConnections }
  })
}

// Exported actions and helpers
export const sseStore = {
  // Expose the Store instance for read-only access if needed
  getStore: () => store,

  registerConnection(id: string, url: string, clientId: string, abortController: AbortController) {
    cancelPendingCleanup(id)

    const existing = abortControllers.get(id)
    if (existing && !existing.signal.aborted) {
      incrementRefCount(id)
      return false
    }

    if (existing) existing.abort()

    abortControllers.set(id, abortController)
    connectionRefs.set(id, 1)
    isConnectingMap.set(id, false)

    let registered = false
    store.setState((state) => {
      if (state.activeConnections.has(id)) return state

      registered = true
      const newConnections = new Map(state.connections)
      const newActiveConnections = new Set(state.activeConnections)

      newActiveConnections.add(id)
      newConnections.set(id, createConnection(id, url, clientId))

      return { connections: newConnections, activeConnections: newActiveConnections }
    })

    return registered
  },

  unregisterConnection(id: string, onFinalCleanup?: () => void) {
    const refCount = connectionRefs.get(id) || 0
    if (refCount > 1) {
      connectionRefs.set(id, refCount - 1)
      return false
    }

    const controller = abortControllers.get(id)
    if (controller && onFinalCleanup) {
      scheduleCleanup(id, onFinalCleanup)
    } else {
      cleanup(id)
    }

    return true
  },

  getIsConnecting(id: string) {
    return isConnectingMap.get(id) || false
  },

  setIsConnecting(id: string, value: boolean) {
    if (value) isConnectingMap.set(id, true)
    else isConnectingMap.delete(id)
  },

  getReconnectDelay(id: string) {
    const connection = store.state.connections.get(id)
    return connection ? connection.reconnectDelay : 0
  },

  setReconnectDelay(id: string, delay: number) {
    updateConnectionField(id, { reconnectDelay: delay })
  },

  scheduleReconnectTimer(id: string, delay: number, cb: () => void) {
    const t = reconnectTimeouts.get(id)
    if (t !== undefined && t !== null) clearTimeout(t)
    const timeoutId = window.setTimeout(() => {
      reconnectTimeouts.delete(id)
      cb()
    }, delay)
    reconnectTimeouts.set(id, timeoutId)
  },

  clearReconnectTimer(id: string) {
    const t = reconnectTimeouts.get(id)
    if (t !== undefined && t !== null) {
      clearTimeout(t)
    }
    reconnectTimeouts.delete(id)
  },

  getAbortController(id: string) {
    return abortControllers.get(id)
  },

  updateConnectionStatus(id: string, status: SSEConnection['status'], reconnectDelay?: number) {
    store.setState((state) => {
      const connection = state.connections.get(id)
      if (!connection) return state

      const updated: SSEConnection = { ...connection, status }

      if (status === 'connected') {
        updated.connectedAt = Date.now()
        updated.disconnectedAt = null
        updated.reconnectDelay = 0
      } else if (status === 'disconnected' || status === 'error') {
        updated.disconnectedAt = Date.now()
      }

      if (reconnectDelay !== undefined) updated.reconnectDelay = reconnectDelay

      const newConnections = new Map(state.connections)
      newConnections.set(id, updated)

      return { ...state, connections: newConnections }
    })
  },

  addMessage(id: string, message: SSEMessage) {
    store.setState((state) => {
      const connection = state.connections.get(id)
      if (!connection) return state

      const messages = [...connection.messages, message]
      const trimmedMessages = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages

      const newConnections = new Map(state.connections)
      newConnections.set(id, {
        ...connection,
        messageCount: connection.messageCount + 1,
        lastMessage: message,
        messages: trimmedMessages,
      })

      return { ...state, connections: newConnections }
    })
  },

  addError(id: string, error: Error) {
    store.setState((state) => {
      const connection = state.connections.get(id)
      if (!connection) return state

      const errors = [...connection.errors, { error, timestamp: Date.now() }]
      const trimmedErrors = errors.length > MAX_ERRORS ? errors.slice(-MAX_ERRORS) : errors

      const newConnections = new Map(state.connections)
      newConnections.set(id, {
        ...connection,
        errorCount: connection.errorCount + 1,
        lastError: error,
        errors: trimmedErrors,
      })

      return { ...state, connections: newConnections }
    })
  },

  hasActiveConnection(id: string) {
    const controller = abortControllers.get(id)
    return controller !== undefined && !controller.signal.aborted
  },

  getConnections() {
    return Array.from(store.state.connections.values())
  },

  getConnection(id: string) {
    return store.state.connections.get(id)
  },

  clearMessages(id: string) {
    updateConnectionField(id, { messages: [], messageCount: 0, lastMessage: null })
  },

  clearErrors(id: string) {
    updateConnectionField(id, { errors: [], errorCount: 0, lastError: null })
  },

  resetConnectionState(id: string) {
    sseStore.clearReconnectTimer(id)
    sseStore.setReconnectDelay(id, 0)
    sseStore.setIsConnecting(id, false)
  },
}

