module.exports = {
    content: "Hello from Clash Bot :robot:! You have requested to receive notifications on upcoming " +
        "League of Legends Clash Tournaments. Here are some details to get you started :grin:. " +
        "Ping you friends and lets get this party started! (If you would like to be removed from " +
        "this list, please go to any server that has clash bot and use the unsubscribe command found below :sob:).",
    embeds: [
    {
        title: ":trophy: Upcoming Tournaments",
        description: "Here are the upcoming Tournaments.",
        color: 1880,
        fields: [
            {
                name: "%TournamentName% Day %DayOne%",
                value: "Starts @ %DayOneStartTime%"
            },
            {
                name: "%TournamentName% Day %DayTwo%",
                value: "Starts @ %DayTwoStartTime%"
            }
        ]
    },
    {
        title: ":people_wrestling: Current Teams",
        description: "Here are the Teams current signed up for the Tournaments above.",
        color: 16737792,
        fields: []
    },
    {
        title: ":desktop:  Commands",
        description: "Here are a few quick commands to get you started.",
        color: 10395294,
        fields: [
            {
                name: "Register to an existing Team",
                value: "!clash join %TournamentName% %FirstTeamName%"
            },
            {
                name: "Register to first available Team",
                value: "!clash register %TournamentName%"
            },
            {
                name: "Create a new Team",
                value: "!clash register %TournamentName% newTeam"
            },
            {
                name: "Want to see an updated list during the week",
                value: "!clash teams"
            },
            {
                name: "To unsubscribe to these notifications",
                value: "!clash unsubscribe"
            }
        ]
    }
]
}
