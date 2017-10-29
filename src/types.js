const aliases = require('../data/dtoAliases');

function getType(typeString, endpoint=null) {
  let result = getTypeInternal(typeString, endpoint);
  result._type = typeString;
  return result;
}

function getTypeInternal(typeString, endpoint) {
  typeString = typeString.trim();
  switch(typeString.toLowerCase()) {
    case "boolean":
      return { type: 'boolean' };
    case "int":
      return { type: 'integer', format: 'int32' };
    case "long":
      return { type: 'integer', format: 'int64' };
    case "double":
      return { type: 'number', format: 'double' };
    case "string":
      return { type: 'string' };
  }
  if (typeString.startsWith('List[') || typeString.startsWith('Set[')) {
    return {
      type: 'array',
      items: getType(typeString.slice(typeString.indexOf('[') + 1, -1), endpoint)
    };
  }
  if (typeString.startsWith('Map[')) {
    return {
      type: 'object',
      _key: getType(typeString.slice(typeString.indexOf('[') + 1, typeString.indexOf(', ')), endpoint),
      additionalProperties: getType(typeString.slice(typeString.indexOf(', ') + 1, -1), endpoint)
    };
  }
  let aliasMap = aliases[endpoint];
  if (aliasMap && aliasMap[typeString]) {
    console.log('    RENAME ' + typeString + ' to ' + aliasMap[typeString] + '.');
    typeString = aliasMap[typeString];
  }
  return {
    '$ref': './' + typeString + '.json'
  };
  // throw new Error('Failed to resolve type: "' + typeString + '".');
}


module.exports = { getType }
