package com.github.khopland.sse_update

import org.springframework.jms.support.converter.MessageConverter;
import jakarta.jms.JMSException
import jakarta.jms.Message
import jakarta.jms.Session
import jakarta.jms.TextMessage
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper

@Component
class JacksonJmsMessageConverter : MessageConverter {

    private var jsonMapper: JsonMapper = JsonMapper.builder()
        .findAndAddModules()
        .build()

    override fun toMessage(obj: Any, session: Session): Message {
        try {
            val json = jsonMapper.writeValueAsString(obj)
            val message: TextMessage = session.createTextMessage(json)
            message.setStringProperty("_type", obj.javaClass.getName())
            return message
        } catch (e: Exception) {
            throw JMSException("Failed to convert to JSON: " + e.message)
        }
    }

    override fun fromMessage(message: Message): Any {
        if (message is TextMessage) {
            try {
                val json = message.text
                val className = message.getStringProperty("_type")
                val clazz = Class.forName(className)
                return jsonMapper.readValue(json, clazz)
            } catch (e: Exception) {
                throw JMSException("Failed to parse JSON: " + e.message)
            }
        }
        throw JMSException("Only TextMessage is supported")
    }
}