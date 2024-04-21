/// Type util functions for dealing with different variable types in
/// JSON Schema / Swagger Spec / OpenAPI

const jsonc = require('jsonc');

const METHOD_DTO_RENAMES = jsonc.readSync(__dirname + '/data/methodDtoRenames.jsonc');

function getType(typeString, endpoint, method = null) {
  typeString = typeString.trim();
  let result = getTypeInternal(typeString, endpoint, method);
  result["x-type"] = typeString;
  return result;
}

function getTypeInternal(typeString, endpoint, method) {
  switch(typeString.toLowerCase()) {
    case "boolean":
      return { type: 'boolean' };
    case "int":
    case "integer":
      return { type: 'integer', format: 'int32' };
    case "long":
      return { type: 'integer', format: 'int64' };
    case "float":
      return { type: 'number', format: 'float' }
    case "double":
      return { type: 'number', format: 'double' };
    case "string":
      return { type: 'string' };
    case "object":
      return { type: 'object' };
  }
  if (typeString.startsWith('List[') || typeString.startsWith('Set[')) {
    return {
      type: 'array',
      items: getType(typeString.slice(typeString.indexOf('[') + 1, -1), endpoint, method),
    };
  }
  if (typeString.startsWith('Map[')) {
    return {
      type: 'object',
      "x-key": getType(typeString.slice(typeString.indexOf('[') + 1, typeString.indexOf(', ')), endpoint, method),
      additionalProperties: getType(typeString.slice(typeString.indexOf(', ') + 1, -1), endpoint, method),
    };
  }
  // DTO $ref.
  const rename = METHOD_DTO_RENAMES[`${endpoint}.${method}.${typeString}`];
  if (rename) {
    console.log(`    Renaming ${typeString} to ${rename}.`);
    typeString = rename;
  }
  return {
    '$ref': '#/components/schemas/' + endpoint + '.' + typeString
  };
}


module.exports = { getType };
