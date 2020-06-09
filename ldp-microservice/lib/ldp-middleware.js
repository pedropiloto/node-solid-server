module.exports = LdpMiddleware

const express = require('express')
const header = require('./header')
const allow = require('./controllers/allow')
const get = require('./controllers/get')
const post = require('./controllers/post')
const put = require('./controllers/put')
const del = require('./controllers/delete')
const patch = require('./controllers/patch')
const index = require('./controllers/index')
const copy = require('./controllers/copy')

function LdpMiddleware (corsSettings) {
  const router = express.Router('/')

  // Add Link headers
  router.use(header.linksHandler)

  if (corsSettings) {
    router.use(corsSettings)
  }

  router.copy('/*', allow('Write'), copy)
  router.get('/*', index, allow('Read'), header.addPermissions, get)
  router.post('/*', allow('Append'), post)
  router.patch('/*', allow('Append'), patch)
  router.put('/*', allow('Write'), put)
  router.delete('/*', allow('Write', true), del)

  return router
}
