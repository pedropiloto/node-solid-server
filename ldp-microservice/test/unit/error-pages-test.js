'use strict'
const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai
chai.use(require('sinon-chai'))
chai.use(require('dirty-chai'))
chai.should()

const errorPages = require('../../lib/handlers/error-request-handler')

describe('handlers/error-pages', () => {
  describe('handler()', () => {
    it('should use the custom error handler if available', () => {
      const ldp = { errorHandler: sinon.stub() }
      const req = { app: { locals: { ldp } } }
      const res = { status: sinon.stub(), send: sinon.stub() }
      const err = {}
      const next = {}

      errorPages.handle(err, req, res, next)

      expect(ldp.errorHandler).to.have.been.calledWith(err, req, res, next)

      expect(res.status).to.not.have.been.called()
      expect(res.send).to.not.have.been.called()
    })
  })

  describe('sendErrorResponse()', () => {
    it('should send http status code and error message', () => {
      const statusCode = 404
      const error = {
        message: 'Error description'
      }
      const res = {
        status: sinon.stub(),
        header: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub()
      }

      errorPages.sendErrorResponse(statusCode, res, error)

      expect(res.status).to.have.been.calledWith(404)
      expect(res.header).to.have.been.calledWith('Content-Type', 'application/json')
    })
  })

  describe('sendErrorPage()', () => {
    it('falls back the default sendErrorResponse if no page is found', () => {
      const statusCode = 400
      const res = {
        status: sinon.stub(),
        header: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub()
      }
      const err = { message: 'Error description' }
      const ldp = { errorPages: './' }

      return errorPages.sendErrorPage(statusCode, res, err, ldp)
        .then(() => {
          expect(res.status).to.have.been.calledWith(400)
          expect(res.header).to.have.been.calledWith('Content-Type', 'application/json')
        })
    })
  })
})
