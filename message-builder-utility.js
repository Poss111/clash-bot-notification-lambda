const notificationTemplate = require('./templates/notification-template');

const buildEmbeddedMessage = (tournamentName, tournamentDayOne, tournamentDayTwo, tournamentStartTimeOne, tournamentStartTimeTwo, teams) => {
    let firstTeamName;
    if (!Array.isArray(teams) || teams.length === 0) {
        firstTeamName = 'Placeholders'
        teams = [{name: 'No Teams Available', value: 'Please appease the Clash Bot and start one :pleading_face:'}]
    } else {
        firstTeamName = teams[0].name;
        teams.splice(0, 0, {name: "(Sample) Server Name - Team Name", value: "Team's players"});
    }
    notificationTemplate.embeds[1].fields = teams;
    let string = JSON.stringify(notificationTemplate);
    string = string.replace(/%TournamentName%/g, tournamentName);
    string = string.replace(/%DayOne%/g, tournamentDayOne);
    string = string.replace(/%DayOneStartTime%/g, tournamentStartTimeOne);
    string = string.replace(/%DayTwo%/g, tournamentDayTwo);
    string = string.replace(/%DayTwoStartTime%/g, tournamentStartTimeTwo);
    return string.replace(/%FirstTeamName%/g, 'Abra');
}

exports.buildEmbeddedMessage = buildEmbeddedMessage;