const fs = require("fs-extra");

const Dto = require('./dto');

function Method(endpoint, methodEl) {
  this.endpoint = endpoint;
  this.methodEl = methodEl;
  this.name = methodEl.id.substring(1);

  let heading = methodEl.children[0];
  let method = heading.children[0].children[0];
  this.httpMethod = method.textContent.trim().toLowerCase();
  this.urlHash = method.getAttribute("href");
  this.pathUrl = heading.children[1].children[0].textContent.trim();

  this.returnType = null;
  this.dtos = null;

  this.summary = null; //TODO
  this.description = null;

  console.log('  ' + this.name + ' - ' + this.httpMethod.toUpperCase());
  this._compile();
}

Method.prototype._compile = function() {
  let apiBlocks = this.methodEl.getElementsByClassName('api_block');
  Array.from(apiBlocks)
    .forEach(apiBlock => this._compileApiBlock(apiBlock));
}

// https://swagger.io/specification/#pathItemObject
Method.prototype.getPathItemObject = function() {
  let result = {};
  let operation = {
    tags: [ this.endpoint.name ],
    externalDocs: {
      description: "Official API Reference",
      url: "https://developer.riotgames.com/api-methods/" + this.urlHash
    },
    responses: {
      "200": {
        description: 'ReSpOnSe', //TODO
        content: {
          "application/json": {
            schema: this.returnType
          }
        }
      }
    }
    // name: this.name
  };
  if (this.summary) operation.summary = this.summary;
  if (this.description) operation.description = this.description;
  result[this.httpMethod] = operation;
  return result;
}

Method.prototype.getPathUrl = function() {
  return this.pathUrl;
}

Method.prototype._compileApiBlock = function(apiBlockHtml) {
  let typeH4 = apiBlockHtml.getElementsByTagName('h4')[0];
  let type = typeH4.textContent.trim().toLowerCase();
  switch(type) {
    case 'response classes':
      let { returnType, dtos } = Dto.readDtos(apiBlockHtml, this.endpoint.name);
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
