// Integration tests for PATCH with text/n3
const { assert } = require('chai')
const ldnode = require('../../index')
const path = require('path')
const supertest = require('supertest')
const fs = require('fs')
const { read, rm, backup, restore } = require('../utils')

// Server settings
const port = 7777
const serverUri = `https://tim.localhost:${port}`
const root = path.join(__dirname, '../resources/patch')
const configPath = path.join(__dirname, '../resources/config')
const serverOptions = {
  root,
  configPath,
  serverUri,
  multiuser: false,
  webid: true,
  sslKey: path.join(__dirname, '../keys/key.pem'),
  sslCert: path.join(__dirname, '../keys/cert.pem'),
  forceUser: `${serverUri}/profile/card#me`,
  solidIdUri: 'https://localhost:8443'
}

describe('PATCH', () => {
  var request
  let server

  // Start the server
  before(done => {
    server = ldnode.createServer(serverOptions)
    server.listen(port, done)
    request = supertest(serverUri)
  })

  after(() => {
    server.close()
  })

  describe('with a patch document', () => {
    describe('with an unsupported content type', describePatch({
      path: '/read-write.ttl',
      patch: 'other syntax',
      contentType: 'text/other'
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/read-write.ttl"}'
    }))

    describe('containing invalid syntax', describePatch({
      path: '/read-write.ttl',
      patch: 'invalid syntax'
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/read-write.ttl"}'
    }))

    describe('without relevant patch element', describePatch({
      path: '/read-write.ttl',
      patch: '<> a solid:Patch.'
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/read-write.ttl"}'
    }))

    describe('with neither insert nor delete', describePatch({
      path: '/read-write.ttl',
      patch: '<> solid:patches <https://tim.localhost:7777/read-write.ttl>.'
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/read-write.ttl"}'
    }))
  })

  describe('with insert', () => {
    describe('on a non-existing file', describePatch({
      path: '/new.ttl',
      exists: false,
      patch: `<> solid:patches <https://tim.localhost:7777/new.ttl>;
                 solid:inserts { <x> <y> <z>. }.`
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/new.ttl"}',
      result: '@prefix : </new.ttl#>.\n@prefix tim: </>.\n\ntim:x tim:y tim:z.\n\n'
    }))

    describe('on a resource with read-only access', describePatch({
      path: '/read-only.ttl',
      patch: `<> solid:patches <https://tim.localhost:7777/read-only.ttl>;
                 solid:inserts { <x> <y> <z>. }.`
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/read-only.ttl"}'
    }))

    describe('on a resource with append-only access', describePatch({
      path: '/append-only.ttl',
      patch: `<> solid:patches <https://tim.localhost:7777/append-only.ttl>;
                 solid:inserts { <x> <y> <z>. }.`
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/append-only.ttl"}',
      result: '@prefix : </append-only.ttl#>.\n@prefix tim: </>.\n\ntim:a tim:b tim:c.\n\ntim:d tim:e tim:f.\n\ntim:x tim:y tim:z.\n\n'
    }))

    describe('on a resource with write-only access', describePatch({
      path: '/write-only.ttl',
      patch: `<> solid:patches <https://tim.localhost:7777/write-only.ttl>;
                 solid:inserts { <x> <y> <z>. }.`
    }, { // expected:
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/write-only.ttl"}',
      result: '<a> <b> <c>.\n<d> <e> <f>.\n'
    }))

    describe('on a resource with parent folders that do not exist', describePatch({
      path: '/folder/cool.ttl',
      exists: false,
      patch: `<> solid:patches <https://tim.localhost:7777/folder/cool.ttl>;
        solid:inserts { <x> <y> <z>. }.`
    }, {
      status: 401,
      text: '{"error":"Unauthorized","currentUrl":"https://tim.localhost:7777/folder/cool.ttl"}',
      result: '@prefix : <#>.\n@prefix fol: <./>.\n\nfol:x fol:y fol:z.\n\n'
    }))
  })

  // Creates a PATCH test for the given resource with the given expected outcomes
  function describePatch ({ path, exists = true, patch, contentType = 'text/n3' },
    { status = 200, text, result }) {
    return () => {
      const filename = `patch${path}`
      var originalContents
      // Back up and restore an existing file
      if (exists) {
        before(() => backup(filename))
        after(() => restore(filename))
        // Store its contents to verify non-modification
        if (!result) {
          originalContents = read(filename)
        }
      // Ensure a non-existing file is removed
      } else {
        before(() => rm(filename))
        after(() => rm(filename))
      }

      // Create the request and obtain the response
      var response
      before((done) => {
        request.patch(path)
          .set('Content-Type', contentType)
          .send(`@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n${patch}`)
          .then(res => { response = res })
          .then(done, done)
      })

      // Verify the response's status code and body text
      it(`returns HTTP status code ${status}`, () => {
        assert.isObject(response)
        assert.equal(response.statusCode, status)
      })
      it(`has "${text}" in the response`, () => {
        assert.isObject(response)
        assert.include(response.text, text)
      })

      // For existing files, verify correct patch application
      if (exists) {
        if (!result) {
          it('does not modify the file', () => {
            assert.equal(read(filename), originalContents)
          })
        }
      // For non-existing files, verify creation and contents
      } else {
        if (!result) {
          it('does not create the file', () => {
            assert.isFalse(fs.existsSync(`${root}/${path}`))
          })
        }
      }
    }
  }
})
