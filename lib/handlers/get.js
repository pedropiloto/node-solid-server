module.exports = handler

var fs = require('fs')
var glob = require('glob')
var path = require('path')
var $rdf = require('rdflib')
var S = require('string')
var async = require('async')
var Negotiator = require('negotiator')

var debug = require('../debug').handlers
var acl = require('../acl.js')

var utils = require('../utils.js')
var translate = require('../utils.js').translate
var error = require('../http-error')

var RDFs = [
  'text/turtle',
  'application/n3',
  'application/nquads',
  'application/n-quads',
  'text/n3',
  'application/rdf+xml',
  'application/ld+json',
  'application/x-turtle'
]

function handler (req, res, next) {
  var ldp = req.app.locals.ldp
  var includeBody = req.method === 'GET'
  var negotiator = new Negotiator(req)
  var requestedType = negotiator.mediaType()
  var possibleRDFType = negotiator.mediaType(RDFs)
  var baseUri = utils.uriBase(req)

  res.header('MS-Author-Via', 'SPARQL')

  // Set live updates
  if (ldp.live) {
    res.header('Updates-Via', utils.uriBase(req))
  }

  debug(req.method + ' -- Request on:' + req.originalUrl + ' on ' + req.hostname)

  ldp.get(req.hostname, req.path, baseUri, includeBody, possibleRDFType, function (err, stream, contentType, container) {
    // use globHandler if magic is detected
    if (err && err.status === 404 && glob.hasMagic(req.path)) {
      debug(req.method + ' -- Glob request')
      return globHandler(req, res, next)
    }

    // Handle error
    if (err) {
      debug(req.method + ' -- Error: ' + err.status + ' ' + err.message)
      return next(err)
    }

    // Till here it must exist
    if (!includeBody) {
      debug('HEAD only -- ' + req.originalUrl)
      res.send(200)
      return next()
    }

    // Handle defaultApp
    if (container &&
        requestedType.indexOf('text/html') === 0 &&
        ldp.defaultApp) {
      var address = req.protocol + '/' + req.get('host') + req.originalUrl
      return res.redirect(303, ldp.defaultApp + address)
    }

    // If request accepts the content-type we found
    if (negotiator.mediaType([contentType])) {
      debug('GET -- ' + req.originalUrl + ' no translation ' + contentType)
      res.setHeader('Content-Type', contentType)
      return stream.pipe(res)
    }

    // If it is not in our RDFs we can't even translate,
    // Sorry, we can't help
    if (!possibleRDFType) {
      return next(error(406, 'Cannot server your type'))
    }

    // Translate from the contentType found to the possibleRDFType desired
    translate(stream, baseUri, contentType, possibleRDFType, function (err, data) {
      if (err) {
        debug('GET ERROR translating: ' + req.originalUrl + ' ' + contentType + ' -> ' + possibleRDFType + ' -- ' + 500 + err.message)
        return next(error(500, err.message))
      }
      debug('GET -- ' + req.originalUrl + ' translating ' + contentType + ' -> ' + possibleRDFType)
      res.setHeader('Content-Type', possibleRDFType)
      res.send(data)
      return next()
    })
  })
}

function globHandler (req, res, next) {
  var ldp = req.app.locals.ldp
  var root = !ldp.idp ? ldp.root : ldp.root + req.hostname + '/'
  var filename = utils.uriToFilename(req.path, root)
  var uri = utils.uriBase(req)

  var globOptions = {
    noext: true,
    nobrace: true
  }

  glob(filename, globOptions, function (err, matches) {
    if (err || matches.length === 0) {
      debug('GET/HEAD -- No files matching the pattern')
      return next(error(404, 'No files matching glob pattern'))
    }

    // Matches found
    var globGraph = $rdf.graph()

    async.each(matches, function (match, done) {
      var baseUri = utils.filenameToBaseUri(match, uri, root)
      fs.readFile(match, {encoding: 'utf8'}, function (err, fileData) {
        if (err) {
          debug('GET -- Error in globHandler' + err)
          return done(null)
        }
        aclAllow(match, req, res, function (allowed) {
          if (!S(match).endsWith('.ttl') || !allowed) {
            return done(null)
          }
          try {
            $rdf.parse(
              fileData,
              globGraph,
              baseUri,
              'text/turtle')
          } catch (parseErr) {
            debug('GET -- Error in globHandler' + parseErr)
          }
          return done(null)
        })
      })
    }, function () {
      var data = $rdf.serialize(
        undefined,
        globGraph,
        null,
        'text/turtle')
      // TODO this should be added as a middleware in the routes
      res.setHeader('Content-Type', 'text/turtle')
      res.send(data)
      return next()
    })
  })
}

function aclAllow (match, req, res, callback) {
  var ldp = req.app.locals.ldp

  if (!ldp.webid) {
    return callback(true)
  }

  var root = ldp.idp ? ldp.root + req.hostname + '/' : ldp.root
  var relativePath = '/' + path.relative(root, match)
  res.locals.path = relativePath
  acl.allow('Read', req, res, function (err) {
    callback(err)
  })
}