package com.github.khopland.sse_update

import org.springframework.web.bind.annotation.*


@RestController
class TaskController(
    private val taskReposetory: TaskReposetory,
    private val notificationService: NotificationService
) {

    @GetMapping("/task")
    fun getTasks(): List<Task> {
        return taskReposetory.findAll().toList()
    }

    @GetMapping("/task/{id}")
    fun getTask(@PathVariable id: Long): Task? {
        return taskReposetory.findById(id).orElse(null)
    }

    @PostMapping("/task")
    fun saveTask(@RequestHeader("klientId") klientId: String?, @RequestBody task: Task): Task {

        val savedTask = taskReposetory.save(task)
        notificationService.broadcastNotification("task", "crate", "${task.id}", klientId)
        return savedTask
    }

    @PutMapping("/task/{id}")
    fun updateTask(@RequestHeader("klientId") klientId: String?, @PathVariable id: Long, @RequestBody task: Task): Task {
        val updatedTask = taskReposetory
            .findById(id)
            .orElseThrow { RuntimeException("Task not found") }
            .apply {
                description = task.description
            }
        val savedTask = taskReposetory.save(updatedTask)
        notificationService.broadcastNotification("task", "update", "${savedTask.id}", klientId)
        return savedTask
    }

    @DeleteMapping("/task/{id}")
    fun deleteTask(@RequestHeader("klientId") klientId: String?, @PathVariable id: Long) {
        val task = taskReposetory.findById(id).orElse(null)
        taskReposetory.deleteById(id)
        if (task != null) {
            notificationService.broadcastNotification("task", "deleted", "${task.id}", klientId)
        }
    }

    @GetMapping("/task/count")
    fun getTaskCount(): Long {
        return taskReposetory.count()
    }


}