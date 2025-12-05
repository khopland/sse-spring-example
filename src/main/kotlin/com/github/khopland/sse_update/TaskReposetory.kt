package com.github.khopland.sse_update

import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository

@Repository
interface TaskReposetory : CrudRepository<Task, Long> {
}