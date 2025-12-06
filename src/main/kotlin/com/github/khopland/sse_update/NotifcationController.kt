package com.github.khopland.sse_update

import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@RestController
class NotifcationController(private val notificationService: NotificationService) {

    @GetMapping("/notifcation", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun getSseNotifications(@RequestHeader("klientId") klientId: String): SseEmitter {
        val emitter = SseEmitter(Long.MAX_VALUE)
        notificationService.addEmitter(emitter, klientId)
        return emitter
    }
}