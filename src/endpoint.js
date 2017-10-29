const fs = require("fs-extra");

const Method = require('./method')

function Endpoint(dom, desc) {
  this.dom = dom;
  this.desc = desc;
  this.name = dom.window.document.body.children[0].children[0].getAttribute('api-name');
  this.id = dom.window.document.body.children[0].children[0].id.replace(/^resource_/, '');
  this.dtos = [];
}

Endpoint.prototype.compile = function() {
  console.log(this.name);

  let dtosDir = this.name + '/dtos/';
  let methodsDir = this.name + '/methods/';

  let dirs = [ dtosDir, methodsDir ];

  let mkdirsPromise = fs.mkdir(this.name)
    .then(() => Promise.all(dirs.map(dir => fs.mkdir(dir.slice(0, -1)))));

  return mkdirsPromise
    .then(() => {
      let methodEls = this.dom.window.document.getElementsByClassName('operation');
      let methods = Array.from(methodEls)
        .map(methodEl => new Method(this, methodEl));
      methods.forEach(method => method.compile());

      let promises = [];

      // Write dto files.
      let methodDtos = methods
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
              console.error('existing', existing, 'new', dto);
            }
            continue;
          }
          allDtos[dto.name] = dto;
        }
      }
      let dtos = Object.values(allDtos).map(dto => dto.toSchema());


      promises.push(...dtos.map(dto => fs.writeFile(dtosDir + dto.title + '.json', JSON.stringify(dto, null, 2))));

      // Write methods files.
      promises.push(...methods.map(method =>
         fs.writeFile(methodsDir + method.name + '.json', JSON.stringify(method.getMethod(), null, 2))));

      let endpointInfo = {
        name: this.name,
        desc: this.desc,
        id: this.id
      };
      promises.push(fs.writeFile(this.name + '/endpoint.json', JSON.stringify(endpointInfo, null, 2)));

      return promises;
    });
}

module.exports = Endpoint;
