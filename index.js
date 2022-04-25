// Load the AWS SDK for Node.js
const Discord = require('discord.js');
const AWS = require('aws-sdk');
const messageBuilder = require('./message-builder-utility');
let bot;
let dynamo;
let TOKEN = process.env.TOKEN;

const parseToUser = (dynamoItem) => {
    return {key: dynamoItem.key.S, playerName: dynamoItem.playerName.S, serverName: dynamoItem.serverName.S};
}

const parseToTournamentTimes = (dynamoItem) => {
    return {
        tournamentName: dynamoItem.tournamentName.S,
        tournamentDay: dynamoItem.tournamentDay.S,
        startTime: dynamoItem.startTime.S
    }
}

const parseToTeams = (dynamoItem) => {
    return {
        key: dynamoItem.key.S,
        teamName: dynamoItem.teamName.S,
        players: dynamoItem.players ? dynamoItem.players.SS : dynamoItem.players,
        playersWRoles: dynamoItem.playersWRoles ? dynamoItem.playersWRoles.M : dynamoItem.playersWRoles,
        tournamentName: dynamoItem.tournamentName.S,
        tournamentDay: dynamoItem.tournamentDay.S,
        serverName: dynamoItem.serverName.S,
    }
}

const parser = (err, data, parser, params, resolve, reject) => {
    console.debug(JSON.stringify(data));
    if (data.Items) {
        let parsedData = [];
        data.Items.forEach(dynamoItem => {
            parsedData.push(parser(dynamoItem));
        })
        resolve(parsedData);
    } else {
        let errorString = `Failed to find Items to pull Table ('${params.TableName}') data ('${JSON.stringify(data)}')`;
        console.error(errorString)
        reject(errorString);
    }
}

async function retrieveUsers() {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: 'clash-registered-users',
            IndexName: 'subscribed-users-index'
        };
        dynamo.scan(params, (err, data) => {
            if (err) reject(err);
            parser(err, data, parseToUser, params, resolve, reject)
        });
    });
}

async function retrieveClashTournamentsTimes() {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: 'clashtimes'
        }
        dynamo.scan(params, (err, data) => parser(err, data, parseToTournamentTimes, params, resolve, reject));
    });
}

async function retrieveClashTeams() {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: 'clashteams'
        }
        dynamo.scan(params, (err, data) => parser(err, data, parseToTeams, params, resolve, reject));
    });
}

async function secretPromise() {
    return new Promise((resolve, reject) => {
        console.debug('Retrieving secret...');
        const secretsManager = new AWS.SecretsManager({apiVersion: '2017-10-17'});
        secretsManager.getSecretValue({SecretId: 'ClashBot'}, (err, data) => {
            if (err) {
                reject(err);
            } else {
                console.debug('Secret retrieved.');
                try {
                    if ('SecretString' in data) {
                        resolve(JSON.parse(data.SecretString).TOKEN);
                    } else {
                        reject('RIOT_TOKEN not found in secrets manager.');
                    }
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}

async function sendUserMessage(user, tournaments, teams) {
    return new Promise((resolve, reject) => {
            if (user) {
                let embeddedMessage = messageBuilder.buildEmbeddedMessage(tournaments[0].tournamentName,
                    tournaments[0].tournamentDay,
                    tournaments[1].tournamentDay,
                    tournaments[0].startTime,
                    tournaments[1].startTime,
                    teams);
                if (!process.env.LOCAL) {
                    try {
                        user.createDM()
                            .then((channel) => {
                                channel.send({content: embeddedMessage.content, embed: embeddedMessage.embeds[0]})
                                    .then(() => channel.send({
                                        embed: embeddedMessage.embeds[1]
                                    }))
                                    .then(() => channel.send({
                                        embed: embeddedMessage.embeds[2]
                                    }))
                                    .then(() => resolve({userId: user.id, status: 'SUCCESSFUL'}))
                                    .catch((err) => reject({userId: user.key, status: 'FAILED', reason: err}));
                            }).catch((err) => reject({userId: user.key, status: 'FAILED', reason: err}));
                    } catch (err) {
                        reject({userId: user.key, status: 'FAILED', reason: err})
                    }
                } else {
                    console.log(`Sending embedded message to ('${user.key}')...`);
                    console.log(`Message => ${JSON.stringify(embeddedMessage)}`);
                }
            }
        }
    );
}

async function sendMessages(users, tournaments, teams) {
    return new Promise((resolve, reject) => {
        console.log('Logging into bot...');
        bot.on('ready', () => onBotReady(users, tournaments, teams, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        }));
        bot.login(TOKEN)
            .then(() => console.log('Successfully logged into bot.'))
            .catch(err => {
                console.error(`Failed to send to Users because of => ${err}`);
                reject(err);
            });
    });
}

async function onBotReady(users, tournaments, teams, callback) {
    console.info(`Logged in as ${bot.user.tag}!`);
    let promises = [];
    if (Array.isArray(users)) {
        for (const user of users) {
            console.log(`Sending message to ${user.key}...`);
            promises.push(sendUserMessage(new Discord.User(bot, {id: user.key}),
                tournaments,
                teams.filter(team => team.name.startsWith(user.serverName))));
        }
        let successfulValues = [];
        let failedValues = [];
        Promise.allSettled(promises).then(promiseResults => {
            for (const result of promiseResults) {
                if (result.status === 'rejected') {
                    console.error(`Failed to send Message : ${JSON.stringify(result.reason)}`);
                    failedValues.push(result.reason);
                } else {
                    successfulValues.push(result.value);
                    console.log(`Successfully sent Message : ${JSON.stringify(result.value)}`);
                }
            }
        }).finally(() => {
            console.log('Closing bot...');
            bot.destroy();
            console.log('Successfully closed bot.');
            if (failedValues.length > 0) {
                callback(failedValues);
            } else {
                callback(undefined, successfulValues);
            }
        }).catch(err => callback(err));
    }
}

function retrieveAllUniquePlayerIdsOnTeams(teams) {
    return Array.from(new Set([...teams.map(team => team.players).flat()]));
}

const retrieveAllUserInformation = (playerIds, dynamodb) => {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(playerIds) || playerIds.length <= 0) {
            resolve({});
        } else {
            const params = {
                RequestItems: {
                    "clash-registered-users": {
                        Keys: playerIds.map(playerId => {
                            return {
                                key: {
                                    S: playerId
                                }
                            }
                        })
                    }
                }
            };
            dynamodb.batchGetItem(params, (err, data) => {
                if (err) reject(err);
                else {
                    let object = {};
                    data.Responses['clash-registered-users'].forEach(item => object[item.key.S] = parseToUser(item));
                    resolve(object);
                }
            });
        }
    });
}

exports.handler = async () => {
    if (process.env.LOCAL) {
        dynamo = new AWS.DynamoDB({
            region: `us-east-1`,
            endpoint: `http://localhost:8000`,
            accessKeyId: 'Dummy',
            secretAccessKey: 'Dummy',
            httpOptions: {
                connectTimeout: 2000,
                timeout: 2000
            }
        });
    } else {

        dynamo = new AWS.DynamoDB();
    }
    let users = await retrieveUsers();
    let tournaments = await retrieveClashTournamentsTimes();
    let teams = await retrieveClashTeams();
    let currentDate = new Date();
    let endOfTheWeekend = new Date();
    endOfTheWeekend.setDate(currentDate.getDate() + 7);
    console.log(`Start Date : ('${currentDate})`);
    console.log(`End Date : ('${endOfTheWeekend})`);
    tournaments = tournaments.filter(tournament => new Date(tournament.startTime) > currentDate && new Date(tournament.startTime) < endOfTheWeekend);
    console.log(`Upcoming Tournaments => ${JSON.stringify(tournaments)}`);
    let messages = [];
    if (tournaments.length === 0) {
        console.log("No upcoming tournaments this weekend. Terminating job gracefully.");
    } else {
        let tournamentNames = tournaments.map(record => record.tournamentName);
        let tournamentDays = tournaments.map(record => record.tournamentDay);
        teams = teams.filter(team => tournamentNames.includes(team.tournamentName) && tournamentDays.includes(team.tournamentDay) && Array.isArray(team.players));
        const playerIds = retrieveAllUniquePlayerIdsOnTeams(teams);
        const playerIdMap = await retrieveAllUserInformation(playerIds, dynamo);
        teams = teams.map(team => {
            let playerList = Object.keys(team.playersWRoles)
                .map(key => `${key} - ${playerIdMap[team.playersWRoles[key].S].playerName}`).join("\n");
            return {name: `${team.serverName} - ${team.teamName}`, value: playerList}
        });
        bot = new Discord.Client({intents: [Discord.Intents.FLAGS.GUILDS]});
        if (!process.env.LOCAL) {
            TOKEN = await secretPromise();
        }
        messages = await sendMessages(users, tournaments, teams)
            .catch(err => {
                console.error(err);
                throw new Error(err);
            });
    }
    return {
        startTimeRestraint: currentDate,
        endTimeRestraint: endOfTheWeekend,
        tournaments: tournaments,
        subscribedUsers: users,
        sentMessages: messages,
        teams: teams,
        status: 'Done'
    };
}

if (process.env.LOCAL) {
    console.log(`Local configuration on.`);
    this.handler().then(results => console.log(results)).catch(err => console.error(err));
}

module.exports.handler = this.handler;
module.exports.retrieveAllUserInformation = retrieveAllUserInformation;
