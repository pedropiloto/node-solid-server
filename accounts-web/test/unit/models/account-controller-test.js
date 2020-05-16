const chai = require('chai')
const { stub } = require('sinon')
var sinonChai = require('sinon-chai')

const publisher = require('../../../app/publisher')
const accountController = require('../../../app/api/controllers/account-controller')
const { mockRequest, mockResponse } = require('mock-req-res')
chai.use(sinonChai)
const expect = chai.expect
const assert = chai.assert

describe('Account Controller', () => {
  describe('Given the user parameters with a valid email', () => {
    const parameters = {
      username: 'user',
      name: 'user',
      email: 'user@email.com',
      password: 'password'
    }
    describe('when create an account', () => {
      const publishMessageStub = stub(publisher, 'publishMessage').returns(true)
      it('should publish the message to the Message Broker', () => {
        const req = mockRequest({
          body: parameters
        })
        const res = mockResponse({})
        accountController.create(req, res)
        assert(expect(publishMessageStub).to.have.been.calledOnce, true)
      })
      it('should publish the message to the Message Broker with the correct routing key', () => {
        const req = mockRequest({
          body: parameters
        })
        const res = mockResponse({})
        accountController.create(req, res)
        expect(publishMessageStub).to.have.been.calledWith(
          'accounts-api.account.registered'
        )
      })
      it('should publish the message to the Message Broker with the correct parameters', () => {
        const req = mockRequest({
          body: parameters
        })
        const res = mockResponse({})
        accountController.create(req, res)
        expect(publishMessageStub).to.have.been.calledWith(
          'accounts-api.account.registered',
          '{"event":"account_registered","object":{"account":{"username":"user","name":"user","email":"user@email.com","password":"password"}}}'
        )
      })
    })
  })
  describe('Given the user parameters with an invalid email', () => {
    const parameters = {
      username: 'user',
      name: 'user',
      email: 'user',
      password: 'password'
    }
    describe('when create an account', () => {
      it('should throw an ex exception', () => {
        const req = mockRequest({
          body: parameters
        })
        const res = mockResponse({})
        expect(function () { accountController.create(req, res) }).to.throw('invalid email')
      })
    })
  })
})
