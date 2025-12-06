import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type Task } from '@/lib/api'
import { clientId } from '@/lib/clientId'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Edit2, Plus, Check, X } from 'lucide-react'
import { useSSE } from '@/hooks/useSSE'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const Route = createFileRoute('/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Fetch tasks
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.tasks.getAll,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (task: Omit<Task, 'id'>) => api.tasks.create(task, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setNewTaskDescription('')
      setIsAdding(false)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, task }: { id: number; task: Omit<Task, 'id'> }) =>
      api.tasks.update(id, task, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setEditingId(null)
      setEditDescription('')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tasks.delete(id, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  // SSE connection

  useSSE(
    `${API_BASE_URL}/notifcation`,
    clientId,
    (message) => {
      // Ignore messages from this client (to avoid duplicate updates from our own actions)
      if (message.comment === clientId) {
        return
      }

      // Refetch tasks when we receive a task-related notification
      if (message.event === 'task') {
        // Small delay to ensure backend has processed the change
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }, 100)
      }
    },
    (error) => {
      console.error('SSE connection error:', error)
    },
  )

  const handleStartEdit = (task: Task) => {
    setEditingId(task.id!)
    setEditDescription(task.description)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditDescription('')
  }

  const handleSaveEdit = (id: number) => {
    updateMutation.mutate({
      id,
      task: { description: editDescription },
    })
  }

  const handleAddTask = () => {
    if (newTaskDescription.trim()) {
      createMutation.mutate({ description: newTaskDescription.trim() })
    }
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading tasks...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Error loading tasks:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Task Manager</h1>
        <p className="text-muted-foreground">
          Real-time task management with SSE updates
        </p>
      </div>

      {/* Add Task Form */}
      <div className="bg-card border rounded-lg p-4 mb-6 shadow-sm">
        {!isAdding ? (
          <Button
            onClick={() => setIsAdding(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2" />
            Add New Task
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-task">Task Description</Label>
              <Input
                id="new-task"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Enter task description..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask()
                  } else if (e.key === 'Escape') {
                    setIsAdding(false)
                    setNewTaskDescription('')
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddTask}
                disabled={
                  !newTaskDescription.trim() || createMutation.isPending
                }
              >
                <Check className="mr-2" />
                Add Task
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false)
                  setNewTaskDescription('')
                }}
              >
                <X className="mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              No tasks yet. Add your first task above!
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {editingId === task.id ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`edit-${task.id}`}>Task Description</Label>
                    <Input
                      id={`edit-${task.id}`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(task.id!)
                        } else if (e.key === 'Escape') {
                          handleCancelEdit()
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveEdit(task.id!)}
                      disabled={
                        !editDescription.trim() || updateMutation.isPending
                      }
                      size="sm"
                    >
                      <Check className="mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      size="sm"
                    >
                      <X className="mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <p className="flex-1 text-base">{task.description}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleStartEdit(task)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(task.id!)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Connection Status */}
      <div className="mt-6 text-sm text-muted-foreground text-center">
        <div className="inline-flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Connected to SSE stream
        </div>
      </div>
    </div>
  )
}
