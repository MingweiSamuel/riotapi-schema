/// Array polyfills.

Array.prototype.flat = function() {
  return [].concat.apply([], this);
}

Array.prototype.flatMap = function() {
  return this.map(...arguments).flat();
}

Array.prototype.unique = function() {
  return Array.from(new Set(this));
}