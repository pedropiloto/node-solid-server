const chai = require('chai')

const Account = require('../../../app/api/models/account')
const assert = chai.assert

describe('Account', () => {
  describe('Given the user parameters', () => {
    describe('when create an account', () => {
      const account = new Account('user', 'user', 'user@email.com', 'password')
      it('should return an object', () => {
        assert.equal(typeof account, 'object')
      })
      it('should have the correct username attribute', () => {
        assert.equal(account.username, 'user')
      })
      it('should have the correct name attribute', () => {
        assert.equal(account.name, 'user')
      })
      it('should have the correct email attribute', () => {
        assert.equal(account.email, 'user@email.com')
      })
      it('should have the correct password attribute', () => {
        assert.equal(account.password, 'password')
      })
    })
  })
})
