var assert = require('chai').assert
var supertest = require('supertest')
var path = require('path')
// Helper functions for the FS
const { rm, write, read } = require('../utils')

var ldnode = require('../../index')

describe('LDNODE params', function () {
  describe('suffixMeta', function () {
    describe('not passed', function () {
      it('should fallback on .meta', function () {
        var ldp = ldnode({
          webid: false, solidIdUri: 'https://localhost:8443'
        })
        assert.equal(ldp.locals.ldp.suffixMeta, '.meta')
      })
    })
  })

  describe('suffixAcl', function () {
    describe('not passed', function () {
      it('should fallback on .acl', function () {
        var ldp = ldnode({
          webid: false, solidIdUri: 'https://localhost:8443'
        })
        assert.equal(ldp.locals.ldp.suffixAcl, '.acl')
      })
    })
  })

  describe('root', function () {
    describe('not passed', function () {
      var ldp = ldnode({
        webid: false, solidIdUri: 'https://localhost:8443'
      })
      var server = supertest(ldp)

      it('should fallback on current working directory', function () {
        assert.equal(ldp.locals.ldp.resourceMapper._rootPath, process.cwd())
      })

      it('should find resource in correct path', function (done) {
        write(
          '<#current> <#temp> 123 .',
          'sampleContainer/example.ttl')

        // This assums npm test is run from the folder that contains package.js
        server.get('/test/resources/sampleContainer/example.ttl')
          .expect('Link', /http:\/\/www.w3.org\/ns\/ldp#Resource/)
          .expect(200)
          .end(function (err, res, body) {
            assert.equal(read('sampleContainer/example.ttl'), '<#current> <#temp> 123 .')
            rm('sampleContainer/example.ttl')
            done(err)
          })
      })
    })

    describe('passed', function () {
      var ldp = ldnode({
        root: './test/resources/', webid: false, solidIdUri: 'https://localhost:8443'
      })
      var server = supertest(ldp)

      it('should fallback on current working directory', function () {
        assert.equal(ldp.locals.ldp.resourceMapper._rootPath, path.resolve('./test/resources'))
      })

      it('should find resource in correct path', function (done) {
        write(
          '<#current> <#temp> 123 .',
          'sampleContainer/example.ttl')

        // This assums npm test is run from the folder that contains package.js
        server.get('/sampleContainer/example.ttl')
          .expect('Link', /http:\/\/www.w3.org\/ns\/ldp#Resource/)
          .expect(200)
          .end(function (err, res, body) {
            assert.equal(read('sampleContainer/example.ttl'), '<#current> <#temp> 123 .')
            rm('sampleContainer/example.ttl')
            done(err)
          })
      })
    })
  })

  describe('ui-path', function () {
    const rootPath = './test/resources/'
    var ldp = ldnode({
      root: rootPath,
      apiApps: path.join(__dirname, '../resources/sampleContainer'),
      webid: false,
      solidIdUri: 'https://localhost:8443'
    })
    var server = supertest(ldp)

    it('should serve static files on /api/ui', (done) => {
      server.get('/api/apps/ldp-web.png')
        .expect(404)
        .end(done)
    })
  })
})
