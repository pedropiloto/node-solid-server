const addLink = require('../header').addLink
const url = require('url')

module.exports = handler

function handler (req, res, next) {
  linkServiceEndpoint(req, res)
  linkAuthProvider(req, res)
  linkSparqlEndpoint(res)

  res.status(204)

  next()
}

function linkAuthProvider (req, res) {
  const locals = req.app.locals
  if (locals.authMethod === 'oidc') {
    const oidcProviderUri = locals.host.serverUri
    addLink(res, oidcProviderUri, 'http://openid.net/specs/connect/1.0/issuer')
  }
}

function linkServiceEndpoint (req, res) {
  const serviceEndpoint = url.resolve(req.app.locals.ldp.resourceMapper.resolveUrl(req.hostname, req.path), '.well-known/ldp-web')
  addLink(res, serviceEndpoint, 'service')
}

function linkSparqlEndpoint (res) {
  res.header('Accept-Patch', 'application/sparql-update')
}
