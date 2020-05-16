module.exports = createConsumer

const LDP = require('./ldp')
const SolidHost = require('./models/solid-host')
const AccountManager = require('./models/account-manager')
const CreateAccountController = require('./controllers/register-account-controller')
const API = require('./api')
const config = require('./server-config')
const defaults = require('../config/defaults')
const { createChannel } = require('./services/publish-service')
const amqp = require('amqplib/callback_api')

function createConsumer (argv = {}) {
  // Override default configs (defaults) with passed-in params (argv)
  argv = Object.assign({}, defaults, argv)

  argv.host = SolidHost.from(argv)

  config.printDebugInfo(argv)

  const ldp = new LDP(argv)
  createChannel(argv.amqpUrl)

  const accountManager = AccountManager.from({
    authMethod: argv.auth,
    host: argv.host,
    store: ldp,
    multiuser: argv.multiuser
  })
  const oidc = API.authn.oidc.createOidcManager(argv)
  start(argv, accountManager, oidc.users)
}

function start (argv, accountManager, userStore) {
  amqp.connect(argv.amqpUrl, function (
    error0,
    connection
  ) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      var exchange = 'solid.events'

      channel.assertExchange(exchange, 'topic', {
        durable: true
      })

      channel.assertQueue(
        'solid-id-consumer.queue',
        {
          exclusive: false
        },
        function (error2, q) {
          console.log(' [*] Waiting for logs. To exit press CTRL+C')
          channel.bindQueue(q.queue, exchange, '*.account.*')

          channel.consume(
            q.queue,
            function (msg) {
              console.log(
                ' [x] RECEIVED %s: \'%s\'',
                msg.fields.routingKey,
                msg.content.toString()
              )
              const body = JSON.parse(msg.content.toString())
              if (body.event === 'account_registered') {
                new CreateAccountController(accountManager, userStore, body.object.account).call()
              }
            },
            {
              noAck: true
            }
          )
        }
      )
    })
  })
}
