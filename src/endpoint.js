/// Representation of a single endpoint.
/// i.e. https://developer.riotgames.com/api-methods/#champion-mastery-v4
/// An endpoint is the top-level collection of methods.

const Method = require('./method');
const Schema = require('./schema');

function Endpoint(dom, desc) {
  this.dom = dom;
  this.desc = desc;
  this.name = dom.window.document.body.children[0].children[0].getAttribute('api-name');
  this.id = dom.window.document.body.children[0].children[0].id.replace(/^resource_/, '');

  this.methods = null;

  this._allDtos = null;

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

  // Get dtos, check for conflicts.
  let allDtos = {};
  for (const method of this.methods) {
    for (let dto of method.dtos) {
      let existing = allDtos[dto.name];
      if (!existing) {
        allDtos[dto.name] = dto;
        continue;
      }

      // Possible DTO conflict.
      const sub = dto.isSubset(existing);
      const sup = existing.isSubset(dto);
      if (sub && sup) // Equal
        continue;

      if (sub)
        console.log(`    Duplicate DTO ${dto.name} is subset of existing.`);
      else if (sup) {
        console.log(`    Duplicate DTO ${dto.name} is superset of existing, overwriting.`);
        allDtos[dto.name] = dto;
      }
      else {
        console.error(`    CONFLICTING DTO: ${dto.name}`);
        console.error('    ORIGINAL DTO:');
        console.error(`      ${JSON.stringify(existing, null, 2)
          .split('\n').join('\n      ')}`);
        console.error('    NEW DTO:');
        console.error(`      ${JSON.stringify(dto, null, 2)
          .split('\n').join('\n      ')}`);
        throw Error(`DTO Conflict: ${dto.name}`);
      }
    }
  }
  this._allDtos = allDtos;
};

Endpoint.prototype.get_dtos = function() {
  return Object.values(this._allDtos);
};

Endpoint.prototype.list_missing_dtos = function() {
  // DTOs referenced by other DTOs.
  let dtoToDtoReferences = Object.values(this._allDtos)
    .flatMap(dto => Object.values(dto.properties));

  // DTOs referenced by methods in return values or body parameters.
  // (path parameters are always primitives, so they can be ignored).
  let methodDtoReferences = this.methods
    .flatMap(method => [ method.returnType, method.bodyType ])
    .filter(dto => dto);

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
    .filter(name => !this._allDtos[name])
    .unique();
};

Endpoint.prototype.add_old_dto = function(oldDto) {
  let name = oldDto.name || oldDto.title; // Not sure if Schema object or object from OpenAPI json.
  if (this._allDtos[name])
    throw Error(`Dto with name ${name} already exists!`);
  this._allDtos[name] = new Schema(
    this.name, name, oldDto.description, oldDto.properties, oldDto.required || []);
};

Endpoint.prototype.add_unknown_dto = function(name) {
  if (this._allDtos[name])
    throw Error(`Dto with name ${name} already exists!`);
  this._allDtos[name] = new Schema(this.name, name, "UNKNOWN TYPE.", {});
}

module.exports = Endpoint;
