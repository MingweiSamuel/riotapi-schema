/// Representation of a single method.
/// i.e. https://developer.riotgames.com/api-methods/#champion-mastery-v4/GET_getAllChampionMasteries
/// A method is a single REST API url with associated argument, return value,
/// and response code information.

const fs = require("fs-extra");

const aliases = require('./data/dtoAliases');
const platformsAvailableOverrides = require('./data/endpointPlatformsAvailableOverrides');
const Schema = require('./schema');
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

  let content = methodEl.children[1];
  let methodMeta = content.getElementsByClassName('method_meta')[0];
  this.deprecated = methodMeta && methodMeta.textContent.toLowerCase().includes('deprecated');

  this.bodyType = null;
  this.bodyRequired = null;
  this.returnType = null;
  this.dtos = [];
  this.params = [];
  this.responses = {};

  this.rateLimitNotes = null;
  this.implementationNotes = null;

  this.platformsAvailable = null;

  console.log('  ' + this.name + ' - ' + this.httpMethod.toUpperCase() +
    (this.deprecated ? ' (DEPRECATED)'  : ''));

  let apiBlocks = this.methodEl.getElementsByClassName('api_block');
  Array.from(apiBlocks)
    .forEach(apiBlock => this._compileApiBlock(apiBlock));
  let platformSelect = this.methodEl.querySelector('[name=execute_against]');
  this._handlePlatformSelect(platformSelect);
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
  this.responses['200'] = response200;

  let operation = {
    tags: [ this.endpoint.name ],
    summary: this.summary,
    externalDocs: {
      description: "Official API Reference",
      url: "https://developer.riotgames.com/api-methods/" + this.urlHash
    },
    responses: this.responses,
    operationId: this.endpoint.name + '.' + this.name
  };
  if (this.appRateLimitExcluded)
    operation['x-app-rate-limit-excluded'] = true;

  let description = [ this.summary ];
  if (this.implementationNotes) description.push(...['## Implementation Notes', this.implementationNotes]);
  if (this.rateLimitNotes) description.push(...['## Rate Limit Notes', this.rateLimitNotes]);
  operation.description = description.join('\n');

  if (this.bodyType) {
    operation.requestBody = {
      content: {
        'application/json': {
          schema: this.bodyType
        }
      },
      required: this.bodyRequired
    }
  }
  if (this.bodyDesc)
    operation.requestBody.description = this.bodyDesc;
  if (this.params.length)
    operation.parameters = this.params;
  if (this.deprecated)
    operation.deprecated = true;

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
      this.appRateLimitExcluded = this.rateLimitNotes.toUpperCase() ===
        'Requests to this API are not counted against the application Rate Limits.'.toUpperCase()
      break;
    case 'path parameters':
    case 'query parameters':
      let inType = type.split(/\s+/, 1)[0];
      let params = Schema.fromHtml(apiBlockHtml, this.endpoint.name).toParameters(inType);
      this.params.push(...params);
      break;
    case 'body parameters':
      this._handleBodyParameters(apiBlockHtml);
      break;
    case 'response errors':
      let table = apiBlockHtml.lastElementChild;
      let tbody = table.tBodies[0];
      Array.from(tbody.children)
        .forEach(tr => {
          let [ code, description ] = Array.from(tr.children).map(td => td.textContent.trim());
          this.responses[code] = {
            description
          };
        });
      break;
    default:
      console.error('Unhandled api block: "' + type + '".');
  }
}

Method.prototype._handleResponseClasses = function(apiBlockHtml) {
  // returnType may be null.
  this.returnType = Schema.readReturnType(apiBlockHtml.children[1], this.endpoint.name);
  let aliasMap = aliases[this.endpoint.name];
  this.dtos.push(...Array.from(apiBlockHtml.children)
    .slice(2, -1)
    .map(el => Schema.fromHtml(el, this.endpoint.name))
    .filter(s => !aliasMap || !aliasMap[s.name]));
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
    this.dtos.push(Schema.fromHtml(block, this.endpoint.name));
  }
};

Method.prototype._handlePlatformSelect = function(platformSelect) {
  if (platformsAvailableOverrides[this.endpoint.name]) {
    this.platformsAvailable = platformsAvailableOverrides[this.endpoint.name];
  }
  if (!platformSelect)
    return;
  this.platformsAvailable = Array.from(platformSelect.children)
    .map(opt => opt.value.toLowerCase());
};

module.exports = Method;
