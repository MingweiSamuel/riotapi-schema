# `dtoDescriptionTypeOverrides.jsonc`
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

# `dtoEnums.jsonc`
List of fields in DTOs to be marked with `x-enum` values.

# `dtoExtraFields.jsonc`
Additional fields to add to the schema. Previously `schemaOverrides.jsonc` was used for this but
that requires overriding the entire schema. This only adds the fields to the schema parsed from the
docs.

# `dtoOptional.jsonc`
Mapping of what fields are optional (includeing `*` for blanket). All fields
are required by default (optional = false).

# `endpointPlatforms.json`:
Per-endpoint region overrides.
```json
{
    "tournament-stub-v4": ["americas"],
    "tournament-v4": ["americas"]
}
```

# `endpointSharedDtos.jsonc`
"DTO borrowing"

If a DTO is missing from one endpoint, it may be possible to find it in another
endpoint. Which endpoints can "borrow" from which other endpoints are listed in
`src/data/endpointSharedDtos.jsonc`. The file is updated as needed.

# `methodDtoRenames.jsonc`
DTOs that need to be renamed due to inter-method DTO conflicts.

# `methodOptional.jsonc`
Methods that may return 404s or 204s under normal conditions.

# `methodParamEnums.jsonc`
Method parameters (URL and GET params, currently body is not considered (?))
to be annotated with `x-enum` values.

# `methodReturnOverrides.jsonc`
Override a method's return type:
```json
{
  "val-match-v1.getRecent": {
    "$ref": "#/components/schemas/val-match-v1.RecentMatchesDto",
    "x-type": "RecentMatchesDto"
  }
}
```

# `schemaOverrides.jsonc`
These are additional schemas that are included in the output. If any of these
DTOs exist from the scraping these schemas will override those.

---

# ~~`dtoAliases.json`~~
_Removed, partially replaced by `methodDtoRenames.jsonc`_.

Rename/combine DTOs:
```json
{
  "league-v3": {
    "LeagueItemDTO": "LeaguePositionDTO"
  }
}
```

# ~~`regions.json`~~
_Removed in favor of obtaining regions from union of endpoints' regions._
Temp https://github.com/RiotGames/developer-relations/issues/171


