const types = require('./types');

/**
 * Deep equals, ignoring underscore-prefixed keys.
 * Only handles primitives, arrays, and objects.
 */
function deepEqual(a, b) {
  if (Object.is(a, b))
    return true;
  if (a instanceof Array) {
    if (!(b instanceof Array))
      return false;
    if (a.length !== b.length)
      return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i]))
        return false;
    }
    return true;
  }
  if (typeof a === 'object') {
    if (typeof b !== 'object')
      return false;
    let aKeys = Object.keys(a).filter(x => !x.startsWith('x-')).sort();
    let bKeys = Object.keys(b).filter(x => !x.startsWith('x-')).sort();
    if (!deepEqual(aKeys, bKeys))
      return false;
    for (let key of aKeys) {
      if (!deepEqual(a[key], b[key]))
        return false;
    }
    return true;
  }
  throw new Error('Unknown type: ' + (typeof a));
}

function Dto(dtoHtml, endpointName) {
  this.endpointName = endpointName;
  this.name = dtoHtml.children[0].textContent.trim();
  this.description = Array.from(dtoHtml.childNodes)
    .filter(node => node.nodeType === 3 /* Node.TEXT_NODE */)
    .map(node => node.textContent.trim())
    .filter(str => str.length)
    .reduce((a, b) => a + ' ' + b, '')
    .replace(/^\s*-\s+/, '');
  this.properties = {};

  let tbody = dtoHtml.querySelector('table > tbody');
  Array.from(tbody.children).forEach(tr => {
    let [ name, typeStr, desc ] = Array.from(tr.children)
      .map(c => c.textContent.trim());
    this.properties[name] = clone(types.getType(typeStr, this.endpointName));
    if (desc)
      this.properties[name].description = desc;
  });
}
/**
 * Returns true if `this` and `other` have the same name and
 * `this` is a (possibly non-strict) subset of `other`.
 */
Dto.prototype.isSubset = function(other) {
  if (this.name !== other.name || this.endpointName !== other.endpointName)
    return false;
  for (let key of Object.keys(this.properties)) {
    if (!deepEqual(this.properties[key], other.properties[key]))
      return false;
  }
  return true;
}
Dto.prototype.toSchema = function() {
  return {
    type: 'object',
    title: this.name,
    description: this.description,
    properties: this.properties
  };
}

Dto.readDtos = function(apiBlockHtml, endpointName) {
  let returnType = readReturnType(apiBlockHtml.children[1], endpointName);
  let dtos = Array.from(apiBlockHtml.children)
    .slice(2, -1)
    .map(e => new Dto(e, endpointName));
  return {
    returnType, dtos
  };
}

function readReturnType(returnHtml, endpointName) {
  let returnTypeString = returnHtml.textContent.trim().replace(/^Return value: /, '');
  if (!returnTypeString) return null;
  let returnType = types.getType(returnTypeString, endpointName);
  return returnType;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = Dto;
