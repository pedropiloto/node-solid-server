'use strict'

const options = require('./options')
const fs = require('fs')
const path = require('path')
const { loadConfig } = require('./cli-utils')
const { red, bold } = require('colorette')


const config = loadConfig(program, options)
bin(config, server)

function bin (argv, server) {

  // Set up --no-*
  argv.live = !argv.noLive

  // Set up debug environment
  if (!argv.quiet) {
    require('debug').enable('ldp-web:*')
  }

  // Set up port
  argv.port = argv.port || 3456

  // Signal handling (e.g. CTRL+C)
  if (process.platform !== 'win32') {
    // Signal handlers don't work on Windows.
    process.on('SIGINT', function () {
      console.log('\nSolid stopped.')
      process.exit()
    })
  }

  // // Finally starting ldp-web
  const solid = require('../../')
  let app
  try {
    app = solid.createServer(argv, server)
  } catch (e) {
    if (e.code === 'EACCES') {
      if (e.syscall === 'mkdir') {
        console.log(red(bold('ERROR')), `You need permissions to create '${e.path}' folder`)
      } else {
        console.log(red(bold('ERROR')), 'You need root privileges to start on this port')
      }
      return 1
    }
    if (e.code === 'EADDRINUSE') {
      console.log(red(bold('ERROR')), 'The port ' + argv.port + ' is already in use')
      return 1
    }
    console.log(red(bold('ERROR')), e.message)
    return 1
  }
  app.listen(argv.port, function () {
    console.log(`Solid server (${argv.version}) running on \u001b[4mhttps://localhost:${argv.port}/\u001b[0m`)
    console.log('Press <ctrl>+c to stop')
  })
}
