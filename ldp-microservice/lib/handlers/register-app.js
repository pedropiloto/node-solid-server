const debug = require('../debug').accounts
const url = require('url')
const intoStream = require('into-stream')

const $rdf = require('rdflib')
const ACL = $rdf.Namespace('http://www.w3.org/ns/auth/acl#')

module.exports = registerApp

async function registerApp (ldp, appOrigin, accessModes, webId) {
  debug(`Registering app (${appOrigin}) with accessModes ${accessModes} for webId ${webId}`)
  const store = await getProfileGraph(ldp, webId)
  console.log('\n STORE: ', store + '\n')

  const origin = $rdf.sym(appOrigin)
  // remove existing statements on same origin - if it exists
  store.statementsMatching(null, ACL('origin'), origin).forEach(st => {
    store.removeStatements([...store.statementsMatching(null, ACL('trustedApp'), st.subject)])
    store.removeStatements([...store.statementsMatching(st.subject)])
  })

  // add new triples
  const application = new $rdf.BlankNode()
  store.add($rdf.sym(webId), ACL('trustedApp'), application, webId)
  store.add(application, ACL('origin'), origin, webId)

  accessModes.forEach(mode => {
    store.add(application, ACL('mode'), ACL(mode))
  })
  await saveProfileGraph(ldp, store, webId)
}

async function saveProfileGraph (ldp, store, webId) {
  const text = $rdf.serialize(undefined, store, getWebIdFile(webId), 'text/turtle')
  await ldp.put(webId, intoStream(text), 'text/turtle')
}

function getWebIdFile (webId) {
  const webIdurl = new url.URL(webId)
  return `${webIdurl.origin}${webIdurl.pathname}`
}

async function getProfileGraph (ldp, webId) {
  return await new Promise(async (resolve, reject) => {
    const store = $rdf.graph()
    const profileText = await ldp.readResource(webId)
    $rdf.parse(profileText.toString(), store, getWebIdFile(webId), 'text/turtle', (error, kb) => {
      if (error) {
        reject(error)
      } else {
        resolve(kb)
      }
    })
  })
}
