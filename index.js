// Load the AWS SDK for Node.js
const Discord = require('discord.js');
const AWS = require('aws-sdk');
const messageBuilder = require('./message-builder-utility');
let bot;
let TOKEN = process.env.TOKEN;

if (process.env.LOCAL) {
    AWS.config.loadFromPath('./credentials.json');
}

const dynamo = new AWS.DynamoDB();

const parseToUser = (dynamoItem) => {
    return { id: dynamoItem.key.S, serverName: dynamoItem.serverName.S };
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
        tournamentName: dynamoItem.tournamentName.S,
        tournamentDay: dynamoItem.tournamentDay.S,
        serverName: dynamoItem.serverName.S,
    }
}

const parser = (err, data, parser, resolve, reject) => {
    console.debug(JSON.stringify(data));
    if (data.Items) {
        let parsedData = [];
        data.Items.forEach(dynamoItem => {
            parsedData.push(parser(dynamoItem));
        })
        resolve(parsedData);
    } else {
        reject('No data found.');
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
            parser(err, data, parseToUser, resolve, reject)
        });
    });
}

async function retrieveClashTournamentsTimes() {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: 'clashtimes'
        }
        dynamo.scan(params, (err, data) => parser(err, data, parseToTournamentTimes, resolve, reject));
    });
}

async function retrieveClashTeams() {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: 'clashteams'
        }
        dynamo.scan(params, (err, data) => parser(err, data, parseToTeams, resolve, reject));
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
                        user.send(embeddedMessage.content)
                            .then(user.send({embed: embeddedMessage.embeds[0]})
                                .then(() => user.send({embed: embeddedMessage.embeds[1]})
                                    .then(() => user.send({embed: embeddedMessage.embeds[2]})
                                        .then(() => resolve({userId: user.id, status: 'SUCCESSFUL'})))))
                    } catch (err) {
                        reject({userId: user.id, status: 'FAILED', reason: err})
                    }
                } else {
                    console.log(`Sending embedded message to ('${user}')...`);
                    console.log(`Message => ${JSON.stringify(embeddedMessage)}`);
                }
            }
        }
    );
}

async function sendMessages(users, tournaments, teams) {
    return new Promise((resolve, reject) => {
        console.log('Logging into bot...');
        bot.login(TOKEN).then(() => {

            bot.on('ready', () => {
                console.info(`Logged in as ${bot.user.tag}!`);
                let promises = [];
                if (Array.isArray(users)) {
                    for (const user of users) {
                        console.log(`Sending message to ${user}...`);
                        promises.push(sendUserMessage(new Discord.User(bot, {id: user.id}),
                            tournaments,
                            teams.filter(team => team.name.startsWith(user.serverName))));
                    }
                    Promise.allSettled(promises).then(promiseResults => {
                        let successfulValues = [];
                        for (const result of promiseResults) {
                            if (result.status === 'rejected') {
                                console.error(`Failed to send Message : ${JSON.stringify(result.value)}`);
                            } else {
                                successfulValues.push(result.value);
                                console.log(`Successfully sent Message : ${JSON.stringify(result.value)}`);
                            }
                        }
                        resolve(successfulValues);
                    }).finally(() => {
                        console.log('Closing bot...');
                        bot.destroy();
                        console.log('Successfully closed bot.');
                    }).catch(err => reject(err));
                }
            });
        }).catch(err => {
            console.error(`Failed to send to Users because of => ${err}`);
            reject(err);
        });
    });
}

async function timeout(time) {
    return new Promise((resolve, reject) => {
        let id = setTimeout(() => {
            clearTimeout(id);
            reject(`Failed to execute promise after ('${time} ms')`)
        }, time);
    });
}

exports.handler = async () => {
    let users = await retrieveUsers();
    let tournaments = await retrieveClashTournamentsTimes();
    let teams = await retrieveClashTeams();
    console.log(tournaments);
    let currentDate = new Date();
    let endOfTheWeekend = new Date();
    endOfTheWeekend.setDate(currentDate.getDate() + 7);
    console.log(`Start Date : ('${currentDate})`);
    console.log(`End Date : ('${endOfTheWeekend})`);
    tournaments = tournaments.filter(tournament => new Date(tournament.startTime) > currentDate && new Date(tournament.startTime) < endOfTheWeekend);
    console.log(`Upcoming Tournaments => JSON.stringify(tournaments)`);
    if (tournaments.length === 0) {
        console.log("No upcoming tournaments this weekend. Terminating job gracefully.");
    } else {
        let tournamentNames = tournaments.map(record => record.tournamentName);
        let tournamentDays = tournaments.map(record => record.tournamentDay);
        teams = teams.filter(team => tournamentNames.includes(team.tournamentName) && tournamentDays.includes(team.tournamentDay) && Array.isArray(team.players));
        teams = teams.map(team => {
            return { name: `${team.serverName} - ${team.teamName}`, value: team.players}
        });
        bot = new Discord.Client();
        if (!process.env.LOCAL) {
            TOKEN = await secretPromise();
        }
        await Promise.race(
            [
                sendMessages(users, tournaments, teams),
                timeout(20000)
            ]).catch(err => {
            console.error(err);
            throw new Error(err);
        });
    }
    return {
        startTimeRestraint: currentDate,
        endTimeRestraint: endOfTheWeekend,
        tournaments: tournaments,
        subscribedUsers: users,
        teams: teams,
        status: 'Done'
    };
}

if (process.env.LOCAL) {
    console.log(`Local configuration on.`);
    this.handler().then(results => console.log(results)).catch(err => console.error(err));
}
