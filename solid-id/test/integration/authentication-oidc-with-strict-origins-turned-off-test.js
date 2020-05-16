const Solid = require('../../index')
const path = require('path')
const fs = require('fs-extra')
const { UserStore } = require('oidc-auth-manager-adapted')
const UserAccount = require('../../lib/models/user-account')
const SolidAuthOIDC = require('@solid/solid-auth-oidc')

const fetch = require('node-fetch')
const localStorage = require('localstorage-memory')
const URL = require('whatwg-url').URL
global.URL = URL
global.URLSearchParams = require('whatwg-url').URLSearchParams
const { cleanDir, cp } = require('../utils')

const supertest = require('supertest')
const chai = require('chai')
const expect = chai.expect
chai.use(require('dirty-chai'))

// In this test we always assume that we are Alice

describe('Authentication API (OIDC) - With strict origins turned off', () => {
  let alice

  const aliceServerPort = 7010
  const aliceServerUri = `https://localhost:${aliceServerPort}`
  const aliceWebId = `https://localhost:${aliceServerPort}/profile/card#me`
  const configPath = path.join(__dirname, '../resources/config')
  const aliceDbPath = path.join(__dirname, '../resources/accounts-strict-origin-off/alice/db')
  const userStorePath = path.join(aliceDbPath, 'oidc/users')
  const aliceUserStore = UserStore.from({ path: userStorePath, saltRounds: 1 })
  aliceUserStore.initCollections()

  const bobServerPort = 7011
  const bobServerUri = `https://localhost:${bobServerPort}`
  const bobDbPath = path.join(__dirname, '../resources/accounts-strict-origin-off/bob/db')

  const serverConfig = {
    sslKey: path.join(__dirname, '../keys/key.pem'),
    sslCert: path.join(__dirname, '../keys/cert.pem'),
    auth: 'oidc',
    dataBrowser: false,
    webid: true,
    multiuser: false,
    configPath,
    strictOrigin: false
  }

  const aliceRootPath = path.join(__dirname, '../resources/accounts-strict-origin-off/alice')
  const alicePod = Solid.createServer(
    Object.assign({
      root: aliceRootPath,
      serverUri: aliceServerUri,
      dbPath: aliceDbPath
    }, serverConfig)
  )
  const bobRootPath = path.join(__dirname, '../resources/accounts-strict-origin-off/bob')
  const bobPod = Solid.createServer(
    Object.assign({
      root: bobRootPath,
      serverUri: bobServerUri,
      dbPath: bobDbPath
    }, serverConfig)
  )

  function startServer (pod, port) {
    return new Promise((resolve) => {
      pod.listen(port, () => { resolve() })
    })
  }

  before(async () => {
    await Promise.all([
      startServer(alicePod, aliceServerPort),
      startServer(bobPod, bobServerPort)
    ]).then(() => {
      alice = supertest(aliceServerUri)
    })
    cp(path.join('accounts-strict-origin-off/alice', '.acl-override'), path.join('accounts-strict-origin-off/alice', '.acl'))
    cp(path.join('accounts-strict-origin-off/bob', '.acl-override'), path.join('accounts-strict-origin-off/bob', '.acl'))
  })

  after(() => {
    alicePod.close()
    bobPod.close()
    fs.removeSync(path.join(aliceDbPath, 'oidc/users'))
    cleanDir(aliceRootPath)
    cleanDir(bobRootPath)
  })

  describe('Login page (GET /login)', () => {
    it('should load the user login form', () => alice.get('/login').expect(200))
  })

  describe('Login by Username and Password (POST /login/password)', () => {
    // Logging in as alice, to alice's pod
    const aliceAccount = UserAccount.from({ webId: aliceWebId })
    const alicePassword = '12345'

    beforeEach(() => {
      aliceUserStore.initCollections()

      return aliceUserStore.createUser(aliceAccount, alicePassword)
        .catch(console.error.bind(console))
    })

    afterEach(() => {
      fs.removeSync(path.join(aliceDbPath, 'users/users'))
    })

    describe('after performing a correct login', () => {
      let response, cookie
      before(done => {
        aliceUserStore.initCollections()
        aliceUserStore.createUser(aliceAccount, alicePassword)
        alice.post('/login/password')
          .type('form')
          .send({ username: 'alice' })
          .send({ password: alicePassword })
          .end((err, res) => {
            response = res
            cookie = response.headers['set-cookie'][0]
            done(err)
          })
      })

      it('should redirect to /authorize', () => {
        const loginUri = response.headers.location
        expect(response).to.have.property('status', 302)
        expect(loginUri.startsWith(aliceServerUri + '/authorize'))
      })

      it('should set the cookie', () => {
        expect(cookie).to.match(/nssidp.sid=\S{65,100}/)
      })

      it('should set the cookie with HttpOnly', () => {
        expect(cookie).to.match(/HttpOnly/)
      })

      it('should set the cookie with Secure', () => {
        expect(cookie).to.match(/Secure/)
      })
    })

    it('should throw a 400 if no username is provided', (done) => {
      alice.post('/login/password')
        .type('form')
        .send({ password: alicePassword })
        .expect(400, done)
    })

    it('should throw a 400 if no password is provided', (done) => {
      alice.post('/login/password')
        .type('form')
        .send({ username: 'alice' })
        .expect(400, done)
    })

    it('should throw a 400 if user is found but no password match', (done) => {
      alice.post('/login/password')
        .type('form')
        .send({ username: 'alice' })
        .send({ password: 'wrongpassword' })
        .expect(400, done)
    })
  })

  describe('Two Pods + Web App Login Workflow', () => {
    const aliceAccount = UserAccount.from({ webId: aliceWebId })
    const alicePassword = '12345'

    let auth
    let authorizationUri, loginUri, authParams, callbackUri
    let loginFormFields = ''
    let cookie
    let postLoginUri

    before(() => {
      auth = new SolidAuthOIDC({ store: localStorage, window: { location: {} } })
      const appOptions = {
        redirectUri: 'https://app.example.com/callback'
      }

      aliceUserStore.initCollections()

      return aliceUserStore.createUser(aliceAccount, alicePassword)
        .then(() => {
          return auth.registerClient(aliceServerUri, appOptions)
        })
        .then(registeredClient => {
          auth.currentClient = registeredClient
        })
    })

    after(() => {
      fs.removeSync(path.join(aliceDbPath, 'users/users'))
      fs.removeSync(path.join(aliceDbPath, 'oidc/op/tokens'))

      const clientId = auth.currentClient.registration.client_id
      const registration = `_key_${clientId}.json`
      fs.removeSync(path.join(aliceDbPath, 'oidc/op/clients', registration))
    })

    // Step 1: An app makes a GET request and receives a 401
    it('should get a 401 error on a REST request to a protected resource', () => {
      return fetch(bobServerUri + '/shared-with-alice.txt')
        .then(res => {
          expect(res.status).to.equal(404)

          expect(res.headers.get('www-authenticate'))
        })
    })

    // Step 2: App presents the Select Provider UI to user, determine the
    //   preferred provider uri (here, aliceServerUri), and constructs
    //   an authorization uri for that provider
    it('should determine the authorization uri for a preferred provider', () => {
      return auth.currentClient.createRequest({}, auth.store)
        .then(authUri => {
          authorizationUri = authUri

          expect(authUri.startsWith(aliceServerUri + '/authorize')).to.be.true()
        })
    })

    // Step 3: App redirects user to the authorization uri for login
    it('should redirect user to /authorize and /login', () => {
      return fetch(authorizationUri, { redirect: 'manual' })
        .then(res => {
          // Since user is not logged in, /authorize redirects to /login
          expect(res.status).to.equal(302)

          loginUri = new URL(res.headers.get('location'))
          expect(loginUri.toString().startsWith(aliceServerUri + '/login'))
            .to.be.true()

          authParams = loginUri.searchParams
        })
    })

    // Step 4: Pod returns a /login page with appropriate hidden form fields
    it('should display the /login form', () => {
      return fetch(loginUri.toString())
        .then(loginPage => {
          return loginPage.text()
        })
        .then(pageText => {
          // Login page should contain the relevant auth params as hidden fields

          authParams.forEach((value, key) => {
            const hiddenField = `<input type="hidden" name="${key}" id="${key}" value="${value}" />`

            const fieldRegex = new RegExp(hiddenField)

            expect(pageText).to.match(fieldRegex)

            loginFormFields += `${key}=` + encodeURIComponent(value) + '&'
          })
        })
    })

    // Step 5: User submits their username & password via the /login form
    it('should login via the /login form', () => {
      loginFormFields += `username=${'alice'}&password=${alicePassword}`

      return fetch(aliceServerUri + '/login/password', {
        method: 'POST',
        body: loginFormFields,
        redirect: 'manual',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        credentials: 'include'
      })
        .then(res => {
          expect(res.status).to.equal(302)
          postLoginUri = res.headers.get('location')
          cookie = res.headers.get('set-cookie')

          // Successful login gets redirected back to /authorize and then
          // back to app
          expect(postLoginUri.startsWith(aliceServerUri + '/sharing'))
            .to.be.true()
        })
    })

    // Step 6: User consents to the app accessing certain things
    it('should consent via the /sharing form', () => {
      loginFormFields += '&access_mode=Read&access_mode=Write&consent=true'

      return fetch(aliceServerUri + '/sharing', {
        method: 'POST',
        body: loginFormFields,
        redirect: 'manual',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        credentials: 'include'
      })
        .then(res => {
          expect(res.status).to.equal(302)
          const postLoginUri = res.headers.get('location')
          const cookie = res.headers.get('set-cookie')

          // Successful login gets redirected back to /authorize and then
          // back to app
          expect(postLoginUri.startsWith(aliceServerUri + '/authorize'))
            .to.be.true()

          return fetch(postLoginUri, { redirect: 'manual', headers: { cookie } })
        })
        .then(res => {
        // User gets redirected back to original app
          expect(res.status).to.equal(302)
          callbackUri = res.headers.get('location')
          expect(callbackUri.startsWith('https://app.example.com#'))
        })
    })
  })
})
