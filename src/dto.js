const types = require('./types');
const deepEqual = require('./deepEqual');

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
    let prop = this.properties[name] = types.getType(typeStr, this.endpointName);
    if (desc) {
      prop.description = desc;
      let match;
      if ((match = /\(Legal values:\s*(\S+(?:,\s*\S+)*)\)$/.exec(desc)))
        prop.enum = match[1].split(/,\s*/);
      else if ((match = /Valid values are (\d+)-(\d+)\.?$/.exec(desc))) {
        prop.minimum = +match[1];
        prop.maximum = +match[2];
      }
    }
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
};
Dto.prototype.toSchema = function() {
  return {
    type: 'object',
    title: this.name,
    description: this.description,
    properties: this.properties
  };
};

Dto.readReturnType = function(returnHtml, endpointName) {
  let returnTypeString = returnHtml.textContent.trim().replace(/^Return value: /, '');
  if (!returnTypeString) return null;
  let returnType = types.getType(returnTypeString, endpointName);
  return returnType;
};

module.exports = Dto;
