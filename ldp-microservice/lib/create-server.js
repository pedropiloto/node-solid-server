module.exports = createServer

const express = require('express')
const fs = require('fs')
const https = require('https')
const http = require('http')
const SolidWs = require('solid-ws')
const debug = require('./debug')
const createApp = require('./create-app')

function createServer (argv, app) {
  argv = argv || {}
  app = app || express()
  const ldpApp = createApp(argv)
  const ldp = ldpApp.locals.ldp || {}
  let mount = argv.mount || '/'
  // Removing ending '/'
  if (mount.length > 1 &&
    mount[mount.length - 1] === '/') {
    mount = mount.slice(0, -1)
  }
  app.use(mount, ldpApp)
  debug.settings('Base URL (--mount): ' + mount)

  let server
  const needsTLS = argv.sslKey || argv.sslCert
  if (!needsTLS) {
    server = http.createServer(app)
  } else {
    debug.settings('SSL Private Key path: ' + argv.sslKey)
    debug.settings('SSL Certificate path: ' + argv.sslCert)

    if (!argv.sslCert && !argv.sslKey) {
      throw new Error('Missing SSL cert and SSL key to enable WebIDs')
    }

    if (!argv.sslKey && argv.sslCert) {
      throw new Error('Missing path for SSL key')
    }

    if (!argv.sslCert && argv.sslKey) {
      throw new Error('Missing path for SSL cert')
    }

    let key
    try {
      key = fs.readFileSync(argv.sslKey)
    } catch (e) {
      throw new Error('Can\'t find SSL key in ' + argv.sslKey)
    }

    let cert
    try {
      cert = fs.readFileSync(argv.sslCert)
    } catch (e) {
      throw new Error('Can\'t find SSL cert in ' + argv.sslCert)
    }

    const credentials = Object.assign({
      key: key,
      cert: cert
    }, argv)

    if (ldp.webid && ldp.auth === 'tls') {
      credentials.requestCert = true
    }

    server = https.createServer(credentials, app)
  }

  // Setup Express app
  if (ldp.live) {
    const solidWs = SolidWs(server, ldpApp)
    ldpApp.locals.ldp.live = solidWs.publish.bind(solidWs)
  }

  return server
}
