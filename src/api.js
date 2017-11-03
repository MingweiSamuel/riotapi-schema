const fs = require("fs-extra");

const req = (function(req) {
  return url => req(url).catch(() => req(url));
})(require("request-promise-native"));

const process = require('process');
const { JSDOM } = require("jsdom");
const hash = require('object-hash');

const Endpoint = require('./endpoint');
const Region = require('./region');

const baseUrl = 'https://developer.riotgames.com/';
const output = 'out';

module.exports = function(rootDir) {
  process.chdir(rootDir);

  fs.mkdirs(output)
    .then(() => fs.readdir(output))
    .then(files => Promise.all(files
      .filter(file => !file.startsWith('.'))
      .map(file => fs.remove(output + '/' + file))))
    .then(() => fs.copy('swagger-ui-dist/', output + '/tool'))
    .then(() => process.chdir(rootDir + '/' + output))
    .then(() => {
      let endpoints = req(baseUrl + 'api-methods/')
        .then(body => {
          let dom = new JSDOM(body);
          let els = dom.window.document.getElementsByClassName('api_option');
          return Promise.all(Array.from(els)
            .map(el => {
              let name = el.getAttribute('api-name');
              let desc = el.getElementsByClassName('api_desc')[0].textContent.trim();
              return req(baseUrl + 'api-details/' + name)
                .then(JSON.parse)
                .then(o => new JSDOM(o.html))
                .then(dom => new Endpoint(dom, desc))
                .catch(console.error);
            }));
        });

      let regions = req(baseUrl + 'regional-endpoints.html')
        .then(body => {
          let dom = new JSDOM(body);
          let panel = dom.window.document.getElementsByClassName('panel-content')[0];
          let [ serviceTable, regionalTable ] = panel.getElementsByTagName('table');
          let service = Array.from(serviceTable.tBodies[0].children)
            .map(tr => new Region(tr));
          return { service };
        });

      return Promise.props({ endpoints, regions });
    })
    .then(data => {
      let { endpoints, regions } = data;

      let methods = [].concat.apply([], endpoints.map(endpoint => endpoint.methods));
      let paths = methods.reduce((paths, method) => {
        let path = paths[method.getPathUrl()] || (paths[method.getPathUrl()] = {});
        path[method.httpMethod] = method.getOperation();
        return paths;
      }, {});

      let schemas = methods.reduce((schemas, method) => {
        method.dtos.forEach(dto => {
          schemas[method.endpoint.name + '.' + dto.name] = dto.toSchema();
        });
        return schemas;
      }, {});

      let openAPI = {
        openapi: "3.0.0",
        info: {
          title: "Riot API",
          description: "Riot API desc", //TODO
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
          schemas
        }
      };
      openAPI.info.version = hash(openAPI);
      return openAPI;
    })
    .then(openAPI => fs.writeFile("riotapi.json", JSON.stringify(openAPI, null, 2)))
    // .then(() => {
    //   // Write index files.
    //   return writeIndex('./');
    // })
    .catch(console.err);
};

if (!Promise.props) {
  Promise.props = function(dict) {
    return Promise.all(Object.values(dict))
      .then(vals => {
        let keys = Object.keys(dict);
        let res = {};
        vals.forEach((val, i) => res[keys[i]] = val);
        return res;
      });
  };
}
