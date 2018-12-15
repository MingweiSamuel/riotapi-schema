/// Representation of a single endpoint.
/// i.e. https://developer.riotgames.com/api-methods/#champion-mastery-v4
/// An endpoint is the top-level collection of methods.

const Method = require('./method');
const Schema = require('./schema');

function Endpoint(dom, desc, parentEndpoint) {
  this.dom = dom;
  this.desc = desc;
  this.name = dom.window.document.body.children[0].children[0].getAttribute('api-name');
  this.id = dom.window.document.body.children[0].children[0].id.replace(/^resource_/, '');

  this.methods = null;

  this._allDtos = null;
  this._parentEndpoint = parentEndpoint || null;

  this._compile();
}

Endpoint.prototype._compile = function() {
  console.log(this.name);

  // let dtosDir = this.name + '/dtos/';
  // let methodsDir = this.name + '/methods/';

  // let dirs = [ dtosDir, methodsDir ];

  let methodEls = this.dom.window.document.getElementsByClassName('operation');
  this.methods = Array.from(methodEls)
    .map(methodEl => new Method(this, methodEl));
  // Write dto files.
  let methodDtos = this.methods
    .map(method => method.dtos);

  // Read dtos, check for conflicts.
  let allDtos = {};
  for (let dtoList of methodDtos) {
    for (let dto of dtoList) {
      let existing = allDtos[dto.name];
      if (existing) {
        if (dto.isSubset(existing))
          continue;
        if (existing.isSubset(dto))
          allDtos[dto.name] = dto
        else {
          console.error('  CONFLICTING DTO: ' + dto.name);
          console.error('  existing', existing, 'new', dto);
        }
        continue;
      }
      allDtos[dto.name] = dto;
    }
  }
  if (this._parentEndpoint) {
    // Add to parent if have parent.
    Object.assign(this._parentEndpoint._allDtos, allDtos);
    this._allDtos = {};
  }
  else // Otherwise, keep for self.
    this._allDtos = allDtos;
};


Endpoint.prototype._getAllDtos = function() {
  return this._parentEndpoint ?
    this._parentEndpoint._getAllDtos() : this._allDtos;
};


Endpoint.prototype.getSchemaNamespace = function() {
  return this._parentEndpoint ?
    this._parentEndpoint.getSchemaNamespace() : this.name;
};


Endpoint.prototype.exportDtos = function() {
  let schemas = {};
  for (let dto of Object.values(this._allDtos))
    schemas[this.name + '.' + dto.name] = dto.toSchema();
  return schemas;
};


Endpoint.prototype.listMissingDtos = function() {
  // DTOs referenced by other DTOs.
  let dtoToDtoReferences = Object.values(this._allDtos)
    .flatMap(dto => Object.values(dto.properties));

  // DTOs referenced by methods in return values or body parameters.
  // (path parameters are always primitives, so they can be ignored).
  let methodDtoReferences = this.methods
    .flatMap(method => [ method.returnType, method.bodyType ])
    .filter(dto => dto);

  let existingDtos = this._getAllDtos();

  let allDtoReferences = dtoToDtoReferences.concat(methodDtoReferences);
  return allDtoReferences
    // Extract full name out of references.
    .map(prop => {
      // Get $ref (or undefined).
      if (prop.$ref)
        return prop.$ref;
      if ('array' === prop.type)
        return prop.items.$ref;
      if ('object' === prop.type)
        return prop.additionalProperties.$ref
    })
    // Remove nulls.
    .filter(ref => ref)
    // Extract short name from full name. Pop returns last element (DTP name).
    .map(ref => ref.split('.').pop())
    // Return names not found in the _allDtos dict.
    .filter(name => !existingDtos[name]);
};

Endpoint.prototype.addOldDto = function(oldDto) {
  if (this._allDtos[oldDto.title])
    throw Error('DTO with name ' + oldDto.title + 'already exists!');
  if (this._parentEndpoint)
    throw Error('Cannot add DTO to endpoint with parent.');
  this._allDtos[oldDto.name] = new Schema(this.name, oldDto.title, oldDto.description, oldDto.properties);
};

module.exports = Endpoint;
