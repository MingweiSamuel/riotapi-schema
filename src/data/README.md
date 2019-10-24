# `dtoAliases.json`
Rename/combine DTOs:
```json
{
  "league-v3": {
    "LeagueItemDTO": "LeaguePositionDTO"
  }
}
```

# `dtoDescriptionTypeOverrides.json`
Override a DTO's field's type based on its description:
```json
{
  "This field is a List of List of Double.": {
    "type": "array",
    "items": {
      "type": "array",
      "items": {
        "type": "number",
        "format": "double"
      }
    }
  }
}
```

# `endpointPlatforms.json`:
Per-endpoint region overrides.
```json
{
    "tournament-stub-v4": ["americas"],
    "tournament-v4": ["americas"]
}
```

# `endpointSharedDtos.json`
"DTO borrowing"

If a DTO is missing from one endpoint, it may be possible to find it in another
endpoint. Which endpoints can "borrow" from which other endpoints are listed in
`src/data/endpointSharedDtos.json`. The file is updated as needed.

# `regions.json`
Temp https://github.com/RiotGames/developer-relations/issues/171

# `schemaOverrides.json`
Fully override a DTO's schema.


