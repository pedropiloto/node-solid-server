'use strict'
/**
 * OIDC Relying Party API handler module.
 */

const OidcManager = require('../../models/oidc-manager')

/**
 * Sets up OIDC authentication for the given app.
 *
 * @param app {Object} Express.js app instance
 * @param argv {Object} Config options hashmap
 */
function initialize (app, argv) {
  const oidc = OidcManager.resourceServerOnly(argv)
  oidc.initRs()
  // Perform the actual authentication
  app.use('/', async (req, res, next) => {
    oidc.rs.authenticate()(req, res, (err) => {
      // Error handling should be deferred to the ldp in case a user with a bad token is trying
      // to access a public resource
      if (err) {
        req.authError = err
        res.status(200)
      }
      next()
    })
  })

  // Expose session.userId
  app.use('/', (req, res, next) => {
    oidc.webIdFromClaims(req.claims)
      .then(webId => {
        if (webId) {
          req.session.userId = webId
        }

        next()
      })
      .catch(err => {
        let error = new Error('Could not verify Web ID from token claims')
        error.statusCode = 401
        error.statusText = 'Invalid login'
        error.cause = err

        console.error(err)

        next(error)
      })
  })
}

/**
 * Sets the `WWW-Authenticate` response header for 401 error responses.
 * Used by error-pages handler.
 *
 * @param req {IncomingRequest}
 * @param res {ServerResponse}
 * @param err {Error}
 */
function setAuthenticateHeader (req, res, err) {
  let locals = req.app.locals

  let errorParams = {
    realm: locals.host.serverUri,
    scope: 'openid webid',
    error: err.error,
    error_description: err.error_description,
    error_uri: err.error_uri
  }

  let challengeParams = Object.keys(errorParams)
    .filter(key => !!errorParams[key])
    .map(key => `${key}="${errorParams[key]}"`)
    .join(', ')

  res.set('WWW-Authenticate', 'Bearer ' + challengeParams)
}

/**
 * Provides custom logic for error status code overrides.
 *
 * @param statusCode {number}
 * @param req {IncomingRequest}
 *
 * @returns {number}
 */
function statusCodeOverride (statusCode, req) {
  if (isEmptyToken(req)) {
    return 400
  } else {
    return statusCode
  }
}

/**
 * Tests whether the `Authorization:` header includes an empty or missing Bearer
 * token.
 *
 * @param req {IncomingRequest}
 *
 * @returns {boolean}
 */
function isEmptyToken (req) {
  let header = req.get('Authorization')

  if (!header) { return false }

  if (header.startsWith('Bearer')) {
    let fragments = header.split(' ')

    if (fragments.length === 1) {
      return true
    } else if (!fragments[1]) {
      return true
    }
  }

  return false
}

module.exports = {
  initialize,
  isEmptyToken,
  setAuthenticateHeader,
  statusCodeOverride
}
