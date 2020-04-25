const express = require("express");
const router = express.Router();
const accountController = require("../app/api/controllers/accountController");

router.post("/", accountController.create);

module.exports = router;
