const types = require('./types');
const deepEqual = require('./deepEqual');

function Schema(schemaHtml, endpointName) {
  this.endpointName = endpointName;
  this.name = schemaHtml.firstElementChild.textContent.trim();
  this.description = Array.from(schemaHtml.childNodes)
    .filter(node => node.nodeType === 3 /* Node.TEXT_NODE */)
    .map(node => node.textContent.trim())
    .filter(str => str.length)
    .reduce((a, b) => a + ' ' + b, '')
    .replace(/^\s*-\s+/, '');
  this.properties = {};

  let table = schemaHtml.lastElementChild;
  let headers = Array.from(table.tHead.firstElementChild.children)
    .map(th => th.textContent.toLowerCase())
    .map(s => s.replace(/\s+(\S)/g, c => c[1].toUpperCase()));

  this.required = [];
  let tbody = table.tBodies[0];
  Array.from(tbody.children).forEach(tr => {
    let data = {}
    Array.from(tr.children)
      .map((el, i) => data[headers[i]] = el.textContent.trim());
    let { name, dataType, description } = data;
    let requiredStr;
    [ name, requiredStr ] = name.split(/\s+/, 2);

    if (requiredStr === 'required')
      this.required.push(name);

    let prop = this.properties[name] = types.getType(dataType, this.endpointName);

    let valueTd = tr.children[headers.indexOf('value')];
    if (valueTd && valueTd.firstElementChild.tagName.toLowerCase() === 'select') {
      prop.enum = Array.from(valueTd.firstElementChild.children)
        .map(option => option.textContent.trim());
    }

    if (description) {
      prop.description = description;
      let match;
      if ((match = /\(Legal values:\s*(\S+(?:,\s*\S+)*)\)$/.exec(description)))
        prop.enum = match[1].split(/,\s*/);
      else if ((match = /Valid values are (\d+)-(\d+)\.?$/.exec(description))) {
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
Schema.prototype.isSubset = function(other) {
  if (this.name !== other.name || this.endpointName !== other.endpointName)
    return false;
  for (let key of Object.keys(this.properties)) {
    if (!deepEqual(this.properties[key], other.properties[key]))
      return false;
  }
  return true;
};

Schema.prototype.toSchema = function() {
  let schema = {
    type: 'object',
    title: this.name,
    description: this.description,
    properties: this.properties
  };
  if (this.required.length)
    schema.required = this.required;
  return schema;
};

/**
 * Converts this object into a list of https://swagger.io/specification/#parameterObject.
 * Destructive on description.
 */
Schema.prototype.toParameters = function(inType) {
  return Object.entries(this.properties)
    .map(kv => {
      let [ name, prop ] = kv;
      let desc = prop.description;
      delete prop.description;
      return {
        name,
        in: inType,
        description: desc,
        required: this.required.includes(name),
        schema: prop,
        explode: true
      };
    });
}

Schema.readReturnType = function(returnHtml, endpointName) {
  let returnTypeString = returnHtml.textContent.trim().replace(/^Return value: /, '');
  if (!returnTypeString) return null;
  let returnType = types.getType(returnTypeString, endpointName);
  return returnType;
};

module.exports = Schema;
