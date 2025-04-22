/// OpenAPI spec generator

const hash = require('object-hash');

function toSpec({ endpoints, regions, description, schemaOverrides, enumsHash }) {
  const paths = {};
  endpoints.forEach(endpoint => {
    endpoint.methods.forEach(method => {
      const path = paths[method.getPathUrl()] || (paths[method.getPathUrl()] = {});
      const prev = path[method.httpMethod];
      if (null != prev) {
        console.error(`!!! Ignoring duplicate method ${JSON.stringify(method.httpMethod)} ${JSON.stringify(method.getPathUrl())}. Existing: ${prev.operationId}, ignored: ${method.canonName}.`);
        return;
      }
      const op = path[method.httpMethod] = method.getOperation();
      if (null == method.routeEnumName)
        console.error(`Failed to determine routeEnumName for method ${method.canonName}.`);
      const xData = {
        'x-endpoint': endpoint.name,
        'x-platforms-available': method.platformsAvailable,
        'x-route-enum': method.routeEnumName,
      };
      Object.assign(path, xData);
      Object.assign(op, xData);
    });
  });

  const schemas = {
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
      .forEach(dto => schemas[endpoint.name + '.' + dto.name] = dto.toSchema())
  );
  Object.assign(schemas, schemaOverrides);

  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Riot API",
      description,
      termsOfService: "https://developer.riotgames.com/terms"
    },
    servers: [
      {
        url: "https://{platform}.api.riotgames.com",
        variables: {
          platform: {
            enum: regions,
            default: regions[0]
          }
        }
      }
    ],
    paths,
    components: {
      schemas,
      securitySchemes: {
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
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://auth.riotgames.com/authorize',
              tokenUrl: 'https://auth.riotgames.com/token',
              scopes: {
                'openid': 'Required, scope for authentication.',
                'cpid': 'Returns the game region for League of Legends.',
                'offline_access': 'Allows Refresh Tokens to be used to retrieve new access_tokens that have access to the /userinfo endpoint.'
              }
            }
          }
        }
      }
    },
    security: [
      { 'api_key': [] },
      { 'X-Riot-Token': [] }
    ]
  };

  const ignored = [ 'info', 'tags' ];
  const versioned = {};
  for (const [ key, value ] of Object.entries(spec)) {
    if (!ignored.includes(key))
      versioned[key] = value;
  }
  spec.info.version = hash(versioned);
  spec.info['x-hash'] = spec.info.version + enumsHash;
  spec.info['x-enumsHash'] = enumsHash;

  return spec;
};

module.exports = {
  toSpec,
  name: 'openapi-3.0.0'
};
