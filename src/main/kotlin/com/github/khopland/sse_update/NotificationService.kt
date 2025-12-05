package com.github.khopland.sse_update

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.CopyOnWriteArrayList

@Service
class NotificationService {
    private val emitters = CopyOnWriteArrayList<SseEmitter>()

    fun addEmitter(emitter: SseEmitter) {
        emitters.add(emitter)
        emitter.onCompletion {
            emitters.remove(emitter)
        }
        emitter.onTimeout {
            emitters.remove(emitter)
        }
    }

    fun broadcastNotification(topic: String, message: String) {
        val deadEmitters = mutableListOf<SseEmitter>()

        emitters.forEach { emitter ->
            try {
                emitter.send(SseEmitter.event().name(topic).data(message).build())
            } catch (_: Exception) {
                deadEmitters.add(emitter)
            }
        }

        // Remove dead emitters
        emitters.removeAll(deadEmitters)
    }

    @Scheduled(fixedRate = 10000) // Send heartbeat every 30 seconds
    fun sendHeartbeat() {
        val deadEmitters = mutableListOf<SseEmitter>()

        emitters.forEach { emitter ->
            try {
                emitter.send(SseEmitter.event().name("heartbeat").data("ping").build())
            } catch (_: Exception) {
                deadEmitters.add(emitter)
            }
        }
        
        // Remove dead emitters
        emitters.removeAll(deadEmitters)
    }
}