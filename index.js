const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"))

const req = require("request-promise-native");
const process = require('process');
const { JSDOM } = require("jsdom");

const dtoUtils = require('./dtoUtils');

process.chdir(__dirname + '/output');

let url = 'https://developer.riotgames.com/api-methods/'
req(url)
  .catch(e => req(url))
  .then(body => {
    let dom = new JSDOM(body);

    let els = dom.window.document.getElementsByClassName('api_option');
    let endpoints = {};
    for (let el of els) {
      let name = el.getAttribute('api-name');
      if (name.startsWith('tournament'))
        continue;
      let url = 'https://developer.riotgames.com/api-details/' + name;
      endpoints[name] = req(url)
        .catch(e => req(url)) // 1 retry.
        .then(JSON.parse)
        .then(o => new JSDOM(o.html))
        .then(handleEndpoint);
    }
    return Promise.props(endpoints);
  })
  .catch(console.err);

function handleEndpoint(endpointDom) {
  let endpointName = endpointDom.window.document.body.children[0].children[0].getAttribute('api-name').trim();
  return fs.mkdirAsync(endpointName)
    .catch(() => {})
    .then(() => {
      let methods = endpointDom.window.document.getElementsByClassName('operation');
      return Promise.all(Array.from(methods)
        .map(method => handleMethod(endpointName, method)));
    });
}

function handleMethod(endpointName, methodHtml) {
  let apiBlocks = methodHtml.getElementsByClassName('api_block');
  return Promise.all(Array.from(apiBlocks)
    .map(apiBlock => handleApiBlock(endpointName, apiBlock)));
}

function handleApiBlock(endpointName, apiBlockHtml) {
  let typeH4 = apiBlockHtml.getElementsByTagName('h4')[0];
  let type = typeH4.textContent.trim().toLowerCase();
  switch(type) {
    case 'response classes':
      let { returnType, dtos } = dtoUtils.readDtos(apiBlockHtml);
      return dtos.map(schema => fs.writeFileAsync(endpointName + '/' + schema.title + '.json', JSON.stringify(schema, null, 2)));
      break;
    case 'implementation notes':
    case 'response errors':
    case 'path parameters':
    case 'query parameters':
    case 'rate limit notes':
      // TODO
      break;
    default:
      console.error('Unhandled api block: ' + type);
  }
}
