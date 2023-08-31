# [riotapi-schema](http://www.mingweisamuel.com/riotapi-schema/tool/)

OpenAPI/Swagger Schema of the Riot Games API

Automatically generated daily from the [Riot Games API Reference](https://developer.riotgames.com/api-methods/)

## Quirks/Hacks

The RG API Reference has many quirks and often has small errors or missing
DTO specs. This project contains many hacks to deal with them which are worth
knowing if you plan to use the generated schemas.

Missing DTOs for the latest version are stored in [this JSON file](http://www.mingweisamuel.com/riotapi-schema/missing.json).

#### Manual Overrides

If the portal documentation is wrong, DTOs can be manually overridden (see `src/data/schemaOverrides.json`).

#### "DTO borrowing"

If a DTO is missing from one endpoint, it may be possible to find it in another
endpoint. Which endpoints can "borrow" from which other endpoints are listed in
`src/data/endpointSharedDtos.json`. The file is updated as needed.

#### `x-platforms-available`

`x-platforms-available` is listed per path specifying which platforms are
available. This only differs for the `tournament-v4` and `tournament-stub-v4`
endpoints. Overrides are in `src/data/endpointPlatformsAvailableOverrides.json`.

#### `tournament` Endpoints (`tournament-stub-v4` and `tournament-v4`)

These endpoints share all the same DTOs. However, they each have a copy of each
DTO, so there is duplicate data. This also means if you are generating classes
from these endpoints, there will be duplicate issues.

*TODO* ~~Because these endpoints are closely connected, both of their DTOs
are included under `tournament-v4`. This way there aren't duplicate copies of
tournament DTOs. This behavior is specified by `src/data/mockEndpoints.json`.~~

### Old Quirks

Quirks that may no longer be relevant.

#### `league-v3`'s `LeagueItemDTO` and `LeaguePositionDTO`

This spec combines `LeagueItemDTO` and `LeaguePositionDTO` under the later name.
This was a questionable choice because it results in fields with `null` values
that users might expect to be filled in (when parsing a `LeagueItemDTO`).
This behavior is removed for `league-v4`.

#### `static-data`'s DTO type overrides.

Static data had some DTO fields that could
be multiple different types as specified in their description. These were
overridden using the dict in `src/data/dtoDescriptionTypeOverrides.json`
Because the static data endpoints are removed, this is no longer an issue.
