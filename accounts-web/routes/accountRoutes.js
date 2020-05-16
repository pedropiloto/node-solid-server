const express = require("express");
const router = express.Router();
const accountController = require("../app/api/controllers/account-controller");

router.post("/", accountController.create);

module.exports = router;
