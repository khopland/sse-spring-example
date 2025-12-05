package com.github.khopland.sse_update

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class SseUpdateApplication

fun main(args: Array<String>) {
	runApplication<SseUpdateApplication>(*args)
}
