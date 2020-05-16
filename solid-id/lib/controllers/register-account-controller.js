'use strict'

const debug = require('../debug').accounts
const blacklistService = require('../services/blacklist-service')
const { isValidUsername } = require('../common/user-utils')

/**
 * Represents a 'create new user account' http request (either a POST to the
 * `/accounts/api/new` endpoint, or a GET to `/register`).
 *
 * Intended just for browser-based requests; to create new user accounts from
 * a command line, use the `AccountManager` class directly.
 *
 * This is an abstract class, subclasses are created (for example
 * `CreateOidcAccountRequest`) depending on which Authentication mode the server
 * is running in.
 *
 * @class CreateAccountRequest
 */
class CreateAccountController {
  /**
   *
   * @param [accountManager] {AccountManager}
   * @param [userAccount] {UserAccount}
   *
   */
  constructor (accountManager, userStore, userData) {
    this.accountManager = accountManager
    this.userStore = userStore
    this.userAccount = accountManager.userAccountFrom(userData)
    this.password = userData.password
  }

  async call () {
    try {
      this.validate()
      await this.createAccount()
    } catch (error) {
      debug('error creating account:', error)
    }
  }

  /**
   * Creates an account for a given user (from a POST to `/api/accounts/new`)
   *+
   * @throws {Error} If errors were encountering while validating the username.
   *
   * @return {Promise<UserAccount>} Resolves with newly created account instance
   */
  async createAccount () {
    const userAccount = this.userAccount
    const accountManager = this.accountManager

    this.cancelIfUsernameInvalid(userAccount)
    this.cancelIfBlacklistedUsername(userAccount)
    if (!await this.userStore.findUser(userAccount.id)) {
      await this.createAccountStorage(userAccount)
      await this.saveCredentialsFor(userAccount)
      // 'return' not used deliberately, no need to block and wait for email
      if (userAccount && userAccount.email) {
        debug('Sending Welcome email')
        accountManager.sendWelcomeEmail(userAccount)
      }
      debug('user created with success')
    } else {
      debug('user could not be created because already existed')
    }

    return userAccount
  }

  /**
   * Creates the root storage folder, initializes default containers and
   * resources for the new account.
   *
   * @param userAccount {UserAccount} Instance of the account to be created
   *
   * @throws {Error} If errors were encountering while creating new account
   *   resources.
   *
   * @return {Promise<UserAccount>} Chainable
   */
  createAccountStorage (userAccount) {
    return this.accountManager.createAccountFor(userAccount)
  }

  /**
   * Check if a username is a valid slug.
   *
   * @param userAccount {UserAccount} Instance of the account to be created
   *
   * @throws {Error} If errors were encountering while validating the
   *   username.
   *
   * @return {UserAccount} Chainable
   */
  cancelIfUsernameInvalid (userAccount) {
    if (!userAccount.username || !isValidUsername(userAccount.username)) {
      debug('Invalid username ' + userAccount.username)
      const error = new Error('Invalid username (contains invalid characters)')
      error.status = 400
      throw error
    }

    return userAccount
  }

  /**
   * Check if a username is a valid slug.
   *
   * @param userAccount {UserAccount} Instance of the account to be created
   *
   * @throws {Error} If username is blacklisted
   *
   * @return {UserAccount} Chainable
   */
  cancelIfBlacklistedUsername (userAccount) {
    const validUsername = blacklistService.validate(userAccount.username)
    if (!validUsername) {
      debug('Invalid username ' + userAccount.username)
      const error = new Error('Invalid username (username is blacklisted)')
      error.status = 400
      throw error
    }

    return userAccount
  }

  /**
   * Validates the Login request (makes sure required parameters are present),
   * and throws an error if not.
   *
   * @throws {Error} If missing required params
   */
  validate () {
    let error

    if (!this.userAccount.username) {
      error = new Error('Username required')
      error.statusCode = 400
      throw error
    }

    if (!this.password) {
      error = new Error('Password required')
      error.statusCode = 400
      throw error
    }
  }

  /**
   * Generate salted password hash, etc.
   *
   * @param userAccount {UserAccount}
   *
   * @return {Promise<null|Graph>}
   */
  saveCredentialsFor (userAccount) {
    return this.userStore.createUser(userAccount, this.password)
      .then(() => {
        debug('User credentials stored')
        return userAccount
      })
  }
}

/**
 * Models a Create Account request for a server using WebID-TLS as primary
 * authentication mode. Handles generating and saving a TLS certificate, etc.
 *
 * @class CreateTlsAccountRequest
 * @extends CreateAccountRequest
 */

module.exports = CreateAccountController
