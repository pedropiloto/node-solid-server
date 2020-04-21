const debug = require('../debug').accounts


module.exports = bootstrapAccount

function bootstrapAccount(accountManager, userAccount){
  return accountManager.createAccountFor(userAccount)
    .catch(error => {
      error.message = 'Error creating account storage: ' + error.message
      throw error
    })
    .then(() => {
      debug('Account storage resources created')
      return userAccount
    })
}