const fs = require("./fs");

const Method = require('./method')

function Endpoint(endpointDom) {
  this.dom = endpointDom;
  this.name = endpointDom.window.document.body.children[0].children[0].getAttribute('api-name').trim();
  this.dtos = [];
}

Endpoint.prototype.compile = function() {
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
      let dtos = methods
        .map(method => method.dtos)
        .reduce((a, b) => a.concat(b), []);
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

      return promises;
    });
}

module.exports = Endpoint;
