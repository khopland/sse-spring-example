package com.github.khopland.sse_update

import jakarta.jms.ConnectionFactory
import jakarta.jms.Topic
import org.apache.activemq.artemis.jms.client.ActiveMQTopic
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jms.annotation.EnableJms
import org.springframework.jms.config.DefaultJmsListenerContainerFactory

@Configuration
@EnableJms
class JmsConfiguration {

    @Bean
    fun notificationTopic(): Topic {
        return ActiveMQTopic("notifications")
    }

    @Bean
    fun jmsListenerContainerFactory(
        connectionFactory: ConnectionFactory,
        messageConverter: JacksonJmsMessageConverter
    ): DefaultJmsListenerContainerFactory {
        val factory = DefaultJmsListenerContainerFactory()
        factory.setConnectionFactory(connectionFactory)
        factory.setPubSubDomain(true) // Use topics for broadcasting
        factory.setMessageConverter(messageConverter)
        return factory
    }

}

