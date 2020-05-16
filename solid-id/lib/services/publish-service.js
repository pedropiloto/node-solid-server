'use strict'

const EXCHANGE = 'solid.events'
const createChannel = async amqUrl => {
  const channel = async () => {
    const conn = await require('amqplib').connect(
      amqUrl
    )

    return conn.createChannel().then(channel => {
      return Promise.resolve(channel)
    })
  }

  const rabbitMQChannel = await channel()

  rabbitMQChannel.assertExchange(EXCHANGE, 'topic', {
    durable: true
  })
  global.globalRabbitMQChannel = rabbitMQChannel
}

const publishMessage = async (routingKey, message) => {
  globalRabbitMQChannel.publish(EXCHANGE, routingKey, Buffer.from(message))
  console.log(' [x] SENT %s: \'%s\'', routingKey, message)
}

module.exports = { createChannel, publishMessage }
