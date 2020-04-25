const mongoose = require("mongoose");
const uuidv4 = require("uuid/v4");

class Account {
  /**
   * @constructor
   * @param [username] {string}
   * @param [name] {string}
   * @param [email] {string}
   */
  constructor (username, name, email, password) {
    this.username = username
    this.name = name
    this.email = email
    this.password = password
  }

}

module.exports = Account
