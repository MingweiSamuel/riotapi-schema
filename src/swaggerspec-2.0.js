const hash = require('object-hash');

// Riot API exclusively uses JSON.
const MIME_JSON = 'application/json';

function toSpec({ endpoints, regions, description }) {
  let methods = [].concat.apply([], endpoints.map(endpoint => endpoint.methods));
  let paths = {};
  methods.forEach(method => {
    let path = paths[method.getPathUrl()] || (paths[method.getPathUrl()] = {});
    let op = path[method.httpMethod] = method.getOperation();
    op.produces = [ MIME_JSON ];
    if (op.parameters) {
      op.parameters.forEach(param => {
        // Merge schema into param obj.
        // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#parameterObject
        delete param.explode; // Explode not supported.

        Object.assign(param, param.schema); // Schema is included directly in object.
        delete param.schema;

        if (!param.description) // Null description not allowed.
          param.description = '';
      });
    }
    Object.values(op.responses).forEach(res => {
      // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#responseObject
      // Move res.content[MIME_JSON].schema into res.schema.
      if (res.content) {
        if (res.content[MIME_JSON])
          res.schema = res.content[MIME_JSON].schema;
        delete res.content;
      }
    });
    if (op.requestBody) {
      op.consumes = [ MIME_JSON ];
      let reqBody = op.requestBody;
      delete op.requestBody;

      // Move schema
      reqBody.schema = reqBody.content[MIME_JSON].schema;
      delete reqBody.content;
      // Set in body.
      reqBody.in = 'body';
      // Body must have name, so we make it the same as the type.
      reqBody.name = reqBody.schema['x-type'];

      if (!op.parameters)
        op.parameters = [];
      op.parameters.push(reqBody);
    }
  });

  let schemas = {
    Error: {
      "type": "object",
      "properties": {
        "status": {
          "type": "object",
          "properties": {
            "status_code": {
              "type": "integer"
            },
            "message": {
              "type": "string"
            }
          }
        }
      }
    }
  };
  methods.forEach(method => {
    method.dtos.forEach(dto => {
      let schema = schemas[method.endpoint.name + '.' + dto.name] = dto.toSchema();
      Object.values(schema.properties).forEach(prop => {
        // Override anyOf for v2.0.
        if (!prop.type && prop.anyOf) {
          // Use first anyOf value.
          Object.assign(prop, prop.anyOf[0]);
          delete prop.anyOf;
        }
      });
    });
  });

  let spec = {
    swagger: "2.0",
    info: {
      title: "Riot API",
      description,
      termsOfService: "https://developer.riotgames.com/terms-and-conditions.html"
    },
    // Use NA1 as default region.
    host: "na1.api.riotgames.com",
    'x-host-platform': regions.service.map(r => r.hostPlatform),
    schemes: [ "https" ],
    paths,
    definitions: schemas,
    securityDefinitions: {
      'api_key': {
        type: 'apiKey',
        description: 'API key in query param.',
        name: 'api_key',
        in: 'query'
      },
      'X-Riot-Token': {
        type: 'apiKey',
        description: 'API key in header.',
        name: 'X-Riot-Token',
        in: 'header'
      }
    },
    security: [
      { 'api_key': [] },
      { 'X-Riot-Token': [] }
    ]
  };

  const ignored = [ 'info', 'tags' ];
  let versioned = {};
  for (let [ key, value ] of Object.entries(spec)) {
    if (!ignored.includes(key))
      versioned[key] = value;
  }
  spec.info.version = hash(versioned);

  // Update `$ref`s.
  function ref(obj) {
    if ('object' !== typeof obj)
      return;
    Object.keys(obj).forEach(key => {
      if ('$ref' === key) {
        obj[key] = obj[key].replace(/^#\/components\/schemas/, '#/definitions');
      }
      ref(obj[key]);
    });
  }
  ref(spec);

  return spec;
};

module.exports = {
  toSpec,
  name: 'swaggerspec-2.0'
};
