// Load the AWS SDK for Node.js
const Discord = require('discord.js');
// const AWS = require('aws-sdk');
const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;

exports.handler = async (callback) => {
    bot.login(TOKEN).then(() => {

        bot.on('ready', () => {
            console.info(`Logged in as ${bot.user.tag}!`);
            new Discord.User(bot, {id: '299370234228506627'}).send('Hi');
            callback();
        });
    })
};
if (process.env.LOCAL) {
    this.handler(() => {console.log("Handled")});
}

