const supertest = require('supertest')
const { rm, checkDnsSettings, cleanDir } = require('../utils')
const ldnode = require('../../index')
const path = require('path')
const fs = require('fs-extra')

describe('AccountManager (OIDC account creation tests)', function () {
  const port = 3457
  const serverUri = `https://localhost:${port}`
  const host = `localhost:${port}`
  const root = path.join(__dirname, '../resources/accounts/')
  const configPath = path.join(__dirname, '../resources/config')
  const dbPath = path.join(__dirname, '../resources/accounts/db')

  let ldpHttpsServer

  var ldp = ldnode.createServer({
    root,
    configPath,
    sslKey: path.join(__dirname, '../keys/key.pem'),
    sslCert: path.join(__dirname, '../keys/cert.pem'),
    auth: 'oidc',
    webid: true,
    multiuser: true,
    strictOrigin: true,
    dbPath,
    serverUri,
    enforceToc: true
  })

  before(checkDnsSettings)

  before(function (done) {
    ldpHttpsServer = ldp.listen(port, done)
  })

  after(function () {
    if (ldpHttpsServer) ldpHttpsServer.close()
    fs.removeSync(path.join(dbPath, 'oidc/users/users'))
    cleanDir(path.join(root, 'localhost'))
  })

  var server = supertest(serverUri)

  it('should expect a 404 on GET /accounts', function (done) {
    server.get('/api/accounts')
      .expect(404, done)
  })

  describe('accessing accounts', function () {
    it('should be able to access public file of an account', function (done) {
      var subdomain = supertest('https://tim.' + host)
      subdomain.get('/hello.html')
        .expect(404, done)
    })
    it('should get 404 if root does not exist', function (done) {
      var subdomain = supertest('https://nicola.' + host)
      subdomain.get('/')
        .set('Accept', 'text/turtle')
        .set('Origin', 'http://example.com')
        .expect(404)
        .expect('Access-Control-Allow-Origin', 'http://example.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .end(function (err, res) {
          done(err)
        })
    })
  })

  describe('creating an account with POST', function () {
    beforeEach(function () {
      rm('accounts/nicola.localhost')
    })

    after(function () {
      rm('accounts/nicola.localhost')
    })

    it('should not create WebID if no username is given', (done) => {
      const subdomain = supertest('https://' + host)
      subdomain.post('/api/accounts/new')
        .send('username=&password=12345')
        .expect(404, done)
    })

    it('should not create WebID if no password is given', (done) => {
      const subdomain = supertest('https://' + host)
      subdomain.post('/api/accounts/new')
        .send('username=nicola&password=')
        .expect(404, done)
    })

    it('should not create a WebID if it already exists', function (done) {
      var subdomain = supertest('https://' + host)
      subdomain.post('/api/accounts/new')
        .send('username=nicola&password=12345&acceptToc=true')
        .expect(404)
        .end((err, res) => {
          if (err) {
            return done(err)
          }
          subdomain.post('/api/accounts/new')
            .send('username=nicola&password=12345&acceptToc=true')
            .expect(404)
            .end((err) => {
              done(err)
            })
        })
    })

    it('should not create WebID if T&C is not accepted', (done) => {
      const subdomain = supertest('https://' + host)
      subdomain.post('/api/accounts/new')
        .send('username=nicola&password=12345&acceptToc=')
        .expect(404, done)
    })

    describe('after setting up account', () => {
      beforeEach(done => {
        var subdomain = supertest('https://' + host)
        subdomain.post('/api/accounts/new')
          .send('username=nicola&password=12345&acceptToc=true')
          .end(done)
      })

      it('should create a private settings container', function (done) {
        var subdomain = supertest('https://nicola.' + host)
        subdomain.head('/settings/')
          .expect(404)
          .end(function (err) {
            done(err)
          })
      })

      it('should create a private prefs file in the settings container', function (done) {
        var subdomain = supertest('https://nicola.' + host)
        subdomain.head('/inbox/prefs.ttl')
          .expect(404)
          .end(function (err) {
            done(err)
          })
      })

      it('should create a private inbox container', function (done) {
        var subdomain = supertest('https://nicola.' + host)
        subdomain.head('/inbox/')
          .expect(404)
          .end(function (err) {
            done(err)
          })
      })
    })
  })
})

describe('Signup page where Terms & Conditions are not being enforced', () => {
  const port = 3457
  const host = `localhost:${port}`
  const root = path.join(__dirname, '../resources/accounts/')
  const configPath = path.join(__dirname, '../resources/config')
  const dbPath = path.join(__dirname, '../resources/accounts/db')
  const ldp = ldnode.createServer({
    port,
    root,
    configPath,
    sslKey: path.join(__dirname, '../keys/key.pem'),
    sslCert: path.join(__dirname, '../keys/cert.pem'),
    auth: 'oidc',
    webid: true,
    multiuser: true,
    strictOrigin: true,
    enforceToc: false
  })
  let ldpHttpsServer

  before(function (done) {
    ldpHttpsServer = ldp.listen(port, done)
  })

  after(function () {
    if (ldpHttpsServer) ldpHttpsServer.close()
    fs.removeSync(path.join(dbPath, 'oidc/users/users'))
    cleanDir(path.join(root, 'localhost'))
    rm('accounts/nicola.localhost')
  })

  beforeEach(function () {
    rm('accounts/nicola.localhost')
  })

  it('should not enforce T&C upon creating account', function (done) {
    var subdomain = supertest('https://' + host)
    subdomain.post('/api/accounts/new')
      .send('username=nicola&password=12345')
      .expect(404, done)
  })
})
