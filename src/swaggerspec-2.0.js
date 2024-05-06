/// Swagger Spec generator

const hash = require('object-hash');

// Riot API exclusively uses JSON.
const MIME_JSON = 'application/json';

function toSpec({ endpoints, regions, description, schemaOverrides, enumsHash }) {
  const methods = endpoints.flatMap(endpoint => endpoint.methods);
  const paths = {};
  methods.forEach(method => {
    const path = paths[method.getPathUrl()] = paths[method.getPathUrl()] || {};
    const op = path[method.httpMethod] = method.getOperation();

    const xData = {
      'x-endpoint': method.endpoint.name,
      'x-platforms-available': method.platformsAvailable,
      'x-route-enum': method.routeEnumName,
    };
    Object.assign(path, xData);
    Object.assign(op, xData);

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
  endpoints.forEach(endpoint =>
    endpoint.get_dtos()
      .map(dto => {
        const fullName = `${endpoint.name}.${dto.name}`;
        const schema = dto.toSchema();
        return [ fullName, schema ]
      })
      .concat(Object.entries(schemaOverrides))
      .forEach(([ fullName, schema ]) => {
        Object.values(schema.properties).forEach(prop => {
          // Override anyOf for v2.0.
          if (!prop.type && prop.anyOf) {
            // Use first anyOf value.
            Object.assign(prop, prop.anyOf[0]);
            delete prop.anyOf;
          }
        });
        schemas[fullName] = schema;
      })
  );

  let spec = {
    swagger: "2.0",
    info: {
      title: "Riot API",
      description,
      termsOfService: "https://developer.riotgames.com/terms"
    },
    // Use NA1 as default region.
    host: "na1.api.riotgames.com",
    'x-host-platform': regions,
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
      },
      'rso': {
        type: 'oauth2',
        description: 'Riot Sign-On (RSO).',
        flow: 'accessCode',
        authorizationUrl: 'https://auth.riotgames.com/authorize',
        tokenUrl: 'https://auth.riotgames.com/token',
        scopes: {
          'openid': 'Required, scope for authentication.',
          'cpid': 'Returns the game region for League of Legends.',
          'offline_access': 'Allows Refresh Tokens to be used to retrieve new access_tokens that have access to the /userinfo endpoint.'
        }
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
  spec.info['x-hash'] = spec.info.version + enumsHash;
  spec.info['x-enumsHash'] = enumsHash;

  // Update `$ref`s.
  function ref(obj) {
    if ('object' !== typeof obj || null == obj)
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
