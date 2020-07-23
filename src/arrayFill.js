/// Array polyfills.

Array.prototype.flat = function() {
  return [].concat(...this);
};

Array.prototype.flatMap = function() {
  return this.map(...arguments).flat();
};
