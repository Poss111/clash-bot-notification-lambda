const index = require('../index');
const {retrieveAllUserInformation} = require('../index');
const Discord = require('discord.js');
const AWS = require('aws-sdk');
const moment = require('moment-timezone')

jest.mock('discord.js');
jest.mock('aws-sdk');

function setupAWSMocks(mockSubscribedUsers, mockTournaments, mockClashTeams, mockRetrievedUserDetails) {
    AWS.DynamoDB.mockReturnValue({
        scan: jest.fn().mockImplementation((params, callback) => {
            switch (params.TableName) {
                case 'clash-registered-users':
                    callback(undefined, mockSubscribedUsers);
                    break;
                case 'clashtimes':
                    callback(undefined, mockTournaments);
                    break;
                case 'clashteams':
                    callback(undefined, mockClashTeams);
                    break;
                default:
                    callback(new Error('No Table found'));
            }
        }),
        batchGetItem: jest.fn()
            .mockImplementation((params, callback) => callback(undefined, mockRetrievedUserDetails))
    });
    AWS.SecretsManager.mockReturnValue({
        getSecretValue: jest.fn().mockImplementation((params, callback) =>
            callback(undefined, {SecretString: JSON.stringify({TOKEN: '123456778512312312312'})}))
    });
}

function setupMockDiscordBotEvents(mockDiscordOn) {
    Discord.Client.mockReturnValue({
        login: jest.fn().mockResolvedValue(undefined),
        on: mockDiscordOn,
        user: {
            tag: 'Mock Bot'
        },
        destroy: jest.fn()
    });
}

function setupMockDiscordUser(mockSendMethod, expectedMockUserId) {
    Discord.User.mockReturnValue({
        createDM: jest.fn().mockResolvedValue(mockSendMethod),
        id: expectedMockUserId
    });
}

beforeEach(() => {
    jest.resetAllMocks();
})

describe('Clash Bot Notification Lambda', () => {

    describe('Handler', () => {
        test('When there are subscribed users, it should send a message to each of them through Discord.', async () => {
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
            setupAWSMocks(mockSubscribedUsers, mockTournaments, mockClashTeams, mockRetrievedUserDetails);
            let actualEvents = new Map();
            const mockDiscordOn = jest.fn().mockImplementation((state, callback) => {
                actualEvents.set(state, callback);
                callback();
            });
            setupMockDiscordBotEvents(mockDiscordOn);
            const mockSendMethod = {
                send: jest.fn().mockResolvedValue(undefined)
            };
            setupMockDiscordUser(mockSendMethod, expectedMockUserId);
            const results = await index.handler();
            expect(mockDiscordOn).toBeCalledTimes(1);
            expect(actualEvents.size).toEqual(1);
            expect(mockSendMethod.send).toBeCalledTimes(1);
            expect(results.sentMessages).toHaveLength(1);
            expect(results.sentMessages[0].userId).toEqual(expectedMockUserId);
            expect(results.sentMessages[0].status).toEqual('SUCCESSFUL');
            expect(results.subscribedUsers).toHaveLength(1);
            expect(results.tournaments).toHaveLength(2);
            expect(results.teams).toHaveLength(1);
            expect(new moment(results.startTimeRestraint).isSame(currentDate, 'day')).toBeTruthy();
            expect(new moment(results.endTimeRestraint).isSame(endOfTheWeek, 'day')).toBeTruthy();
        })

        test('When there are subscribed users and no Tournaments, then no message should be sent.', async () => {
            const currentDate = new moment();
            let endOfTheWeek = new moment(currentDate).add(7, 'day');
            const tournamentName = 'bandle_city';
            const tournamentDayOne = '1';
            const expectedTeamName = 'Team Abra';
            const expectedServerName = 'Goon Squad';
            const expectedMockUserId = '12345678910';
            const mockSubscribedUsers = createMockSubscribedUsers(expectedMockUserId, expectedServerName);
            const mockTournaments = createMockTournaments();
            const mockRetrievedUserDetails = {
                Responses: {
                    "clash-registered-users": [
                        createMockSubscribedUserObj('1', expectedServerName),
                        createMockSubscribedUserObj('2', expectedServerName)
                    ]
                }
            };
            const mockClashTeams = createMockClashTeams(expectedServerName, expectedTeamName, tournamentName, tournamentDayOne);
            setupAWSMocks(mockSubscribedUsers, mockTournaments, mockClashTeams, mockRetrievedUserDetails);
            let actualEvents = new Map();
            const mockDiscordOn = jest.fn().mockImplementation((state, callback) => {
                actualEvents.set(state, callback);
                callback();
            });
            setupMockDiscordBotEvents(mockDiscordOn);
            const mockSendMethod = jest.fn().mockResolvedValue(undefined);
            setupMockDiscordUser(mockSendMethod, expectedMockUserId);
            const results = await index.handler();
            expect(mockDiscordOn).toBeCalledTimes(0);
            expect(mockSendMethod).toBeCalledTimes(0);
            expect(results.sentMessages).toHaveLength(0);
            expect(results.subscribedUsers).toHaveLength(1);
            expect(results.tournaments).toHaveLength(0);
            expect(results.teams).toHaveLength(1);
            expect(new moment(results.startTimeRestraint).isSame(currentDate, 'day')).toBeTruthy();
            expect(new moment(results.endTimeRestraint).isSame(endOfTheWeek, 'day')).toBeTruthy();
        })
    })

    describe('Retrieve Player Details Map', () => {
        test('When a populated array of Player Ids are passed to retrieve the player details map, an object of player ids to details should be returned.', async () => {
            const passedUserIds = ['1', '2', '3'];
            const server = 'Testing';
            const userDetailsOne = createMockSubscribedUserObj(passedUserIds[0], server, 'PlayerOne');
            const userDetailsTwo = createMockSubscribedUserObj(passedUserIds[1], server, 'PlayerTwo');
            const userDetailsThree = createMockSubscribedUserObj(passedUserIds[2], server, 'PlayerThree');
            const mockRetrievedUserDetails = {
                Responses: {
                    "clash-registered-users": [
                        userDetailsOne,
                        userDetailsTwo,
                        userDetailsThree,
                    ]
                }
            };
            let mockDynamo = {
                batchGetItem: jest.fn()
                    .mockImplementation((params, callback) => callback(undefined, mockRetrievedUserDetails))
            };
            let expectedResponse = {};
            expectedResponse['1'] = {
                key: userDetailsOne.key.S,
                playerName: userDetailsOne.playerName.S,
                serverName: userDetailsOne.serverName.S
            };
            expectedResponse['2'] = {
                key: userDetailsTwo.key.S,
                playerName: userDetailsTwo.playerName.S,
                serverName: userDetailsTwo.serverName.S
            };
            expectedResponse['3'] = {
                key: userDetailsThree.key.S,
                playerName: userDetailsThree.playerName.S,
                serverName: userDetailsThree.serverName.S
            };
            const response = await retrieveAllUserInformation(passedUserIds, mockDynamo);
            expect(response).toEqual(expectedResponse);
        })

        test('When an unpopulated array of Player Ids are passed to retrieve the player details map, an empty object should be returned.', async () => {
            const passedUserIds = [];
            let mockDynamo = {
                batchGetItem: jest.fn()
            };
            let expectedResponse = {};
            const response = await retrieveAllUserInformation(passedUserIds, mockDynamo);
            expect(response).toEqual(expectedResponse);
            expect(mockDynamo.batchGetItem).not.toHaveBeenCalled();
        })

        test('When an undefined array of Player Ids are passed to retrieve the player details map, an empty object should be returned.', async () => {
            const passedUserIds = undefined;
            let mockDynamo = {
                batchGetItem: jest.fn()
            };
            let expectedResponse = {};
            const response = await retrieveAllUserInformation(passedUserIds, mockDynamo);
            expect(response).toEqual(expectedResponse);
            expect(mockDynamo.batchGetItem).not.toHaveBeenCalled();
        })
    })

    describe('Handler Error', () => {
        test('If there are no users found.', async () => {
            setupAWSMocks({});
            try {
                const results = await index.handler();
                expect(results).toBeFalsy();
            } catch (error) {
                expect(error).toBeTruthy();
            }
        })
    })
})
