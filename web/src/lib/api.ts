const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export interface Task {
  id: number | null
  description: string
}

export const api = {
  tasks: {
    getAll: async (): Promise<Task[]> => {
      const response = await fetch(`${API_BASE_URL}/task`)
      if (!response.ok) throw new Error('Failed to fetch tasks')
      return response.json()
    },
    getById: async (id: number): Promise<Task> => {
      const response = await fetch(`${API_BASE_URL}/task/${id}`)
      if (!response.ok) throw new Error('Failed to fetch task')
      return response.json()
    },
    create: async (task: Omit<Task, 'id'>, clientId: string): Promise<Task> => {
      const response = await fetch(`${API_BASE_URL}/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          klientId: clientId,
        },
        body: JSON.stringify(task),
      })
      if (!response.ok) throw new Error('Failed to create task')
      return response.json()
    },
    update: async (
      id: number,
      task: Omit<Task, 'id'>,
      clientId: string,
    ): Promise<Task> => {
      const response = await fetch(`${API_BASE_URL}/task/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          klientId: clientId,
        },
        body: JSON.stringify(task),
      })
      if (!response.ok) throw new Error('Failed to update task')
      return response.json()
    },
    delete: async (id: number, clientId: string): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/task/${id}`, {
        method: 'DELETE',
        headers: {
          klientId: clientId,
        },
      })
      if (!response.ok) throw new Error('Failed to delete task')
    },
  },
}

