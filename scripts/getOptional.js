// node scripts/getOptional.js src/data/schemaOverrides.json
const path = require('path');

const json = process.argv[2];
const data = require(path.resolve(json));

const optional = {};
for (const [ name, spec ] of Object.entries(data)) {
    const requiredProps = new Set(spec.required || []);
    const propNames = Object.keys(spec.properties || {});
    const optionalProps = new Set(
        propNames.filter(propName => !requiredProps.has(propName)));

    // Invert if 33% or less are required.
    const invert = 2 * requiredProps.size < optionalProps.size;
    if (invert) {
        optional[`${name}.*`] = true;
    }
    for (const propName of invert ? requiredProps : optionalProps) {
        optional[`${name}.${propName}`] = !invert;
    }
}
console.log(JSON.stringify(optional, null, 2));
