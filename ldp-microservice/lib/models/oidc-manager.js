'use strict'

const url = require('url')
const path = require('path')
const debug = require('../debug').authentication

const OidcManager = require('oidc-auth-manager-adapted')

/**
 * Returns an instance of the OIDC Authentication Manager, initialized from
 * argv / config.json server parameters.
 *
 * @param argv {Object} Config hashmap
 *
 * @param argv.host {SolidHost} Initialized SolidHost instance, including
 *   `serverUri`.
 *
 * @param [argv.dbPath='./db/oidc'] {string} Path to the auth-related storage
 *   directory (users, tokens, client registrations, etc, will be stored there).
 *
 * @param argv.saltRounds {number} Number of bcrypt password salt rounds
 *
 * @param [argv.delayBeforeRegisteringInitialClient] {number} Number of
 *   milliseconds to delay before initializing a local RP client.
 *
 * @return {OidcManager} Initialized instance, includes a UserStore,
 *   OIDC Clients store, a Resource Authenticator, and an OIDC Provider.
 */
function fromServerConfig (argv) {
  let providerUri = argv.solidIdUri
  let authCallbackUri = url.resolve(providerUri, '/api/oidc/rp')
  let postLogoutUri = url.resolve(providerUri, '/goodbye')

  let dbPath = path.join(argv.dbPath, 'oidc')

  let options = {
    debug,
    providerUri,
    dbPath,
    authCallbackUri,
    postLogoutUri,
    saltRounds: argv.saltRounds,
    delayBeforeRegisteringInitialClient: argv.delayBeforeRegisteringInitialClient,
    host: { debug }
  }

  return OidcManager.from(options)
}

function resourceServerOnly (argv) {
  return new OidcManager({ serverUri: argv.solidIdUri })
}

module.exports = {
  fromServerConfig, resourceServerOnly
}
