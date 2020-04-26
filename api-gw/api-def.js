
require('dotenv').config()

module.exports = function generateRoutes(){
return [
  {
    "host": process.env.ACCOUNTS_WEB_HOST,
    "port": process.env.ACCOUNTS_WEB_PORT,
    "redirects": [
      {
        "path": "/account",
        "method": "post"
      }
    ]
  },
  {
    "host": process.env.LDP_HOST,
    "port": process.env.LDP_PORT,
    "redirects": [
      {
        "path": "/",
        "method": "get"
      },
      {
        "path": "/",
        "method": "get"
      },
      {
        "path": "/",
        "method": "post"
      },
      {
        "path": "/",
        "method": "put"
      },
      {
        "path": "/",
        "method": "patch"
      },
      {
        "path": "/",
        "method": "delete"
      }
    ]
  }
]
}


