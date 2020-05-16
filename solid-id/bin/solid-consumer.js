const options = require('./lib/options')
const { loadConfig } = require('./lib/cli-utils')
const solid = require('../')

const config = loadConfig(undefined, options)
solid.createConsumer(config)
