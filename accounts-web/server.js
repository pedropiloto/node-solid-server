const express = require("express");
const logger = require("morgan");
const accountRoutes = require("./routes/accountRoutes");
const bodyParser = require("body-parser");
const app = express();
const { createChannel, publishMessage } = require("./app/publisher");

  app.use(logger("dev"));
  app.use(bodyParser.urlencoded({ extended: false }));

  app.get("/", function(req, res) {
    res.json({ tutorial: "Build REST API with node.js" });
  });

  // private route
  app.use("/account", accountRoutes);

  app.get("/favicon.ico", function(req, res) {
    res.sendStatus(204);
  });

  // express doesn't consider not found 404 as an error so we need to handle 404 it explicitly
  // handle 404 error
  app.use(function(req, res, next) {
    let err = new Error("Not Found");
    err.status = 404;
    next(err);
  });

  // handle errors
  app.use(function(err, req, res, next) {
    console.log(err);

    if (err.status === 404) res.status(404).json({ message: "Not found" });
    else res.status(500).json({ message: "Something looks wrong :( !!!" });
  });

  const port = process.env.PORT || 8441;

  createChannel()

  app.listen(port, function() {
    console.log("Node server listening on port", port);
  });
