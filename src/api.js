const fs = require("fs-extra");

const req = require("request-promise-native");
const process = require('process');
const { JSDOM } = require("jsdom");

const Endpoint = require('./endpoint');

const url = 'https://developer.riotgames.com/api-methods/';
const output = 'out';

module.exports = function(rootDir) {
  process.chdir(rootDir);

  fs.mkdir(output).catch(() => {})
    .then(() => fs.readdir(output))
    .then(files => Promise.all(files.map(file => fs.remove(output + '/' + file))))
    .then(() => {
      process.chdir(rootDir + '/' + output);
      return req(url).catch(e => req(url));
    })
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
        }));
    })
    .then(() => {
      // Write index files.
      return writeIndex('./');
    })
    .catch(console.err);
};

function writeIndex(dir) {
  return fs.readdir(dir)
    .then(files =>
      Promise.all(files
        .filter(file => !file.startsWith('.'))
        .map(file => fs.stat(dir + file)
          .then(stat => ((stat && stat.isDirectory()) ? {
            file: { name: file + '/' },
            promise: writeIndex(dir + file + '/')
              .then(() => file + '/')
          } : {
            file: { name: file, size: stat.size },
            promise: null
          }))
        )
      )
      .then(objs => objs
        .reduce((obj, file) => {
          obj.files.push(file.file);
          if (file.promise)
            obj.promises.push(file.promise);
          return obj;
        }, {
          files: [],
          promises: []
        })
      )
    )
    .then(obj => {
      let files = obj.files
      .sort((a, b) =>
        (b.name.includes('/') - a.name.includes('/')) ||
        a.name.localeCompare(b.name));
      let names = obj.files
        .map(f => f.name);

      obj.promises.push(fs.writeFile(dir + 'index.json', JSON.stringify(names, null, 2)));
      obj.promises.push(fs.writeFile(dir + 'index.html',
`
<!DOCTYPE html>
<head>
  <title>Index of ${dir.substr(1)}</title>
</head>
<body>
<h1>Index of ${dir.substr(1)}</h1>
<table>
<tr>
  <th>Name</th>
  <th>Size</th>
</tr>
${dir !== './' ? '<tr><td><a href="..">..</a></td><td></td></tr>' : ''}
<tr><td><a href="index.json">index.json</a></td><td></td></tr>
${obj.files.map(file => `  <tr><td><a href="${file.name}">${file.name}</a></td><td>${file.size ? file.size + ' B' : ''}</td></tr>`).join('\n')}
</body>
`
      ));
      return Promise.all(obj.promises);
    });
}
