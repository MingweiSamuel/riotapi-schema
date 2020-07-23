/// OpenAPI spec generator

const hash = require('object-hash');

function toSpec({ endpoints, regions, description, schemaOverrides }) {
  const paths = {};
  endpoints.forEach(endpoint => {
    endpoint.methods.forEach(method => {
      const path = paths[method.getPathUrl()] || (paths[method.getPathUrl()] = {});
      const op = path[method.httpMethod] = method.getOperation();
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
      termsOfService: "https://developer.riotgames.com/terms-and-conditions.html"
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
  return spec;
};

module.exports = {
  toSpec,
  name: 'openapi-3.0.0'
};
