
function getType(typeString) {
  let result = getTypeInternal(typeString);
  result._type = typeString;
  return result;
}

function getTypeInternal(typeString) {
  typeString = typeString.trim();
  switch(typeString.toLowerCase()) {
    case "boolean":
      return { type: 'boolean' };
    case "int":
    case "long":
      return { type: 'integer' };
    case "double":
      return { type: 'number' };
    case "string":
      return { type: 'string' };
  }
  if (typeString.startsWith('List[')) {
    return {
      type: 'array',
      items: getType(typeString.slice(typeString.indexOf('[') + 1, -1))
    };
  }
  if (typeString.startsWith('Map[')) {
    return {
      type: 'object',
      _key: getType(typeString.slice(typeString.indexOf('[') + 1, typeString.indexOf(', '))),
      additionalProperties: getType(typeString.slice(typeString.indexOf(', ') + 1, -1))
    };
  }
  return {
    '$ref': typeString + '.json'
  };
  // throw new Error('Failed to resolve type: "' + typeString + '".');
}


module.exports = { getType }
