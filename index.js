const fs = require("./fs");

const req = require("request-promise-native");
const process = require('process');
const { JSDOM } = require("jsdom");

const Endpoint = require('./endpoint');

const url = 'https://developer.riotgames.com/api-methods/';
const output = 'out';

process.chdir(__dirname);

fs.mkdirAsync(output)
  .catch(() => {})
  .then(() => {
    process.chdir(__dirname + '/' + output);
    return req(url)
  })
  .catch(e => req(url))
  .then(body => {
    let dom = new JSDOM(body);

    let els = dom.window.document.getElementsByClassName('api_option');
    return Promise.all(Array.from(els)
      .map(el => {
        let name = el.getAttribute('api-name');
        let desc = el.getElementsByClassName('api_desc')[0].textContent.trim();
        let url = 'https://developer.riotgames.com/api-details/' + name;
        return req(url)
          .catch(e => req(url)) // 1 retry.
          .then(JSON.parse)
          .then(o => new JSDOM(o.html))
          .then(dom => {
            let endpoint = new Endpoint(dom, desc);
            return endpoint.compile().then(() => endpoint);
          });
      }))
      .then(endpoints => fs.writeFileAsync('index.json', JSON.stringify(endpoints.map(e => e.name), null, 2)));
  })
  .catch(console.err);
