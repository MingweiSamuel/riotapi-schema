/// Deep equals, ignoring "x-"-prefixed keys.
/// Only handles primitives, arrays, and basic objects.
function deepEqual(a, b) {
  if (Object.is(a, b))
    return true;
  if (typeof a === 'string' || typeof a === 'number')
    return a === b;
  if (a instanceof Array) {
    if (!(b instanceof Array))
      return false;
    if (a.length !== b.length)
      return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i]))
        return false;
    }
    return true;
  }
  if (typeof a === 'object') {
    if (typeof b !== 'object')
      return false;
    let aKeys = Object.keys(a).filter(x => !x.startsWith('x-')).sort();
    let bKeys = Object.keys(b).filter(x => !x.startsWith('x-')).sort();
    if (!deepEqual(aKeys, bKeys))
      return false;
    for (let key of aKeys) {
      if (!deepEqual(a[key], b[key]))
        return false;
    }
    return true;
  }
  throw new Error('Unknown type: ' + (typeof a));
}

/// Subset equals.
/// Returns true if a is a subset of b.
/// i.e. an object with a subset of the keys, properties are subset equal.
function subsetEqual(a, b) {
  if (Object.is(a, b))
    return true;
  if (typeof a === 'string' || typeof a === 'number')
    return a === b;
  if (a instanceof Array) {
    if (!(b instanceof Array))
      return false;
    if (a.length > b.length)
      return false;
    for (let i = 0; i < a.length; i++) {
      if (!subsetEqual(a[i], b[i]))
        return false;
    }
    return true;
  }
  if (typeof a === 'object') {
    if (typeof b !== 'object')
      return false;
    let aKeys = Object.keys(a).filter(x => !x.startsWith('x-')).sort();
    for (let key of aKeys) {
      if (!subsetEqual(a[key], b[key]))
        return false;
    }
    return true;
  }
  if (typeof a === 'string')
    return a === b;
  throw new Error('Unknown type: ' + (typeof a) + '\na: ' + a + '\nb: ' + b);
}

module.exports = { deepEqual, subsetEqual };
