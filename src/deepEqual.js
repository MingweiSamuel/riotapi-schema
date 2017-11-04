/**
 * Deep equals, ignoring underscore-prefixed keys.
 * Only handles primitives, arrays, and objects.
 */
function deepEqual(a, b) {
  if (Object.is(a, b))
    return true;
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

module.exports = deepEqual;
