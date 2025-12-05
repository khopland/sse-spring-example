package com.github.khopland.sse_update

import org.springframework.boot.fromApplication
import org.springframework.boot.with


fun main(args: Array<String>) {
	fromApplication<SseUpdateApplication>().with(TestcontainersConfiguration::class).run(*args)
}
