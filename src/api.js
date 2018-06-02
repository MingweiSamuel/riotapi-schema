const fs = require("fs-extra");
const YAML = require('yamljs');

const req = (function(req) {
  return url => req(url).catch(() => req(url));
})(require("request-promise-native"));

const process = require('process');
const { JSDOM } = require("jsdom");

require('./arrayFill');

const Endpoint = require('./endpoint');
const Region = require('./region');

const openapi_300 = require('./openapi-3.0.0');
const swaggerspec_20 = require('./swaggerspec-2.0');
const specs = [ openapi_300, swaggerspec_20 ];

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
                .then(dom => new Endpoint(dom, desc));
            }));
        })
        .then(endpoints => {
          endpoints.forEach(e => e.list_missing_dtos());
          return endpoints;
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
      let names = specs.flatMap(s => [
        s.name + '.json',
        s.name + '.min.json',
        s.name + '.yml',
        s.name + '.min.yml'
      ]);
      data.description = `
OpenAPI/Swagger version of the [Riot API](https://developer.riotgames.com/). Automatically generated daily.
## Download OpenAPI Spec File
The following versions of the Riot API spec file are available:
${names.map(n => `- \`${n}\` ([download file](../${n}), [view ui](?${n}))`).join('\n')}
## Source Code
Source code on [GitHub](https://github.com/MingweiSamuel/riotapi-schema). Pull requests welcome!
## Automatically Generated
Rebuilt on [Travis CI](https://travis-ci.org/MingweiSamuel/riotapi-schema/builds) daily.
***
`;
      return Promise.all(specs.map(spec => {
        let d = spec.toSpec(data);
        return Promise.all([
          fs.writeFile(spec.name + ".json", JSON.stringify(d, null, 2)),
          fs.writeFile(spec.name + ".min.json", JSON.stringify(d)),
          fs.writeFile(spec.name + ".yml", YAML.stringify(d, 1/0, 2)),
          fs.writeFile(spec.name + ".min.yml", YAML.stringify(d, 0))
        ]);
      }))
    })
    .catch(console.error);
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
