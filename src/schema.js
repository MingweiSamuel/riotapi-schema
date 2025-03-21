/// Represents a Schema.
/// Schema is equivalent to a DTO. This object stores info about the different
/// properties a particular Schema contains, as well as it's name, description,
/// and which endpoint it came from.

const jsonc = require('jsonc');

const DESC_TYPE_OVERRIDES = jsonc.readSync(__dirname + '/data/dtoDescriptionTypeOverrides.jsonc');
const DTO_OPTIONAL = jsonc.readSync(__dirname + '/data/dtoOptional.jsonc');
const METHOD_DTO_RENAMES = jsonc.readSync(__dirname + '/data/methodDtoRenames.jsonc');
const METHOD_PARAM_ENUMS = jsonc.readSync(__dirname + '/data/methodParamEnums.jsonc');
const DTO_ENUMS = jsonc.readSync(__dirname + '/data/dtoEnums.jsonc');
const DTO_EXTRA_FIELDS = jsonc.readSync(__dirname + '/data/dtoExtraFields.jsonc');
const DTO_01_BOOL_FIELDS = jsonc.readSync(__dirname + '/data/dto01BoolFields.jsonc');

const types = require('./types');
const { subsetEqual } = require('./deepEqual');

function Schema(endpointName, name, description, properties, required = []) {
  this.endpointName = endpointName;
  this.name = name;
  this.description = description;
  this.properties = properties;

  this.required = required;
}

Schema.fromHtml = function(schemaHtml, endpointName, methodName,
  { requiredByDefault = false, onlyUseRequiredByDefault = false, isParam = false, useDtoOptional = false } = {}) {

  if (null === schemaHtml.firstElementChild) {
    console.error('!!!!', endpointName, methodName);
  }
  const dtoName = schemaHtml.firstElementChild.textContent.trim();
  const dtoRename = METHOD_DTO_RENAMES[`${endpointName}.${methodName}.${dtoName}`]; // May be undefined.

  let description = Array.from(schemaHtml.childNodes)
    .filter(node => node.nodeType === 3 /* Node.TEXT_NODE */)
    .map(node => node.textContent.trim())
    .filter(str => str.length)
    .reduce((a, b) => a + ' ' + b, '')
    .replace(/^\s*-\s+/, '');
  // Use rename if available, but keep original in dtoName var.
  let schema = new Schema(endpointName, dtoRename || dtoName, description, {});

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
    let { name: fieldName, dataType, description } = data;

    // Handle required vs optional.
    {
      if (onlyUseRequiredByDefault && useDtoOptional)
        throw Error('Cannot only use required by default and use dto optional.');

      let isRequired = requiredByDefault;

      let requiredStr;
      [ fieldName, requiredStr ] = fieldName.split(/\s+/, 2);

      if (!onlyUseRequiredByDefault) {
        if (description.toLowerCase().includes('optional'))
          isRequired = false;
        if (requiredStr === 'required')
          isRequired = true;

        if (useDtoOptional) {
          isRequired = !Schema.isFieldInDtoOptional(endpointName, dtoName, fieldName);
        }
      }

      if (isRequired) {
        schema.required.push(fieldName);
      }
    }

    const prop = types.getType(dataType, endpointName, methodName);
    if (description) {
      let match;
      if (DESC_TYPE_OVERRIDES[description]) {
        prop = JSON.parse(JSON.stringify(DESC_TYPE_OVERRIDES[description]));
      } else {
        let typeToUpdate;
        if (prop.type === 'array') {
          typeToUpdate = prop.items;
        } else {
          typeToUpdate = prop;
        }
        if ((match = /\(Legal values:\s*(\S+(?:,\s*\S+)*)\)$/.exec(description)))
          typeToUpdate.enum = match[1].split(/,\s*/);
        else if ((match = /Valid values are (\d+)-(\d+)\.?$/.exec(description))) {
          typeToUpdate.minimum = +match[1];
          typeToUpdate.maximum = +match[2];
        }
      }
      prop.description = description;
    }
    annotateEnums(prop, endpointName, fieldName, dtoName, methodName, isParam);

    let valueTd = tr.children[headers.indexOf('value')];
    if (valueTd && valueTd.firstElementChild.tagName.toLowerCase() === 'select') {
      prop.enum = Array.from(valueTd.firstElementChild.children)
        .map(option => option.textContent.trim())
        .filter(str => 0 < str.length);
    }
    schema.properties[fieldName] = prop;

    const is01Bool = DTO_01_BOOL_FIELDS[`${endpointName}.${dtoName}.${fieldName}`];
    if (true === is01Bool) {
      if ('integer' === prop.type) {
        prop.enum = [ 0, 1 ];
      } else {
        console.error(`    Field marked as 0/1 bool is not integer, is ${JSON.stringify(prop.type)}: '${endpointName}.${dtoName}.${fieldName}'`);
      }
    }
  });

  // Add dto extra fields.
  const extraFields = DTO_EXTRA_FIELDS[`${endpointName}.${dtoName}`];
  if (null != extraFields) {
    console.log(`    Adding fields to DTO '${endpointName}.${dtoName}': ${JSON.stringify(Object.keys(extraFields))}.`)
    for (const [fieldName, fieldExtraProp] of Object.entries(extraFields)) {
      const extraProp = JSON.parse(JSON.stringify(fieldExtraProp));
      const isRequired = !Schema.isFieldInDtoOptional(endpointName, dtoName, fieldName);
      if (isRequired && !schema.required.includes(fieldName)) {
        schema.required.push(fieldName);
      }
      annotateEnums(extraProp, endpointName, fieldName, methodName, isParam);
      const oldField = schema.properties[fieldName];
      if (null != oldField) {
        console.log(`      Overwriting existing field: '${fieldName}'`);
        if (oldField.type === extraProp.type) {
          if (oldField.format === extraProp.format) {
            if ('array' === oldField.type || 'object' === oldField.type) {
              console.error(`        Original object/array field MAYBE compatible!`);
            }
            else {
              console.error(`        Original field IS compatible!`);
            }
          } else if ('number' === oldField.type || 'integer' === oldField.type) {
            console.error(`        Original numeric field PROBABLY compatible!`);
          }
        } else if ('number' === oldField.type) {
          if ('integer' === extraProp.type) {
            console.error(`        Original field float/double overwritten by int, IS compatible!`);
          } else if ('number' === oldField.type) {
            console.error(`        Original field float/double overwritten by float/double, IS compatible!`);
          }
        }
      }
      schema.properties[fieldName] = JSON.parse(JSON.stringify(extraProp));
    }
  }

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

Schema.isFieldInDtoOptional = function(endpointName, dtoName, fieldName) {
  const canonName = `${endpointName}.${dtoName}.${fieldName}`;
  const canonNameStar = `${endpointName}.${dtoName}.*`;
  if (null != DTO_OPTIONAL[canonName])
    return DTO_OPTIONAL[canonName];
  else if (null != DTO_OPTIONAL[canonNameStar])
    return DTO_OPTIONAL[canonNameStar];
  return false;
}

Schema.readReturnType = function(returnHtml, endpointName, methodName) {
  let returnTypeString = returnHtml.textContent.trim().replace(/^Return value: /, '');
  if (!returnTypeString) return null;
  let returnType = types.getType(returnTypeString, endpointName, methodName);
  return returnType;
};

// Schema.renameRef = function()

function annotateEnums(targetProp, endpointName, name, dtoName, methodName, isParam) {
  let canonName;
  let enumMap;

  // methodParamEnums.jsonc
  if (isParam) {
    canonName = `${endpointName}.${methodName}.${name}`;
    enumMap = METHOD_PARAM_ENUMS;
  }
  // dtoEnums.jsonc
  else {
    canonName = `${endpointName}.${dtoName}.${name}`;
    enumMap = DTO_ENUMS;
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
