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
    let endpoints = {};
    return Promise.all(Array.from(els).map(el => {
      let name = el.getAttribute('api-name');
      let url = 'https://developer.riotgames.com/api-details/' + name;
      return req(url)
        .catch(e => req(url)) // 1 retry.
        .then(JSON.parse)
        .then(o => new JSDOM(o.html))
        .then(dom => new Endpoint(dom).compile());
    }));
  })
  .catch(console.err);
