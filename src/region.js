
function Region(tr) {
  let [ region, platforms, host ] = Array.from(tr.children)
    .map(td => td.textContent.trim());
  this.region = region;
  this.platforms = platforms.split(/,\s+/g);
  this.hostPlatform = host.split('.', 1)[0];
}

module.exports = Region;
