const express = require('express');
const logger = require('morgan');
const app = express();
const port = 80;
require('dotenv').config();

app.set('port', port);
app.use(logger('dev'));

const bodyParser = require("body-parser");
const axios = require('axios');
const http = require("http");
const { handleBotRequest, handleQueryCallback } = require('./models/bot');

const my_URL = process.env.MY_URL;
const botToken = process.env.BOT_TOKEN;
//const chatAdmin = process.env.CHAT_ID;

app.post('/webhook', bodyParser.json(), async (req, res) => {
    try {
        if ('message' in req.body) {
            handleBotRequest(req);
        }
        if ('callback_query' in req.body) {
            handleQueryCallback(req)
        }
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/', function (req, res) {
    res.redirect('https://t.me/i345vbot');
})

axios.post('https://api.telegram.org/bot' + botToken +'/setWebhook',
    {
        url: my_URL + "/webhook"
    })
    .then(() => {
        console.log('Webhook set up successfully!');
    })
    .catch((error) => {
        console.error('Failed to set up webhook:', error);
    });

const server = http.createServer(app);

server.listen(port, () => {
    console.log("App listening started at port: " + port)
})
server.on('error', onError);

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}