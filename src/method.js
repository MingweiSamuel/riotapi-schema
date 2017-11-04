const fs = require("fs-extra");

const Dto = require('./dto');
const types = require('./types');

function Method(endpoint, methodEl) {
  this.endpoint = endpoint;
  this.methodEl = methodEl;
  this.name = methodEl.id.substring(1);

  let heading = methodEl.children[0];
  let method = heading.children[0].children[0];
  this.httpMethod = method.textContent.trim().toLowerCase();
  this.urlHash = method.getAttribute("href");
  this.pathUrl = heading.children[1].textContent.trim();
  this.summary = heading.children[2].textContent.trim();

  this.bodyType = null;
  this.bodyRequired = null;
  this.returnType = null;
  this.dtos = [];

  this.rateLimitNotes = null;
  this.implementationNotes = null;

  console.log('  ' + this.name + ' - ' + this.httpMethod.toUpperCase());
  this._compile();
}

Method.prototype._compile = function() {
  let apiBlocks = this.methodEl.getElementsByClassName('api_block');
  Array.from(apiBlocks)
    .forEach(apiBlock => this._compileApiBlock(apiBlock));
}

// https://swagger.io/specification/#pathItemObject
Method.prototype.getOperation = function() {
  let response200 = {
    description: 'Success',
  };
  if (this.returnType) {
    response200.content = {
      'application/json': {
        schema: this.returnType
      }
    };
  }

  let operation = {
    tags: [ this.endpoint.name ],
    summary: this.summary,
    externalDocs: {
      description: "Official API Reference",
      url: "https://developer.riotgames.com/api-methods/" + this.urlHash
    },
    responses: {
      "200": response200
    }
    // name: this.name
  };

  let description = [ this.summary ];
  if (this.implementationNotes) description.push(...['## Implementation Notes', this.implementationNotes]);
  if (this.rateLimitNotes) description.push(...['## Rate Limit Notes', this.rateLimitNotes]);
  operation.description = description.join('\n');

  if (this.bodyType) {
    operation.requestBody = {
      description: this.bodyDesc,
      content: {
        'application/json': {
          schema: this.bodyType
        }
      },
      required: this.bodyRequired
    }
  }

  return operation;
}

Method.prototype.getPathUrl = function() {
  return this.pathUrl;
}

Method.prototype._compileApiBlock = function(apiBlockHtml) {
  let typeH4 = apiBlockHtml.getElementsByTagName('h4')[0];
  let type = typeH4.textContent.trim().toLowerCase();
  switch(type) {
    case 'response classes':
      this._handleResponseClasses(apiBlockHtml);
      break;
    case 'implementation notes':
      this.implementationNotes = apiBlockHtml.children[1].textContent.trim();
      break;
    case 'rate limit notes':
      this.rateLimitNotes = apiBlockHtml.children[1].textContent.trim();
      break;
    case 'response errors':
    case 'path parameters':
    case 'query parameters':
      break;
    case 'body parameters':
      this._handleBodyParameters(apiBlockHtml);
      break;
    default:
      console.error('Unhandled api block: "' + type + '".');
  }
}

Method.prototype._handleResponseClasses = function(apiBlockHtml) {
  // returnType may be null.
  this.returnType = Dto.readReturnType(apiBlockHtml.children[1], this.endpoint.name);
  this.dtos.push(...Array.from(apiBlockHtml.children)
    .slice(2, -1)
    .map(e => new Dto(e, this.endpoint.name)));
};

Method.prototype._handleBodyParameters = function(apiBlockHtml) {
  let table = apiBlockHtml.children[1];
  let tr = table.tBodies[0].children[0];
  let code = tr.children[0];

  this.bodyType = types.getType(code.childNodes[0].textContent.trim(), this.endpoint.name);
  this.bodyRequired = 'required' === code.children[0].textContent.trim().toLowerCase();
  this.bodyDesc = tr.children[3].textContent.trim();

  let block = apiBlockHtml;
  while ((block = block.nextElementSibling) && block.classList.contains('block')) {
    this.dtos.push(new Dto(block, this.endpoint.name));
  }
};

module.exports = Method;
