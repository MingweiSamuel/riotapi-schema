const hash = require('object-hash');

function toSpec({ endpoints, regions, description }) {
  let methods = [].concat.apply([], endpoints.map(endpoint => endpoint.methods));
  let paths = {};
  methods.forEach(method => {
    let path = paths[method.getPathUrl()] || (paths[method.getPathUrl()] = {});
    path[method.httpMethod] = method.getOperation();
  });

  let schemas = {
    Error: {
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
      schemas[method.endpoint.name + '.' + dto.name] = dto.toSchema();
    });
  });

  let spec = {
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
            enum: regions.service.map(r => r.hostPlatform),
            default: "na1"
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
  let versioned = {};
  for (let [ key, value ] of Object.entries(spec)) {
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
