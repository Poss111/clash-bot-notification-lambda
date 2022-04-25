
function createMockClashTeams(expectedServerName, expectedTeamName, tournamentName, tournamentDayOne) {
    return {
        Items: [
            {
                key: {
                    S: '1#2#3#4'
                },
                serverName: {
                    S: expectedServerName
                },
                teamName: {
                    S: expectedTeamName
                },
                tournamentName: {
                    S: tournamentName
                },
                tournamentDay: {
                    S: tournamentDayOne
                },
                players: {
                    SS: ['1', '2']
                },
                playersWRoles: {
                    M: {
                        "Top": {S: 1},
                        "Mid": {S: 2}
                    }
                },
            }
        ]
    };
}

function createMockTournaments(tournamentName, tournamentDayOne, tomorrow, tournamentDayTwo, afterTomorrow) {
    let mockTournamentWeekend = [];

    if (tournamentName) {
        mockTournamentWeekend.push({
            tournamentName: {S: tournamentName},
            tournamentDay: {S: tournamentDayOne},
            startTime: {S: tomorrow.format()}
        });
        mockTournamentWeekend.push({
            tournamentName: {S: tournamentName},
            tournamentDay: {S: tournamentDayTwo},
            startTime: {S: afterTomorrow.format()}
        })
    }
    return {Items: mockTournamentWeekend}
}

function createMockSubscribedUserObj(expectedMockUserId, expectedServerName, expectedMockUsername) {
    return {
        key: {
            S: expectedMockUserId
        },
        playerName: {
            S: expectedMockUsername
        },
        serverName: {
            S: expectedServerName
        },
        preferredChampions: {
            SS: ['Akali']
        },
        subscribed: {
            S: 'true'
        }
    };
}

function createMockSubscribedUsers(expectedMockUserId, expectedServerName) {
    let mockUsers = [];

    if (expectedMockUserId) {
        mockUsers.push(createMockSubscribedUserObj(expectedMockUserId, expectedServerName));
    }
    return {
        Items: mockUsers
    };
}
