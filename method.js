const fs = require("./fs");

const dtoUtils = require('./dtoUtils');

function Method(endpoint, methodEl) {
  this.endpoint = endpoint;
  this.methodEl = methodEl;
  this.name = methodEl.id.substring(1);
  this.httpMethod = methodEl.children[0].children[0].children[0].textContent.trim();
  this.returnType = null;
  this.dtos = null;

  console.log(this.name + ' - ' + this.httpMethod);
}

Method.prototype.compile = function() {
  let apiBlocks = this.methodEl.getElementsByClassName('api_block');
  Array.from(apiBlocks)
    .forEach(apiBlock => this._compileApiBlock(apiBlock));
}

Method.prototype.getMethod = function() {
  return {
    endpoint: this.endpoint.name,
    name: this.name,
    method: this.httpMethod,
    returnType: this.returnType
  };
}

Method.prototype._compileApiBlock = function(apiBlockHtml) {
  let typeH4 = apiBlockHtml.getElementsByTagName('h4')[0];
  let type = typeH4.textContent.trim().toLowerCase();
  switch(type) {
    case 'response classes':
      let { returnType, dtos } = dtoUtils.readDtos(apiBlockHtml);
      this.returnType = returnType;
      this.dtos = dtos;
      break;
    case 'implementation notes':
    case 'response errors':
    case 'path parameters':
    case 'query parameters':
    case 'rate limit notes':
    case 'body parameters':
      // TODO
      break;
    default:
      console.error('Unhandled api block: "' + type + '".');
  }
}

module.exports = Method;
