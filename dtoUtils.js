const types = require('./types');

function readDtos(apiBlockHtml) {
  let returnType = readReturnType(apiBlockHtml.children[1]);
  let dtos = Array.from(apiBlockHtml.children)
    .slice(2, -1)
    .map(readDto);
  return {
    returnType, dtos
  };
}

function readReturnType(returnHtml) {
  let returnTypeString = returnHtml.textContent.trim().replace(/^Return value: /, '');
  let returnType = types.getType(returnTypeString);
  return returnType;
}

function readDto(dtoHtml) {
  let schema = {
    '$schema': 'http://json-schema.org/draft-06/schema#',
    type: 'object',
    title: dtoHtml.children[0].textContent.trim(),
    properties: {}
  };
  let tbody = dtoHtml.querySelector('table > tbody');
  Array.from(tbody.children).forEach(tr => {
    let [ name, typeStr, desc ] = Array.from(tr.children)
      .map(c => c.textContent.trim());
    schema.properties[name] = clone(types.getType(typeStr));
    if (desc)
      schema.properties[name].description = desc;
  });
  return schema;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = { readDtos };
