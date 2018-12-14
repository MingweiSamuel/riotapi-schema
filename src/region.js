/// Representation of a Riot Games API region.
/// https://developer.riotgames.com/regional-endpoints.html

function Region(tr) {
  let [ region, platforms, host ] = Array.from(tr.children)
    .map(td => td.textContent.trim());
  this.region = region;
  this.platforms = platforms.split(/,\s+/g);
  this.hostPlatform = host.split('.', 1)[0];
}

module.exports = Region;
