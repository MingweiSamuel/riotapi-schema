const fs = require("./fs");

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

  let mkdirsPromise = fs.mkdirAsync(this.name).catch(() => {})
    .then(() => Promise.all(dirs.map(dir => fs.mkdirAsync(dir.slice(0, -1)).catch(() => {}))));

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


      promises.push(...dtos.map(dto => fs.writeFileAsync(dtosDir + dto.title + '.json', JSON.stringify(dto, null, 2))));
      // Write dto index file.
      let dtosIndex = dtos.map(dto => dto.title + '.json');
      promises.push(fs.writeFileAsync(dtosDir + 'index.json', JSON.stringify(dtosIndex, null, 2)));

      // Write methods files.
      promises.push(...methods.map(method =>
         fs.writeFileAsync(methodsDir + method.name + '.json', JSON.stringify(method.getMethod(), null, 2))));
      // Write methods index file.
      let methodsIndex = methods.map(method => method.name + '.json');
      promises.push(fs.writeFileAsync(methodsDir + 'index.json', JSON.stringify(methodsIndex, null, 2)));

      let endpointInfo = {
        name: this.name,
        desc: this.desc,
        id: this.id
      };
      promises.push(fs.writeFileAsync(this.name + '/endpoint.json', JSON.stringify(endpointInfo, null, 2)));

      return promises;
    });
}

module.exports = Endpoint;
