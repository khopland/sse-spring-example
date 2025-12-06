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

class SSEStoreManager {
  private store = new Store<SSEStoreState>(initialState)
  private abortControllers = new Map<string, AbortController>()
  private connectionRefs = new Map<string, number>()
  private pendingCleanups = new Map<string, number>()
  private reconnectTimeouts = new Map<string, number | null>()
  private isConnectingMap = new Map<string, boolean>()

  getStore() {
    return this.store
  }

  registerConnection(
    id: string,
    url: string,
    clientId: string,
    abortController: AbortController,
  ): boolean {
    this.cancelPendingCleanup(id)

    const existing = this.abortControllers.get(id)
    if (existing && !existing.signal.aborted) {
      this.incrementRefCount(id)
      return false
    }

    if (existing) {
      existing.abort()
    }

    this.abortControllers.set(id, abortController)
    this.connectionRefs.set(id, 1)
    this.isConnectingMap.set(id, false)

    let registered = false
    this.store.setState((state) => {
      if (state.activeConnections.has(id)) {
        return state
      }

      registered = true
      const newConnections = new Map(state.connections)
      const newActiveConnections = new Set(state.activeConnections)

      newActiveConnections.add(id)
      newConnections.set(id, createConnection(id, url, clientId))

      return {
        connections: newConnections,
        activeConnections: newActiveConnections,
      }
    })

    return registered
  }

  unregisterConnection(id: string, onFinalCleanup?: () => void) {
    const refCount = this.connectionRefs.get(id) || 0
    if (refCount > 1) {
      this.connectionRefs.set(id, refCount - 1)
      return false
    }

    const controller = this.abortControllers.get(id)
    if (controller && onFinalCleanup) {
      this.scheduleCleanup(id, onFinalCleanup)
    } else {
      this.cleanup(id)
    }

    return true
  }

  getIsConnecting(id: string): boolean {
    return this.isConnectingMap.get(id) || false
  }

  setIsConnecting(id: string, value: boolean) {
    if (value) {
      this.isConnectingMap.set(id, true)
    } else {
      this.isConnectingMap.delete(id)
    }
  }

  getReconnectDelay(id: string): number {
    const connection = this.store.state.connections.get(id)
    return connection ? connection.reconnectDelay : 0
  }

  setReconnectDelay(id: string, delay: number) {
    this.updateConnectionField(id, { reconnectDelay: delay })
  }

  scheduleReconnectTimer(id: string, delay: number, cb: () => void) {
    this.clearReconnectTimer(id)
    const timeoutId = window.setTimeout(() => {
      this.reconnectTimeouts.delete(id)
      cb()
    }, delay)
    this.reconnectTimeouts.set(id, timeoutId)
  }

  clearReconnectTimer(id: string) {
    const t = this.reconnectTimeouts.get(id)
    if (t !== undefined && t !== null) {
      clearTimeout(t)
    }
    this.reconnectTimeouts.delete(id)
  }

  getAbortController(id: string): AbortController | undefined {
    return this.abortControllers.get(id)
  }

  updateConnectionStatus(
    id: string,
    status: SSEConnection['status'],
    reconnectDelay?: number,
  ) {
    this.store.setState((state) => {
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

      if (reconnectDelay !== undefined) {
        updated.reconnectDelay = reconnectDelay
      }

      const newConnections = new Map(state.connections)
      newConnections.set(id, updated)

      return { ...state, connections: newConnections }
    })
  }

  addMessage(id: string, message: SSEMessage) {
    this.store.setState((state) => {
      const connection = state.connections.get(id)
      if (!connection) return state

      const messages = [...connection.messages, message]
      const trimmedMessages =
        messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages

      const newConnections = new Map(state.connections)
      newConnections.set(id, {
        ...connection,
        messageCount: connection.messageCount + 1,
        lastMessage: message,
        messages: trimmedMessages,
      })

      return { ...state, connections: newConnections }
    })
  }

  addError(id: string, error: Error) {
    this.store.setState((state) => {
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
  }

  hasActiveConnection(id: string): boolean {
    const controller = this.abortControllers.get(id)
    return controller !== undefined && !controller.signal.aborted
  }

  getConnections(): SSEConnection[] {
    return Array.from(this.store.state.connections.values())
  }

  getConnection(id: string): SSEConnection | undefined {
    return this.store.state.connections.get(id)
  }

  clearMessages(id: string) {
    this.updateConnectionField(id, {
      messages: [],
      messageCount: 0,
      lastMessage: null,
    })
  }

  clearErrors(id: string) {
    this.updateConnectionField(id, {
      errors: [],
      errorCount: 0,
      lastError: null,
    })
  }

  private cancelPendingCleanup(id: string) {
    const timeoutId = this.pendingCleanups.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.pendingCleanups.delete(id)
    }
  }

  private incrementRefCount(id: string) {
    const refCount = this.connectionRefs.get(id) || 0
    this.connectionRefs.set(id, refCount + 1)
  }

  private scheduleCleanup(id: string, onFinalCleanup: () => void) {
    const timeoutId = window.setTimeout(() => {
      const currentRefs = this.connectionRefs.get(id) || 0
      if (currentRefs === 0) {
        this.cleanup(id)
        onFinalCleanup()
      }
    }, CLEANUP_DELAY)

    this.pendingCleanups.set(id, timeoutId)
  }

  private cleanup(id: string) {
    this.abortControllers.delete(id)
    this.connectionRefs.delete(id)
    this.pendingCleanups.delete(id)

    this.store.setState((state) => {
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

  private updateConnectionField(
    id: string,
    updates: Partial<SSEConnection>,
  ) {
    this.store.setState((state) => {
      const connection = state.connections.get(id)
      if (!connection) return state

      const newConnections = new Map(state.connections)
      newConnections.set(id, { ...connection, ...updates })

      return { ...state, connections: newConnections }
    })
  }
}

export const sseStore = new SSEStoreManager()
export const sseStoreInstance = sseStore.getStore()
