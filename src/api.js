/// This is the main entry point for the schema generation.

const fs = require("fs-extra");
const YAML = require('yamljs');

// Two-try request function.
const req = (function(req) {
  return url => req(url).catch(() => req(url));
})(require("request-promise-native"));

const process = require('process');
const childProcess = require('child-process-es6-promise')
const { JSDOM } = require("jsdom");
const swaggerUiAssetPath = require("swagger-ui-dist").getAbsoluteFSPath();

require('./arrayFill');

const Endpoint = require('./endpoint');
// const Region = require('./region');

const openapi_300 = require('./openapi-3.0.0');
const swaggerspec_20 = require('./swaggerspec-2.0');
const specs = [ openapi_300, swaggerspec_20 ];

const BASE_URL = 'https://developer.riotgames.com/';
// const DOCS_URL = BASE_URL + 'docs/lol';
const OUTPUT = 'out';

const endpointSharedDtos = require('./data/endpointSharedDtos');
const schemaOverrides = require('./data/schemaOverrides');


async function cleanupOutput() {
  // Make output folder.
  await fs.mkdirs(OUTPUT);
  let files = await fs.readdir(OUTPUT);
  // Remove any existing output files.
  await Promise.all(files
    .filter(file => !file.startsWith('.'))
    .map(file => fs.remove(OUTPUT + '/' + file)));

  // Copy swagger tool into output.
  const copyPromise = (async () => {
    await fs.copy(swaggerUiAssetPath, OUTPUT + '/tool');

    const index = OUTPUT + '/tool/index.html';
    let indexContent = await fs.readFile(index, 'UTF-8');
    indexContent = indexContent.replace('"https://petstore.swagger.io/v2/swagger.json"',
      "'../' + (document.location.search.slice(1) || 'openapi-3.0.0.min.json')");

    await fs.writeFile(index, indexContent);
  })();

  await Promise.all([
    copyPromise,
    fs.writeFile(OUTPUT + '/_config.yml', ''),
    fs.writeFile(OUTPUT + '/index.md', '---\n---\n[Link to tool](tool/)'),
    fs.writeFile(OUTPUT + '/hash.txt', '---\n---\n{{ site.github.build_revision }}'),
  ]);
}


async function getEndpoints() {
  // Read endpoints index page.
  let endpointsPageDom = new JSDOM(await req(BASE_URL + 'api-methods/'));
  let endpointsElements = Array.from(
    endpointsPageDom.window.document.getElementsByClassName('api_option'));
  // Create endpoint objects.
  let endpoints = await Promise.all(endpointsElements.map(async endpointElement => {
    // For each endpoint, get its detail page and parse it.
    let name = endpointElement.getAttribute('api-name');
    let desc = endpointElement.getElementsByClassName('api_desc')[0]
      .textContent.trim();
    let endpointDetailJson = await req(BASE_URL + 'api-details/' + name);
    let endpointPageDom = new JSDOM(JSON.parse(endpointDetailJson).html);
    return new Endpoint(endpointPageDom, desc);
  }));
  return endpoints;
}


async function fixMissingDtos(endpoints) {
  // Look back at previous version for any missing dtos.
  // TODO: doesn't check if added dtos in turn have their own missing dtos...
  let missingDtos = endpoints.flatMap(endpoint => endpoint.list_missing_dtos()
    .map(dtoName => ({ endpoint, dtoName })));
  let missingDtoNames = [];
  if (missingDtos.length) {
    console.log();

    let endpointsByName = {};
    endpoints.forEach(e => endpointsByName[e.name] = e);

    try {
      // Read old openapi json via process call to git.
      let { stdout, stderr } = await childProcess
        .exec('git --no-pager show origin/gh-pages:openapi-3.0.0.min.json');
      if (stderr)
        throw Error(stderr);

      let oldSchema = JSON.parse(stdout);

      outer:
      for (let { endpoint, dtoName } of missingDtos) {
        // Try finding DTO in previous spec.

        // TODO: fullDtoName magic string.
        let fullDtoName = endpoint.name + '.' + dtoName;
        console.log('Missing DTO: ' + fullDtoName + '.');
        missingDtoNames.push(fullDtoName);

        let oldDto = oldSchema.components.schemas[fullDtoName]
        if (oldDto) {
          if (Object.keys(oldDto.properties).length) {
            console.log('  Using previous commit version.');
            endpoint.add_old_dto(oldDto);
            continue outer;
          }
          console.log('  Not using previous commit version, is placeholder.')
        }

        // Try finding DTO in endpointSharedDtos.
        if (endpointSharedDtos[endpoint.name]) {
          for (let otherName of endpointSharedDtos[endpoint.name]) {
            let otherEndpoint = endpointsByName[otherName];
            if (!otherEndpoint) {
              console.log('  Endpoint alt not found: ' + otherName + '.');
              continue;
            }

            let otherDto = otherEndpoint._allDtos[dtoName];
            if (!otherDto)
              continue;

            console.log('  Using DTO from ' + otherName + '.');
            endpoint.add_old_dto(otherDto);
            continue outer;
          }
        }

        console.log('  FAILED to find dto for ' + fullDtoName + '.');
        // Include as empty object.
        endpoint.add_unknown_dto(dtoName);
      }
    }
    catch(e) {
      console.log('FAILED to get previous commit.', e);
    }
  }
  return missingDtoNames;
}


async function writeEnums() {
  async function getEnumData(enumUrl, valKey, enumModifier) {
    const filename = enumUrl.slice(1 + enumUrl.lastIndexOf('/'));
    const enumLists = await Promise.all([
      fs.readFile(`${__dirname}/enums/${filename}`).then(JSON.parse), // From local enums folder.
      req(enumUrl).then(JSON.parse), // From Riot.
    ]);

    const allVals = new Set();
    const enums = [];
    for (const enumList of enumLists) {
      for (const enumb of enumList) {
        const val = enumb[valKey];
        if (!allVals.has(val)) {
          allVals.add(val);
          enums.push(enumb);
          enumb['x-value'] = val;
        }
      }
    }

    // Sort alphabetically or numerically.
    enums.sort((a, b) => 'string' === typeof a[valKey]
      ? a[valKey].localeCompare(b[valKey])
      : a[valKey] - b[valKey]);

    enumModifier(enums);

    return { filename, enums };
  }
  const enumDatas = await Promise.all([
    getEnumData("http://static.developer.riotgames.com/docs/lol/seasons.json", 'id', enums => {
      for (const enumb of enums)
        enumb['x-name'] = enumb.season.replace(/\s+/g, '_');
    }),
    getEnumData("http://static.developer.riotgames.com/docs/lol/queues.json", 'queueId', enums => {
      const noGames = s => s.replace(/\s+GAMES$/i, '');
      const groups = {};
      for (const enumb of enums) {
        const { map, description } = enumb;
        const groupName = noGames(map).replace(/'/g, '').replace(/\W+/g, '_').toUpperCase() +
            (description ? '_' + noGames(description).replace(/\W+/g, '_').toUpperCase() : '');
        (groups[groupName] || (groups[groupName] = [])).push(enumb);
      };
      for (const [ groupName, groupEnums ] of Object.entries(groups)) {
        for (const enumb of groupEnums) {
          const { queueId, map, description, notes } = enumb;
          const desc = (description ? noGames(description) + ' games on ' : 'Games on ') + map;
          const deprecated = !!(notes && notes.toUpperCase().includes('DEPRECATED'));
          const name = groupName + ((groupEnums.length > 1 && deprecated) ? `_DEPRECATED_${queueId}` : '');

          enumb['x-deprecated'] = deprecated;
          enumb['x-desc'] = desc;
          enumb['x-name'] = name;
        }
      }
    }),
    getEnumData("http://static.developer.riotgames.com/docs/lol/maps.json", 'mapId', enums => {
      const groups = {};
      for (const enumb of enums) {
        const { mapName } = enumb;
        const groupName = mapName.replace(/'/g, '').replace(/\s+/g, '_').toUpperCase();
        (groups[groupName] || (groups[groupName] = [])).push(enumb);
      }
      for (const [ groupName, groupEnums ] of Object.entries(groups)) {
        for (const [ i, enumb ] of groupEnums.entries()) {
          const { mapName, notes } = enumb;
          let name = groupName;
          let deprecated = false;
          if (i !== groupEnums.length - 1) {
            name += '_' + notes.replace(/[^\s\w]+/g, '').replace(/\s+/g, '_').toUpperCase();
            deprecated = true;
          }

          enumb['x-deprecated'] = deprecated;
          enumb['x-desc'] = `${mapName}\n${notes}`
          enumb['x-name'] = name;
        }
      }
    }),
    getEnumData("http://static.developer.riotgames.com/docs/lol/gameModes.json", 'gameMode', enums => {
      for (const enumb of enums) {
        const { gameMode, description } = enumb;
        enumb['x-name'] = gameMode;
        enumb['x-desc'] = description;
      }
    }),
    getEnumData("http://static.developer.riotgames.com/docs/lol/gameTypes.json", 'gametype', enums => {
      for (const enumb of enums) {
        const { gametype, description } = enumb;
        enumb['x-name'] = gametype;
        enumb['x-desc'] = description;
      }
    }),
  ]);

  await fs.mkdir('enums');

  const writeEnumsPromises = enumDatas.map(({ filename, enums }) =>
    fs.writeFile(`enums/${filename}`, JSON.stringify(enums, null, 2)));

  const writeIndexPromise = fs.writeFile('enums/index.md',
    enumDatas.map(({ filename }) => `- [${filename}](${filename})`).join('\n'));

  await Promise.all([
    writeIndexPromise,
    ...writeEnumsPromises
  ]);
}


async function writeOutput(endpoints) {

  const regions = [];
  endpoints.forEach(endpoint =>
    endpoint.methods.forEach(method =>
      method.platformsAvailable.forEach(region => regions.includes(region) || regions.push(region))));

  const data = { endpoints, regions, schemaOverrides };

  const overrides = Object.keys(schemaOverrides);
  if (overrides.length)
    console.log('\nOverriding DTOs: ' + JSON.stringify(overrides));

  const names = specs.flatMap(s => [
    s.name + '.json',
    s.name + '.min.json',
    s.name + '.yml',
    s.name + '.min.yml'
  ]);
  data.description = `
OpenAPI/Swagger version of the [Riot API](https://developer.riotgames.com/). Automatically generated daily.
## OpenAPI Spec File
The following versions of the Riot API spec file are available:
${names.map(n => `- \`${n}\` ([view file](../${n}), [ui select](?url=../${n}))`).join('\n')}
## Other Files
- Missing DTOs: [\`missing.json\`](../missing.json)
- [Enum Files](../enums/)
## Source Code
Source code on [GitHub](https://github.com/MingweiSamuel/riotapi-schema). Pull requests welcome!
## Automatically Generated
Rebuilt on [Travis CI](https://travis-ci.com/MingweiSamuel/riotapi-schema/builds) daily.
***
`;

  // Write specs.
  await Promise.all(specs.map(spec => {
    let out = spec.toSpec(data);
    return Promise.all([
      fs.writeFile(spec.name + ".json", JSON.stringify(out, null, 2)),
      fs.writeFile(spec.name + ".min.json", JSON.stringify(out)),
      fs.writeFile(spec.name + ".yml", YAML.stringify(out, 1/0, 2)),
      fs.writeFile(spec.name + ".min.yml", YAML.stringify(out, 0))
    ]);
  }));
}

module.exports = async function(rootDir) {
  process.chdir(rootDir);

  // Cleanup output folder.
  await cleanupOutput();

  // Write enums.
  const writeEnumsPromise = writeEnums();

  process.chdir(rootDir + '/' + OUTPUT);

  // Get endpoints.
  // Get regions.
  const endpoints = await getEndpoints();

  // Write missing dto names.
  // Must finish running before calling writeOutput.
  let missingDtoNames = await fixMissingDtos(endpoints);
  missingDtoNames.sort();

  // Write output spec files.
  await Promise.all([
    writeEnumsPromise,
    writeOutput(endpoints),
    fs.writeFile("missing.json", JSON.stringify(missingDtoNames, null, 2))
  ]);
};
