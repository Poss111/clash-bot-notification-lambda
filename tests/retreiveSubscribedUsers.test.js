const moment = require("moment-timezone");
describe('Clash Bot Subscription Details', () => {
    describe('Handler', () => {
        test('Retrieve all subscribed Users', async () => {
            const currentDate = new moment();
            let tomorrow = new moment(currentDate).add(1, 'day');
            let afterTomorrow = new moment(tomorrow).add(1, 'day');
            let endOfTheWeek = new moment(currentDate).add(7, 'day');
            const tournamentName = 'bandle_city';
            const tournamentDayOne = '1';
            const tournamentDayTwo = '2';
            const expectedTeamName = 'Team Abra';
            const expectedServerName = 'Goon Squad';
            const expectedMockUserId = '12345678910';
            const mockSubscribedUsers = createMockSubscribedUsers(expectedMockUserId, expectedServerName);
            const mockTournaments = createMockTournaments(tournamentName, tournamentDayOne, tomorrow, tournamentDayTwo, afterTomorrow);
            const mockRetrievedUserDetails = {
                Responses: {
                    "clash-registered-users": [
                        createMockSubscribedUserObj('1', expectedServerName),
                        createMockSubscribedUserObj('2', expectedServerName)
                    ]
                }
            };
            const mockClashTeams = createMockClashTeams(expectedServerName, expectedTeamName, tournamentName, tournamentDayOne);
        });
    })
})
