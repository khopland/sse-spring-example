package com.github.khopland.sse_update

import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController


@RestController
class TaskController(private val taskReposetory: TaskReposetory) {

    @GetMapping("/task")
    fun getTasks(): List<Task> {
        return taskReposetory.findAll().toList()
    }

    @GetMapping("/task/{id}")
    fun getTask(id: Long): Task? {
        return taskReposetory.findById(id).orElse(null)
    }

    @PostMapping("/task")
    fun saveTask(@RequestBody task: Task): Task {
        return taskReposetory.save(task)
    }

    @PutMapping("/task/{id}")
    fun updateTask(id: Long, @RequestBody task: Task): Task {
        val updatedTask = taskReposetory
            .findById(id)
            .orElseThrow { RuntimeException("Task not found") }
            .apply {
                description = task.description
            }
        return taskReposetory.save(updatedTask)
    }

    @DeleteMapping("/task/{id}")
    fun deleteTask(id: Long) {
        taskReposetory.deleteById(id)
    }

    @GetMapping("/task/count")
    fun getTaskCount(): Long {
        return taskReposetory.count()
    }


}