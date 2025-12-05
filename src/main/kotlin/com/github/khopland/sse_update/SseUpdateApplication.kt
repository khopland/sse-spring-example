package com.github.khopland.sse_update

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class SseUpdateApplication

fun main(args: Array<String>) {
	runApplication<SseUpdateApplication>(*args)
}
