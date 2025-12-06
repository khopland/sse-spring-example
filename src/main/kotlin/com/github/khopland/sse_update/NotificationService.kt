package com.github.khopland.sse_update

import jakarta.jms.Topic
import org.springframework.jms.annotation.JmsListener
import org.springframework.jms.core.JmsClient
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.CopyOnWriteArrayList

@Service
class NotificationService(
    private val jmsClient: JmsClient,
    private val notificationTopic: Topic
) {
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
        // Send to JMS topic for multi-server broadcasting
        // The JMS listener will handle broadcasting to all servers (including this one)
        val notificationMessage = NotificationMessage(topic, message)
        jmsClient.destination(notificationTopic).send(notificationMessage)
    }

    @JmsListener(destination = "notifications", containerFactory = "jmsListenerContainerFactory")
    fun receiveJmsNotification(notificationMessage: NotificationMessage) {
        // Broadcast to local emitters when receiving from JMS
        // This ensures all servers (including the originating one) broadcast to their clients
        broadcastToLocalEmitters(notificationMessage.topic, notificationMessage.message)
    }

    private fun broadcastToLocalEmitters(topic: String, message: String) {
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

    @Scheduled(fixedRate = 10000) // Send heartbeat every 10 seconds
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