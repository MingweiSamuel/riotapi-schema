# [riotapi-schema](http://www.mingweisamuel.com/riotapi-schema/tool/)

OpenAPI/Swagger Schema of the Riot Games API

Automatically generated daily from the [Riot Games API Reference](https://developer.riotgames.com/api-methods/)

## Quirks/Hacks

The RG API Reference has many quirks and often has small errors or missing
DTO specs. This project conaints many hacks to deal with them which are worth
knowing if you plan to use the generated schemas.

### Current Quirks

- `tournament-stub-v4` and `tournament-v4`

*TODO* ~~Because these endpoints are closely connected, both of their DTOs
are included under `tournament-v4`. This way there aren't duplicate copies of
tournament DTOs. This behavior is specified by `src/data/mockEndpoints.json`.~~

### Previous Quirks

- `static-data`'s DTO type overrides.

Static data had some DTO fields that could
be multiple different types as specified in their description. These were
overridden using the dict in `src/data/dtoDescriptionTypeOverrides.json`
Because the static data endpoints are removed, this is no longer an issue.

- `league-v3`'s `LeagueItemDTO` and `LeaguePositionDTO`

This spec combines `LeagueItemDTO` and `LeaguePositionDTO` under the later name.
This was a quetsionable choice because it results in fields with `null` values
that users might expect to be filled in (when parsing a `LeagueItemDTO`).
This behavior is removed for `league-v4`.
