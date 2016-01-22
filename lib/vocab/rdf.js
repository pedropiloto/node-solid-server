/*
 * Copyright 2014 IBM Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License')
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

exports.brack = brack
exports.debrack = debrack
exports.defrag = defrag

function define (name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  })
}

var ns = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
define('ns', ns)
define('prefix', 'rdf')

// Properties
define('type', ns + 'type')

function brack (s) {
  if (s.length > 0 && s[0] === '<') {
    return s
  }
  if (s.length > 0 && s[s.length - 1] === '>') {
    return s
  }
  return '<' + s + '>'
}

function debrack (s) {
  if (s.length < 2) {
    return s
  }
  if (s[0] !== '<') {
    return s
  }
  if (s[s.length - 1] !== '>') {
    return s
  }
  return s.substring(1, s.length - 1)
}

function defrag (s) {
  var lst = s.split('#')
  if (lst.length < 2) {
    return s
  }
  return lst[0]
}