/// Represents a Schema.
/// Schema is equivalent to a DTO. This object stores info about the different
/// properties a particular Schema contains, as well as it's name, description,
/// and which endpoint it came from.

const descTypeOverrides = require('./data/dtoDescriptionTypeOverrides');
const dtoOptional = require('./data/dtoOptional');

const methodParamEnums = require('./data/methodParamEnums');
const dtoEnums = require('./data/dtoEnums');

const types = require('./types');
const { subsetEqual } = require('./deepEqual');

function Schema(endpointName, name, description, properties, required = []) {
  this.endpointName = endpointName;
  this.name = name;
  this.description = description;
  this.properties = properties;

  this.required = required;
}

Schema.fromHtml = function(schemaHtml, endpointName,
  { requiredByDefault = false, onlyUseRequiredByDefault = false, methodName = null, useDtoOptional = false } = {}) {

  if (null === schemaHtml.firstElementChild) {
    console.log('!!!!', endpointName, methodName);
  }
  let dtoName = schemaHtml.firstElementChild.textContent.trim();
  let description = Array.from(schemaHtml.childNodes)
    .filter(node => node.nodeType === 3 /* Node.TEXT_NODE */)
    .map(node => node.textContent.trim())
    .filter(str => str.length)
    .reduce((a, b) => a + ' ' + b, '')
    .replace(/^\s*-\s+/, '');
  let schema = new Schema(endpointName, dtoName, description, {});

  let table = schemaHtml.lastElementChild;
  // Get header for indexing (accounts for column order).
  let headers = Array.from(table.tHead.firstElementChild.children)
    .map(th => th.textContent.toLowerCase())
    .map(s => s.replace(/\s+(\S)/g, c => c[1].toUpperCase()));

  let tbody = table.tBodies[0];
  Array.from(tbody.children).forEach(tr => {
    let data = {}
    Array.from(tr.children)
      .map((el, i) => data[headers[i]] = el.textContent.trim());
    let { name, dataType, description } = data;

    {
      if (onlyUseRequiredByDefault && useDtoOptional)
        throw Error('Cannot only use required by default and use dto optional.');

      let isRequired = requiredByDefault;

      let requiredStr;
      [ name, requiredStr ] = name.split(/\s+/, 2);

      if (!onlyUseRequiredByDefault) {
        if (description.toLowerCase().includes('optional'))
          isRequired = false;
        if (requiredStr === 'required')
          isRequired = true;

        if (useDtoOptional) {
          const canonName = `${endpointName}.${dtoName}.${name}`;
          const canonNameStar = `${endpointName}.${dtoName}.*`;
          if (undefined !== dtoOptional[canonName])
            isRequired = !dtoOptional[canonName];
          else if (undefined !== dtoOptional[canonNameStar])
            isRequired = !dtoOptional[canonNameStar];
        }
      }

      if (isRequired)
        schema.required.push(name);
    }

    let prop = types.getType(dataType, schema.endpointName);
    if (description) {
      let match;
      if (descTypeOverrides[description])
        prop = JSON.parse(JSON.stringify(descTypeOverrides[description]));
      else if ((match = /\(Legal values:\s*(\S+(?:,\s*\S+)*)\)$/.exec(description)))
        prop.enum = match[1].split(/,\s*/);
      else if ((match = /Valid values are (\d+)-(\d+)\.?$/.exec(description))) {
        prop.minimum = +match[1];
        prop.maximum = +match[2];
      }
      prop.description = description;
    }
    annotateEnums(prop, schema.endpointName, name, dtoName, methodName);

    let valueTd = tr.children[headers.indexOf('value')];
    if (valueTd && valueTd.firstElementChild.tagName.toLowerCase() === 'select') {
      prop.enum = Array.from(valueTd.firstElementChild.children)
        .map(option => option.textContent.trim());
    }
    schema.properties[name] = prop;
  });

  return schema;
};

/**
 * Returns true if `this` and `other` have the same name and
 * `this` is a (possibly non-strict) subset of `other`.
 */
Schema.prototype.isSubset = function(other) {
  if (this.name !== other.name || this.endpointName !== other.endpointName)
    return false;
  for (let key of Object.keys(this.properties)) {
    if (!subsetEqual(this.properties[key], other.properties[key]))
      return false;
  }
  return true;
};

Schema.prototype.toSchema = function() {
  let schema = {
    type: 'object',
    title: this.name,
    properties: this.properties
  };
  if (this.description)
    schema.description = this.description;
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
    .map(([ name, prop ]) => {
      let desc = prop.description;
      delete prop.description;
      let res = {
        name,
        in: inType,
        required: this.required.includes(name),
        schema: prop
      };
      if (desc)
        res.description = desc;
      if ('array' === prop.type)
        res.explode = true;
      return res;
    });
}

Schema.readReturnType = function(returnHtml, endpointName) {
  let returnTypeString = returnHtml.textContent.trim().replace(/^Return value: /, '');
  if (!returnTypeString) return null;
  let returnType = types.getType(returnTypeString, endpointName);
  return returnType;
};

function annotateEnums(targetProp, endpointName, name, dtoName, methodName) {
  let canonName;
  let enumMap;
  // methodParamEnums.json
  if (methodName) {
    canonName = `${endpointName}.${methodName}.${name}`;
    enumMap = methodParamEnums;
  }
  // dtoEnums.json
  else {
    canonName = `${endpointName}.${dtoName}.${name}`;
    enumMap = dtoEnums;
  }

  if ('array' === targetProp.type) {
    canonName += '[]';
    targetProp = targetProp.items;
  }
  const enumName = enumMap[canonName];
  if (enumName)
  targetProp['x-enum'] = enumName;
}

module.exports = Schema;
