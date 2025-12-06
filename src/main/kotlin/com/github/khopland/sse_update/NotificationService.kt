package com.github.khopland.sse_update

import jakarta.annotation.PreDestroy
import jakarta.jms.Topic
import org.springframework.context.SmartLifecycle
import org.springframework.jms.annotation.JmsListener
import org.springframework.jms.core.JmsClient
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.ConcurrentHashMap

@Service
class NotificationService(
    private val jmsClient: JmsClient,
    private val notificationTopic: Topic
) : SmartLifecycle {
    private val emitters = ConcurrentHashMap<String, SseEmitter>()

    fun addEmitter(emitter: SseEmitter, klientId: String) {
        emitters[klientId]?.complete()
        emitters[klientId] = emitter
        emitter.onCompletion {
            emitters.remove(klientId)
        }
        emitter.onTimeout {
            emitters.remove(klientId)
        }
    }

    fun broadcastNotification(topic: String, message: String, id: String?, klientId: String?) {
        // Send to JMS topic for multi-server broadcasting
        // The JMS listener will handle broadcasting to all servers (including this one)
        val notificationMessage = NotificationMessage(topic, message, id, klientId)
        jmsClient.destination(notificationTopic).send(notificationMessage)
    }

    @JmsListener(destination = "notifications", containerFactory = "jmsListenerContainerFactory")
    fun receiveJmsNotification(notificationMessage: NotificationMessage) {
        // Broadcast to local emitters when receiving from JMS
        // This ensures all servers (including the originating one) broadcast to their clients
        broadcastToLocalEmitters(notificationMessage)
    }

    private fun broadcastToLocalEmitters(message: NotificationMessage) {
        val deadEmitters = mutableListOf<String>()

        emitters.forEach { (k, emitter) ->
            try {
                if (message.klientId == k) {
                    return@forEach
                }
                emitter.send(
                    SseEmitter.event()
                        .apply {
                            if (message.id != null) id(message.id)
                            if (message.klientId != null) comment(message.klientId)
                        }
                        .name(message.topic)
                        .data(message.message)
                        .build()
                )
            } catch (_: Exception) {
                deadEmitters.add(k)
            }
        }

        // Remove dead emitters
        deadEmitters.forEach { emitters.remove(it) }
    }

    @Scheduled(fixedRate = 10000) // Send heartbeat every 10 seconds
    fun sendHeartbeat() {
        val deadEmitters = mutableListOf<String>()

        emitters.forEach { (k, emitter) ->
            try {
                emitter.send(SseEmitter.event().name("heartbeat").data("ping").build())
            } catch (_: Exception) {
                deadEmitters.add(k)
            }
        }

        // Remove dead emitters
        deadEmitters.forEach { emitters.remove(it) }
    }

    @PreDestroy
    fun destroy() {
        emitters.values.forEach { it.complete() }
    }

    override fun start() {
    }

    override fun stop() {
        println("Stopping ${emitters.size} emitters...")
        emitters.values.forEach { it.complete() }
        emitters.clear()
    }

    override fun isRunning(): Boolean {
        return emitters.isNotEmpty()
    }

}