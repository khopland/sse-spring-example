package com.github.khopland.sse_update

import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@Service
class NotificationService(private val emitters: MutableList<SseEmitter>) {


    fun addEmitter(emitter: SseEmitter) {
        emitters.add(emitter)
    }





}