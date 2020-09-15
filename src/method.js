/// Representation of a single method.
/// i.e. https://developer.riotgames.com/api-methods/#champion-mastery-v4/GET_getAllChampionMasteries
/// A method is a single REST API url with associated argument, return value,
/// and response code information.

const platformsAvailableOverrides = require('./data/endpointPlatformsAvailableOverrides');
const methodReturnOverrides = require('./data/methodReturnOverrides');
const routesTable = require('./data/routesTable');
const methodOptional = require('./data/methodOptional');

const Schema = require('./schema');
const types = require('./types');

function Method(endpoint, methodEl) {
  this.endpoint = endpoint;
  this.methodEl = methodEl;
  this.name = methodEl.id.substring(1);
  this.canonName = `${this.endpoint.name}.${this.name}`;

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
  this.returnType = methodReturnOverrides[this.canonName] || null;
  this.dtos = [];
  this.params = [];
  this.responses = {};

  this.rateLimitNotes = null;
  this.implementationNotes = null;

  this.platformsAvailable = null;
  this.routeEnumName = null;

  this.nullable404 = methodOptional[this.canonName] || false;

  console.log(`  ${this.name} - ${this.httpMethod.toUpperCase()}` +
    (this.nullable404 ? ' (nullable)' : '') +
    (this.deprecated ? ' (DEPRECATED)'  : '') +
    (this.returnType ? ` [return override ${this.returnType['x-type']}]` : ''));

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
    operationId: this.canonName
  };

  if (this.nullable404) // Can return 404.
    operation['x-nullable-404'] = true;

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
};

Method.prototype.getPathUrl = function() {
  return this.pathUrl;
};

// Method.prototype.getCanonicalName = function() {
//   return `${this.endpoint.name}.${this.name}`;
// };

Method.prototype._compileApiBlock = function(apiBlockHtml) {
  let typeH4 = apiBlockHtml.getElementsByTagName('h4')[0];
  let type = typeH4.textContent.trim().toLowerCase();

  let requiredByDefault = false;
  let onlyUseRequiredByDefault = false;
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
      requiredByDefault = true;
      onlyUseRequiredByDefault = true;
      // Fall through.
    case 'query parameters':
      let inType = type.split(/\s+/, 1)[0];
      let params = Schema.fromHtml(apiBlockHtml, this.endpoint.name, this.name, {
          isParam: true, requiredByDefault, onlyUseRequiredByDefault
        }).toParameters(inType);
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
};

Method.prototype._handleResponseClasses = function(apiBlockHtml) {
  // returnType may be null.
  const [ returnTypeBlock, ...schemaBlocks ] = apiBlockHtml.querySelectorAll('div.block.response_body');
  this.returnType || (this.returnType =
    Schema.readReturnType(returnTypeBlock, this.endpoint.name, this.name));
  this.dtos.push(...schemaBlocks
    .map(el => Schema.fromHtml(el, this.endpoint.name, this.name, { requiredByDefault: true, useDtoOptional: true })));
};

Method.prototype._handleBodyParameters = function(apiBlockHtml) {
  let table = apiBlockHtml.children[1];
  let tr = table.tBodies[0].children[0];
  let code = tr.children[0];

  this.bodyType = types.getType(code.childNodes[0].textContent.trim(), this.endpoint.name, this.name);
  this.bodyRequired = 'required' === code.children[0].textContent.trim().toLowerCase();
  this.bodyDesc = tr.children[3].textContent.trim();

  let block = apiBlockHtml;
  while ((block = block.nextElementSibling) && block.classList.contains('block')) {
    this.dtos.push(Schema.fromHtml(block, this.endpoint.name, this.name, { requiredByDefault: true }));
  }
};

Method.prototype._handlePlatformSelect = function(platformSelect) {
  if (platformsAvailableOverrides[this.endpoint.name]) {
    this.platformsAvailable = platformsAvailableOverrides[this.endpoint.name];
  }
  else if (platformSelect) {
    this.platformsAvailable = Array.from(platformSelect.children)
      .map(opt => opt.value.toLowerCase());
  }
  
  // Find route enum based on routesTable.
  for (const [ routeEnumName, routes ] of Object.entries(routesTable)) {
    if (this.platformsAvailable.every(r => routes.includes(r))) {
      this.routeEnumName = routeEnumName;
      break;
    }
  }
};

module.exports = Method;
