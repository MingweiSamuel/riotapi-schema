const fs = require('fs/promises');

async function main() {
    const files = await fs.readdir(__dirname);
    const fileDatas = await Promise.all(files.filter(f => f.endsWith('.json')).map(f => fs.readFile(`${__dirname}/${f}`)));

    const challenges = fileDatas
        .map(fileData => JSON.parse(fileData))
        .flatMap(fileData => fileData.info.participants)
        .map(participant => participant.challenges);
    const allChallengesKeys = Object.keys(Object.assign({}, ...challenges));
    allChallengesKeys.sort((a, b) => a.localeCompare(b));

    console.log(allChallengesKeys.length);
    console.log(JSON.stringify(allChallengesKeys));

    const format = {
        "type": "number",
        "format": "double",
        "x-type": "double",
    };
    const challengesSpec = {
        type: "object",
        title: "ParticipantChallenges",
        properties: Object.fromEntries(allChallengesKeys.map(key => [ key, format ])),
    }
    console.log(JSON.stringify(challengesSpec, null, 2));
}
main().catch(console.error);
