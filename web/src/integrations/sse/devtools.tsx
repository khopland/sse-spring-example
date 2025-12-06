import { useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { sseStore, sseStoreInstance, type SSEConnection } from '@/hooks/useSSE.store'
import { Trash2, AlertCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

function SSEConnectionCard({ connection }: { connection: SSEConnection }) {
  const [expanded, setExpanded] = useState(false)
  const [showMessages, setShowMessages] = useState(true)
  const [showErrors, setShowErrors] = useState(false)

  const getStatusColor = (status: SSEConnection['status']) => {
    switch (status) {
      case 'connected':
        return 'text-[#10b981]'
      case 'connecting':
      case 'reconnecting':
        return 'text-[#f59e0b]'
      case 'disconnected':
        return 'text-[#6b7280]'
      case 'error':
        return 'text-[#ef4444]'
      default:
        return 'text-[#6b7280]'
    }
  }

  const getStatusIcon = (status: SSEConnection['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-4 h-4" />
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'disconnected':
      case 'error':
        return <XCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <div className="border border-[#e5e7eb] dark:border-[#374151] rounded-md mb-2 bg-[#ffffff] dark:bg-[#1f2937]">
      <div
        className="px-3 py-2.5 cursor-pointer hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={getStatusColor(connection.status)}>
              {getStatusIcon(connection.status)}
            </span>
            <span className="font-medium text-sm text-[#111827] dark:text-[#f9fafb] truncate">
              {connection.url}
            </span>
            <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              ({connection.clientId})
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6b7280] dark:text-[#9ca3af]">
            <span>{connection.messageCount} msgs</span>
            {connection.errorCount > 0 && (
              <span className="text-[#ef4444]">{connection.errorCount} err</span>
            )}
            {connection.status === 'reconnecting' && (
              <span className="text-[#f59e0b]">
                Reconnect in {formatDuration(connection.reconnectDelay)}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#e5e7eb] dark:border-[#374151] px-3 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[#6b7280] dark:text-[#9ca3af]">Status:</span>
              <span className={`ml-2 font-medium ${getStatusColor(connection.status)}`}>
                {connection.status}
              </span>
            </div>
            <div>
              <span className="text-[#6b7280] dark:text-[#9ca3af]">Client ID:</span>
              <span className="ml-2 font-mono text-[#111827] dark:text-[#f9fafb]">
                {connection.clientId}
              </span>
            </div>
            {connection.connectedAt && (
              <div>
                <span className="text-[#6b7280] dark:text-[#9ca3af]">Connected:</span>
                <span className="ml-2 text-[#111827] dark:text-[#f9fafb]">
                  {formatTime(connection.connectedAt)}
                </span>
              </div>
            )}
            {connection.disconnectedAt && (
              <div>
                <span className="text-[#6b7280] dark:text-[#9ca3af]">Disconnected:</span>
                <span className="ml-2 text-[#111827] dark:text-[#f9fafb]">
                  {formatTime(connection.disconnectedAt)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-b border-[#e5e7eb] dark:border-[#374151]">
            <button
              onClick={() => {
                setShowMessages(true)
                setShowErrors(false)
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                showMessages
                  ? 'border-b-2 border-[#f59e0b] text-[#f59e0b]'
                  : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f9fafb]'
              }`}
            >
              Messages ({connection.messages.length})
            </button>
            {connection.errors.length > 0 && (
              <button
                onClick={() => {
                  setShowMessages(false)
                  setShowErrors(true)
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  showErrors
                    ? 'border-b-2 border-[#ef4444] text-[#ef4444]'
                    : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f9fafb]'
                }`}
              >
                Errors ({connection.errors.length})
              </button>
            )}
          </div>

          {showMessages && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                  Recent messages
                </span>
                {connection.messages.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      sseStore.clearMessages(connection.id)
                    }}
                    className="text-xs text-[#ef4444] hover:text-[#dc2626] dark:hover:text-[#f87171] flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              {connection.messages.length === 0 ? (
                <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] text-center py-4">
                  No messages yet
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {connection.messages.slice().reverse().map((msg, idx) => (
                    <div
                      key={idx}
                      className="bg-[#f9fafb] dark:bg-[#374151] rounded-md p-2.5 text-xs font-mono border border-[#e5e7eb] dark:border-[#4b5563]"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#f59e0b] font-semibold">
                          {msg.event}
                        </span>
                        {msg.id && (
                          <span className="text-[#6b7280] dark:text-[#9ca3af]">
                            id: {msg.id}
                          </span>
                        )}
                      </div>
                      <div className="text-[#111827] dark:text-[#f9fafb] break-all">
                        {msg.data}
                      </div>
                      {msg.comment && (
                        <div className="text-[#6b7280] dark:text-[#9ca3af] text-xs mt-1">
                          comment: {msg.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showErrors && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                  Error history
                </span>
                {connection.errors.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      sseStore.clearErrors(connection.id)
                    }}
                    className="text-xs text-[#ef4444] hover:text-[#dc2626] dark:hover:text-[#f87171] flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              {connection.errors.length === 0 ? (
                <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] text-center py-4">
                  No errors
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {connection.errors.slice().reverse().map((err, idx) => (
                    <div
                      key={idx}
                      className="bg-[#fef2f2] dark:bg-[#7f1d1d]/20 border border-[#fecaca] dark:border-[#991b1b] rounded-md p-2.5 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-[#ef4444] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#dc2626] dark:text-[#f87171]">
                            {err.error.name || 'Error'}
                          </div>
                          <div className="text-[#b91c1c] dark:text-[#fca5a5] mt-1 break-all">
                            {err.error.message}
                          </div>
                          <div className="text-[#6b7280] dark:text-[#9ca3af] mt-1">
                            {formatTime(err.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SSEDevtoolsPanel() {
  const storeState = useStore(sseStoreInstance)
  const connections = Array.from(storeState.connections.values())

  return (
    <div className="h-full flex flex-col bg-[#ffffff] dark:bg-[#111827] text-[#111827] dark:text-[#f9fafb]">
      <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#374151]">
        <h2 className="text-base font-semibold text-[#111827] dark:text-[#f9fafb]">
          SSE Connections
        </h2>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
          Monitor Server-Sent Events connections and messages
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {connections.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
              No SSE connections active
            </p>
            <p className="text-xs text-[#9ca3af] dark:text-[#6b7280] mt-2">
              Connections will appear here when useSSE is used
            </p>
          </div>
        ) : (
          <div>
            {connections.map((connection) => (
              <SSEConnectionCard key={connection.id} connection={connection} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
