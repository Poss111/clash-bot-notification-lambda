// Load the AWS SDK for Node.js
const Discord = require('discord.js');
const AWS = require('aws-sdk');
const bot = new Discord.Client();
let TOKEN = process.env.TOKEN;

if (process.env.LOCAL) {
    AWS.config.loadFromPath('./credentials.json');
}

function parseToUser(dynamoItem) {
    return dynamoItem.userId.S;
}

async function retrieveUsers() {
    const dynamo = new AWS.DynamoDB();
    return new Promise((resolve, reject) => {
        let params = {
            TableName: 'clash-registered-users'
        }
        dynamo.scan(params, (err, data) => {
            console.debug(JSON.stringify(data));
            if (data.Items) {
                let discordUsers = [];
                data.Items.forEach(dynamoItem => {
                    discordUsers.push(parseToUser(dynamoItem));
                })
                resolve(discordUsers);
            } else {
                reject('No Users found.');
            }
        });
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

async function sendUserMessage(user) {
    return new Promise((resolve, reject) => {
            if (user) {
                user.send("Hello! Here is your reminder of an upcoming Clash Tournament " +
                    "this weekend. Get out there and join your friends and sign up using either " +
                    "!clash register (For any available team) or !clash join " +
                    "(If you have a specific friend group you would like to join).")
                    .then(() => resolve({userId: user.id, status: 'SUCCESSFUL'}))
                    .catch(err => reject({userId: user.id, status: 'FAILED', reason: err}));
            }
        }
    );
}

async function sendMessages(users) {
    return new Promise((resolve, reject) => {
        console.log('Logging into bot...');
        bot.login(TOKEN).then(() => {

            bot.on('ready', () => {
                console.info(`Logged in as ${bot.user.tag}!`);
                let promises = [];
                if (Array.isArray(users)) {
                    for (const user of users) {
                        console.log(`Sending message to ${user}...`);
                        promises.push(sendUserMessage(new Discord.User(bot, {id: user})));
                    }
                    Promise.allSettled(promises).then(promiseResults => {
                        let rejectedValues = [];
                        let successfulValues = [];
                        for (const result of promiseResults) {
                            if (result.status === 'rejected') {
                                rejectedValues.push(result.value.userId);
                                console.error(`Failed to send Message : ${JSON.stringify(result.value)}`);
                            } else {
                                successfulValues.push(result.value);
                                console.log(`Successfully sent Message : ${JSON.stringify(result.value)}`);
                            }
                        }
                        if (rejectedValues.length > 0) {
                            reject(rejectedValues);
                        }
                        resolve(successfulValues);
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
    if (!process.env.LOCAL) {
        TOKEN = await secretPromise();
    }
    await Promise.race(
        [
            sendMessages(users),
            timeout(20000)
        ]).catch(err => {
        console.error(err);
        throw new Error(err);
    }).finally(() => {
        console.log('Closing bot...');
        bot.destroy();
        console.log('Successfully closed bot.');
    });
    return {status: 'Done'};
}

if (process.env.LOCAL) {
    console.log(this.handler());
}
