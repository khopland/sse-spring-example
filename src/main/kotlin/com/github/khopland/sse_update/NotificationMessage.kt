package com.github.khopland.sse_update

data class NotificationMessage(
    val topic: String,
    val message: String,
    val id: String? = null,
    val klientId: String? = null,
)

