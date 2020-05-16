'use strict'

const debug = require('./../debug').authentication

const AuthRequest = require('./auth-request')
const { publishMessage } = require('../services/publish-service')

const url = require('url')
const intoStream = require('into-stream')

const $rdf = require('rdflib')
const ACL = $rdf.Namespace('http://www.w3.org/ns/auth/acl#')

/**
 * Models a local Login request
 */
class SharingRequest extends AuthRequest {
  /**
   * @constructor
   * @param options {Object}
   *
   * @param [options.response] {ServerResponse} middleware `res` object
   * @param [options.session] {Session} req.session
   * @param [options.userStore] {UserStore}
   * @param [options.accountManager] {AccountManager}
   * @param [options.returnToUrl] {string}
   * @param [options.authQueryParams] {Object} Key/value hashmap of parsed query
   *   parameters that will be passed through to the /authorize endpoint.
   * @param [options.authenticator] {Authenticator} Auth strategy by which to
   *   log in
   */
  constructor (options) {
    super(options)

    this.authenticator = options.authenticator
    this.authMethod = options.authMethod
  }

  /**
   * Factory method, returns an initialized instance of LoginRequest
   * from an incoming http request.
   *
   * @param req {IncomingRequest}
   * @param res {ServerResponse}
   * @param authMethod {string}
   *
   * @return {LoginRequest}
   */
  static fromParams (req, res) {
    const options = AuthRequest.requestOptions(req, res)

    return new SharingRequest(options)
  }

  /**
   * Handles a Login GET request on behalf of a middleware handler, displays
   * the Login page.
   * Usage:
   *
   *   ```
   *   app.get('/login', LoginRequest.get)
   *   ```
   *
   * @param req {IncomingRequest}
   * @param res {ServerResponse}
   */
  static async get (req, res) {
    const request = SharingRequest.fromParams(req, res)

    const appUrl = request.getAppUrl()
    const appOrigin = appUrl.origin
    const serverUrl = new url.URL(req.app.locals.ldp.serverUri)

    // Check if is already registered or is data browser or the webId is not on this machine
    const user = await request.userStore.findUser(request.session.userId.replace('https://', ''))
    if (request.isUserLoggedIn()) {
      if (
        !request.isSubdomain(serverUrl.host, new url.URL(request.session.subject._id).host) ||
        (appUrl && request.isSubdomain(serverUrl.host, appUrl.host) && appUrl.protocol === serverUrl.protocol) ||
        user.trustedApps.includes(appOrigin)
      ) {
        request.setUserShared(appOrigin)
        request.redirectPostSharing()
      } else {
        request.renderForm(null, req, appOrigin)
      }
    } else {
      request.redirectPostSharing()
    }
  }

  /**
   * Performs the login operation -- loads and validates the
   * appropriate user, inits the session with credentials, and redirects the
   * user to continue their auth flow.
   *
   * @param request {LoginRequest}
   *
   * @return {Promise}
   */
  static async share (req, res) {
    let accessModes = []
    let consented = false
    if (req.body) {
      accessModes = req.body.access_mode || []
      if (!Array.isArray(accessModes)) {
        accessModes = [accessModes]
      }
      consented = req.body.consent
    }

    const request = SharingRequest.fromParams(req, res)

    if (request.isUserLoggedIn()) {
      const appUrl = request.getAppUrl()
      const appOrigin = `${appUrl.protocol}//${appUrl.host}`
      debug('Sharing App')

      if (consented) {
        await request.registerApp(request.userStore, appOrigin, request.session.userId.replace('https://', ''))

        publishMessage('solid-id.account.register-app', JSON.stringify({
          event: 'register_app',
          object: { appOrigin, accessModes, webId: request.session.subject._id }
        }))
          .catch(error => {
            error.message = 'Error setting account storage to be created: ' + error.message
            throw error
          })
          .then(() => {
            debug('Account storage resources set to be created')
          })
        request.setUserShared(appOrigin)
      }

      // Redirect once that's all done
      request.redirectPostSharing()
    } else {
      request.redirectPostSharing()
    }
  }

  isSubdomain (domain, subdomain) {
    const domainArr = domain.split('.')
    const subdomainArr = subdomain.split('.')
    for (let i = 1; i <= domainArr.length; i++) {
      if (subdomainArr[subdomainArr.length - i] !== domainArr[domainArr.length - i]) {
        return false
      }
    }
    return true
  }

  setUserShared (appOrigin) {
    if (!this.session.consentedOrigins) {
      this.session.consentedOrigins = []
    }
    if (!this.session.consentedOrigins.includes(appOrigin)) {
      this.session.consentedOrigins.push(appOrigin)
    }
  }

  isUserLoggedIn () {
    // Ensure the user arrived here by logging in
    return !!(this.session.subject && this.session.subject._id)
  }

  getAppUrl () {
    return new url.URL(this.authQueryParams.redirect_uri)
  }

  async getProfileGraph (ldp, webId) {
    return await new Promise(async (resolve, reject) => {
      const store = $rdf.graph()
      const profileText = await ldp.readResource(webId)
      $rdf.parse(profileText.toString(), store, this.getWebIdFile(webId), 'text/turtle', (error, kb) => {
        if (error) {
          reject(error)
        } else {
          resolve(kb)
        }
      })
    })
  }

  async saveProfileGraph (ldp, store, webId) {
    const text = $rdf.serialize(undefined, store, this.getWebIdFile(webId), 'text/turtle')
    await ldp.put(webId, intoStream(text), 'text/turtle')
  }

  getWebIdFile (webId) {
    const webIdurl = new url.URL(webId)
    return `${webIdurl.origin}${webIdurl.pathname}`
  }

  async isAppRegistered (ldp, appOrigin, webId) {
    const store = await this.getProfileGraph(ldp, webId)
    return store.each($rdf.sym(webId), ACL('trustedApp')).find((app) => {
      return store.each(app, ACL('origin')).find(rdfAppOrigin => rdfAppOrigin.value === appOrigin)
    })
  }

  async registerApp (userStore, appOrigin, webId) {
    const user = await userStore.findUser(webId)
    user.trustedApps ? user.trustedApps.push(appOrigin) : user.trustedApps = Array.of(appOrigin)
    user.id = webId
    userStore.saveUser(user).catch(error => {
      error.message = 'Error registering app: ' + appOrigin + ' to user ' + webId + ' Error: ' + error.message
      throw error
    })
      .then(() =>
        debug('Registered app: ' + appOrigin + ' to user: ' + webId))
  }

  /**
   * Returns a URL to redirect the user to after login.
   * Either uses the provided `redirect_uri` auth query param, or simply
   * returns the user profile URI if none was provided.
   *
   * @param validUser {UserAccount}
   *
   * @return {string}
   */
  postSharingUrl () {
    return this.authorizeUrl()
  }

  /**
   * Redirects the Login request to continue on the OIDC auth workflow.
   */
  redirectPostSharing () {
    const uri = this.postSharingUrl()
    debug('Login successful, redirecting to ', uri)
    this.response.redirect(uri)
  }

  /**
   * Renders the login form
   */
  renderForm (error, req, appOrigin) {
    const queryString = req && req.url && req.url.replace(/[^?]+\?/, '') || ''
    const params = Object.assign({}, this.authQueryParams,
      {
        registerUrl: this.registerUrl(),
        returnToUrl: this.returnToUrl,
        enablePassword: this.localAuth.password,
        enableTls: this.localAuth.tls,
        tlsUrl: `/login/tls?${encodeURIComponent(queryString)}`,
        app_origin: appOrigin
      })

    if (error) {
      params.error = error.message
      this.response.status(error.statusCode)
    }

    this.response.render('auth/sharing', params)
  }
}

module.exports = {
  SharingRequest
}
