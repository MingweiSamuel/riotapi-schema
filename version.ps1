$HASHES = (git --no-pager log --pretty=format:%H) -Split '`n'

$HASH_FOR_VER = @{}

ForEach ($HASH in $HASHES) {
    $VER = ((git show "$($HASH):openapi-3.0.0.min.json") | ConvertFrom-Json).info.version
    If ($VER) {
        $HASH_FOR_VER[$VER] = $HASH
    }
}
Write-Output $HASH_FOR_VER
