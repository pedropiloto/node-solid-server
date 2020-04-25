require("dotenv").config();

'use strict'

const EXCHANGE = 'solid.events'
const createChannel = async () => {
  const channel = async () => {
    const conn = await require('amqplib').connect(
      process.env.AMQP_URL
    )

    return conn.createChannel().then(channel => {
      return Promise.resolve(channel)
    })
  }

  let rabbitMQChannel = await channel()

  rabbitMQChannel.assertExchange(EXCHANGE, 'topic', {
    durable: true
  })
  global.globalRabbitMQChannel = rabbitMQChannel
}

const publishMessage = async (routingKey, message) => {

  globalRabbitMQChannel.publish(EXCHANGE, routingKey, Buffer.from(message))
  console.log(' [x] Sent %s: \'%s\'', routingKey, message)
}

module.exports = { createChannel, publishMessage }

