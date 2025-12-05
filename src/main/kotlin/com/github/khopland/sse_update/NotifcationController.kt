package com.github.khopland.sse_update

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@RestController
class NotifcationController {


    @GetMapping
    public fun getSseNotifications(): SseEmitter {
        val emitter = SseEmitter()
        emitter.onCompletion {
            println("SseEmitter completed")
        }
        emitter.onTimeout {
            println("SseEmitter timed out")
        }
        emitter.send(SseEmitter.event().data("Hello, world!").build())
        return emitter
    }
}