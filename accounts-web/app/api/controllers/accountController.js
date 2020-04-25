const Account = require("../models/account");
const { publishMessage } = require("../../publisher");
const uuidv4 = require("uuid/v4");

module.exports = {
  create: function (req, res, next) {
    console.log(
      "creating order with the params: ",
      req.body.username,
      req.body.password,
      req.body.name,
      req.body.email
    );

    let account = new Account(req.body.username, req.body.name, req.body.email, req.body.password);

    publishMessage(
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
