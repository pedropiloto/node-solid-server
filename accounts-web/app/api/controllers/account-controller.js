const Account = require("../models/account");
const publisher = require("../../publisher");
const uuidv4 = require("uuid/v4");
const validator = require('email-validator')

module.exports = {
  create: function (req, res, next) {
    console.log(
      "creating order with the params: ",
      req.body.username,
      req.body.password,
      req.body.name,
      req.body.email
    );

    if(!validator.validate(req.body.email)){ throw (Object.assign(new Error('invalid email'), { status: 400 }))}

    let account = new Account(req.body.username, req.body.name, req.body.email, req.body.password);

    publisher.publishMessage(
      "accounts-api.account.registered",
      JSON.stringify({
        event: "account_registered",
        object: {
          account
        },
      })
    );

    res.json({
      status: "success",
      message: "Account registered with success!!!",
      data: account,
    });
  }
};
