module.exports = createApp

const express = require('express')
const session = require('express-session')
const uuid = require('uuid')
const cors = require('cors')
const LDP = require('./ldp')
const LdpMiddleware = require('./ldp-middleware')
const corsProxy = require('./handlers/cors-proxy')
const SolidHost = require('./models/solid-host')
const vhost = require('vhost')
const API = require('./api')
const errorRequestHandler = require('./handlers/error-request-handler')
const config = require('./server-config')
const defaults = require('../config/defaults')
const debug = require('./debug')
const path = require('path')
const ResourceMapper = require('./resource-mapper')
const aclCheck = require('@solid/acl-check')
const { version } = require('../package.json')

const corsSettings = cors({
  methods: [
    'OPTIONS', 'HEAD', 'GET', 'PATCH', 'POST', 'PUT', 'DELETE'
  ],
  exposedHeaders: 'Authorization, User, Location, Link, Vary, Last-Modified, ETag, Accept-Patch, Accept-Post, Updates-Via, Allow, WAC-Allow, Content-Length, WWW-Authenticate, MS-Author-Via',
  credentials: true,
  maxAge: 1728000,
  origin: true,
  preflightContinue: true
})

function createApp (argv = {}) {
  // Override default configs (defaults) with passed-in params (argv)
  argv = Object.assign({}, defaults, argv)

  argv.host = SolidHost.from(argv)

  argv.resourceMapper = new ResourceMapper({
    rootUrl: argv.serverUri,
    rootPath: path.resolve(argv.root || process.cwd()),
    includeHost: argv.multiuser,
    defaultContentType: argv.defaultContentType,
    solidIdUri: argv.solidIdUri
  })

  config.printDebugInfo(argv)

  const ldp = new LDP(argv)

  const app = express()

  initAppLocals(app, argv, ldp)
  initHeaders(app)
  initLoggers()

  // Add CORS proxy
  if (argv.proxy) {
    console.warn('The proxy configuration option has been renamed to corsProxy.')
    argv.corsProxy = argv.corsProxy || argv.proxy
    delete argv.proxy
  }
  if (argv.corsProxy) {
    corsProxy(app, argv.corsProxy)
  }

  // Options handler
  // app.options('/*', options)

  // Authenticate the user
  initWebId(argv, app, ldp)

  // Attach the LDP middleware
  app.use('/', LdpMiddleware(corsSettings))

  // Errors
  app.use(errorRequestHandler.handle)

  return app
}

/**
 * Initializes `app.locals` parameters for downstream use (typically by route
 * handlers).
 *
 * @param app {Function} Express.js app instance
 * @param argv {Object} Config options hashmap
 * @param ldp {LDP}
 */
function initAppLocals (app, argv, ldp) {
  app.locals.ldp = ldp
  app.locals.appUrls = argv.apps // used for service capability discovery
  app.locals.host = argv.host
  app.locals.enforceToc = argv.enforceToc
  app.locals.tocUri = argv.tocUri
  app.locals.disablePasswordChecks = argv.disablePasswordChecks
}

/**
 * Sets up headers common to all Solid requests (CORS-related, Allow, etc).
 *
 * @param app {Function} Express.js app instance
 */
function initHeaders (app) {
  app.use(corsSettings)

  app.use((req, res, next) => {
    res.set('X-Powered-By', 'ldp-web-server/' + version)

    // Cors lib adds Vary: Origin automatically, but inreliably
    res.set('Vary', 'Accept, Authorization, Origin')

    // Set default Allow methods
    res.set('Allow', 'OPTIONS, HEAD, GET, PATCH, POST, PUT, DELETE')
    next()
  })

  // app.use('/', capabilityDiscovery())
}

/**
 * Sets up WebID-related functionality (account creation and authentication)
 *
 * @param argv {Object}
 * @param app {Function}
 * @param ldp {LDP}
 */
function initWebId (argv, app, ldp) {
  // Store the user's session key in a cookie
  // (for same-domain browsing by people only)
  const useSecureCookies = !!argv.sslKey // use secure cookies when over HTTPS
  const sessionHandler = session(sessionSettings(useSecureCookies, argv.host))
  app.use(sessionHandler)
  // Reject cookies from third-party applications.
  // Otherwise, when a user is logged in to their Solid server,
  // any third-party application could perform authenticated requests
  // without permission by including the credentials set by the Solid server.
  app.use((req, res, next) => {
    const origin = req.get('origin')
    const trustedOrigins = ldp.getTrustedOrigins(req)
    const userId = req.session.userId
    // https://github.com/solid/node-solid-server/issues/1117
    if (!argv.strictOrigin && !argv.host.allowsSessionFor(userId, origin, trustedOrigins)) {
      debug.authentication(`Rejecting session for ${userId} from ${origin}`)
      // Destroy session data
      delete req.session.userId
      // Ensure this modified session is not saved
      req.session.save = (done) => done()
    }
    next()
  })

  // Set up authentication-related API endpoints and app.locals
  initAuthentication(app, argv)

  if (argv.multiuser) {
    app.use(vhost('*', LdpMiddleware(corsSettings)))
  }
}

function initLoggers () {
  aclCheck.configureLogger(debug.ACL)
}

/**
 * Sets up authentication-related routes and handlers for the app.
 *
 * @param app {Object} Express.js app instance
 * @param argv {Object} Config options hashmap
 */
function initAuthentication (app, argv) {
  API.authn.oidc.initialize(app, argv)
}

/**
 * Returns a settings object for Express.js sessions.
 *
 * @param secureCookies {boolean}
 * @param host {SolidHost}
 *
 * @return {Object} `express-session` settings object
 */
function sessionSettings (secureCookies, host) {
  const sessionSettings = {
    name: 'nssidp.sid',
    secret: uuid.v1(),
    saveUninitialized: false,
    resave: false,
    rolling: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000
    }
  }
  // Cookies should set to be secure if https is on
  if (secureCookies) {
    sessionSettings.cookie.secure = true
  }

  // Determine the cookie domain
  sessionSettings.cookie.domain = host.cookieDomain

  return sessionSettings
}
