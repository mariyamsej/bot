const {sendMessage, sendDirectReply, sendDirectReplyUpdate, answerCallbackQuery, sendInlineMarkupMessage, editMessageText, forwardMessageWithText, forwardMessage} = require('./telegram');
const {getChatCompletion} = require('./openai');
const { calculateCommission } = require('./commission');
const {isLink, translateText, clearValue, clearArrayAfterDelay} = require('./functions');
const config = require('../config');

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/chat_convo.db');

const chatAdmin = process.env.CHAT_ID;

const IS_CALC_COMMISION = {};
const CHOSEN_CUR = {};

exports.valuesList = {};
    
currencies = ['BTC', 'ETH', 'TRX', 'USDT'];
    
exports.handleQueryCallback = async function (req) {
    const { callback_query, message } = req.body;
    const chatId = callback_query.message.chat.id;
    // const chatId = callback_query.message.from.id;
    const message_id = callback_query.message.message_id;

    answerCallbackQuery(callback_query.id); 
    
    if (!exports.valuesList[chatId]) {
        exports.valuesList[chatId] = [];
        clearArrayAfterDelay(exports.valuesList[chatId]);
    }

    // exports.valuesList[chatId].push(callback_query.data);
        
    if (callback_query.data == 'Bitcoin')
    {        
    
        console.log("----" + callback_query.from.username);
        console.log("Blockchain network: " + callback_query.data);
        answerCallbackQuery(callback_query.id);

        exports.valuesList[chatId].push('BTC');
    
        editMessageText(
            chatId,
            message_id,
            await translateText(config.chooseCrypto, callback_query.message.language_code),
            {
                inline_keyboard: [
                    [
                        { text: 'BTC', callback_data: 'BTC' },
                        { text: 'USDT', callback_data: 'USDT' },
                        { text: 'Back', callback_data: 'Back' }
                    ]
                ]
            }
        );
            
    }
    else if (callback_query.data === 'Ethereum')
    {
        console.log("----" + callback_query.from.username);
        console.log("Blockchain network: " + callback_query.data);
        answerCallbackQuery(callback_query.id);

        exports.valuesList[chatId].push('ETH');
    
        editMessageText(
            chatId,
            message_id,
            await translateText(config.chooseCrypto, callback_query.message.language_code),
            {
                inline_keyboard: [
                    [
                        { text: 'ETH', callback_data: 'ETH' },
                        { text: 'USDT', callback_data: 'USDT' },
                        { text: 'Back', callback_data: 'Back' }
                    ]
                ]
            }
        );            
        
    }
    else if (callback_query.data === 'Tron')
    {
        console.log("----" + callback_query.from.username);
        console.log("Blockchain network: " + callback_query.data);
        answerCallbackQuery(callback_query.id);

        exports.valuesList[chatId].push('TRX');
    
        editMessageText(
            chatId,
            message_id,
            await translateText(config.chooseCrypto, callback_query.message.language_code),
            {
                inline_keyboard: [
                    [
                        { text: 'TRX', callback_data: 'TRX' },
                        { text: 'USDT', callback_data: 'USDT' },
                        { text: 'Back', callback_data: 'Back' }
                    ]
                ]
            }
        );            
            
    }
    else if (callback_query.data === 'Back')
    {
        console.log("----" + callback_query.from.username);
        console.log("Blockchain network: " + callback_query.data);
        answerCallbackQuery(callback_query.id);
        exports.valuesList[chatId] = [];
    
        editMessageText(
            chatId,
            message_id,
            await translateText(config.chooseBlockchain, callback_query.message.language_code),
            {
                inline_keyboard: [
                    [
                        { text: 'Bitcoin', callback_data: 'Bitcoin' },
                        { text: 'Ethereum', callback_data: 'Ethereum' },
                        { text: 'Tron', callback_data: 'Tron' }
                    ]
                ]
            }
        );            
            
    }    
    else if (currencies.includes(callback_query.data)){

        exports.valuesList[chatId].push(callback_query.data);
        
        if (exports.valuesList[chatId].length === 1){
            sendMessage(chatId, await translateText(config.wrongFormat, callback_query.message.language_code));
        }
        else {
            // exports.valuesList[chatId].push(callback_query.data);
            sendMessage(chatId, await translateText(`Введите сумму в ${callback_query.data}`, callback_query.message.language_code));
    
        const bchainAndCurr = `${exports.valuesList[chatId][0]}-${callback_query.data}`;    
            
        IS_CALC_COMMISION[callback_query.from.username] = true;
        CHOSEN_CUR[callback_query.from.username] = bchainAndCurr;
        }
    }
    console.log(exports.valuesList);
    
    console.log("---- ");
}

exports.handleBotRequest = async function (req) {
    const {message} = req.body;
    const chatId = message.chat.id;
    const text = message.text;
    const username = message.from.username;

    const additionalText = `Это ответ на заданный пользователем "${req.body.message.from.first_name} ${req.body.message.from.last_name}" следующий вопрос:`;

    console.log("---- " + message.from.username);
    console.log("Question: " + message.text);

    db.serialize(function() {
        db.run('INSERT OR IGNORE INTO chats (user_id, chat_id, date, user_firstname, user_lastname) \
            VALUES (?, ?, ?, ?, ?)',
            [
                req.body.message.from.id,
                req.body.message.chat.id,
                Date.now(),
                req.body.message.from.first_name,
                req.body.message.from.last_name
            ]);
    })

    let resp;

    let lastMsgDate = await new Promise((resolve, reject) => {
        db.all('SELECT last_msg_date FROM chats WHERE chat_id = ?', [chatId], function(err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows[0].last_msg_date);
            }
        });
    });

    if (IS_CALC_COMMISION[username]) {
        const regex = /([\d.]+)/;
        const match = text.match(regex);
        console.log("Calculating the commission...");
        if (match) {
            const amount = parseFloat(match[1]);
            calculateCommission(chatId, amount, CHOSEN_CUR[username]);
        } else {
            sendMessage(chatId, await translateText(config.wrongFormat, message.from.language_code));
        }
        delete IS_CALC_COMMISION[username];
        delete CHOSEN_CUR[username];
        return;
    }

    if (lastMsgDate == null) {
        if (text === '/start') {
            resp = await translateText('Привет,', message.from.language_code) + ' ' + message.from.first_name + ' ' + await translateText(config.greeting, message.from.language_code);
            sendMessage(chatId, resp + '\n' + await translateText(config.warning, message.from.language_code));
            console.log("Answer: Hello!");
            db.serialize(function() {
                db.run('INSERT INTO convos (question, answer, chat_id, q_date) VALUES (?, ?, ?, ?)',
                    [
                        req.body.message.text,
                        resp,
                        chatId,
                        req.body.message.date
                    ]);
            })
        }
        else if (text === '/clear') {
            db.run('INSERT INTO deleted (chat_id, question, answer, q_date) SELECT chat_id, question, answer, q_date FROM convos WHERE chat_id = ?', [chatId]);
            db.run('DELETE FROM convos WHERE chat_id = ?', [chatId]);
            //exports.valuesList[chatId] = [];
            sendMessage(chatId, await translateText(config.clearHistory, message.from.language_code));
            
            if (exports.valuesList[chatId]) {
                exports.valuesList[chatId] = null;
            }
            
            console.log("Clear Command");
        }
        else if (text === '/calculate') {
            exports.valuesList[chatId] = [];
            sendInlineMarkupMessage(chatId, await translateText((config.chooseBlockchain), message.from.language_code),
                {
                    inline_keyboard: [
                        [
                            { text: 'Bitcoin', callback_data: 'Bitcoin' },
                            { text: 'Ethereum', callback_data: 'Ethereum' },
                            { text: 'Tron', callback_data: 'Tron' }
                        ]
                    ]
                })
            console.log("Calculate Command");
        }
    } 
    
    
    else if ((req.body.message.date - lastMsgDate) < 7) {
        console.log((req.body.message.date));
        console.log((lastMsgDate));
        sendDirectReply(chatId, await translateText(config.timeSpam, message.from.language_code), message.message_id)
    }
    
    else {
        console.log("Time from previous message: ", req.body.message.date - lastMsgDate);
        if (text === '/start') {
            resp = await translateText('Привет,', message.from.language_code) + ' ' + message.from.first_name + ' ' + await translateText(config.greeting, message.from.language_code);
            sendMessage(chatId, resp + '\n' + await translateText(config.warning, message.from.language_code));
            console.log("Answer: Hello!");
        }
        else if (text === '/clear') {
            db.run('INSERT INTO deleted (chat_id, question, answer, q_date) SELECT chat_id, question, answer, q_date FROM convos WHERE chat_id = ?', [chatId]);
            db.run('DELETE FROM convos WHERE chat_id = ?', [chatId]);
            //exports.valuesList[chatId] = [];
            sendMessage(chatId, await translateText(config.clearHistory, message.from.language_code));
            
            if (exports.valuesList[chatId]) {
                exports.valuesList[chatId] = null;
            }

            console.log("Clear Command");
        }
        else if (text === '/balance') {
            let convos = await new Promise((resolve, reject) => {
                db.all('SELECT prompts_token, complitions_token FROM convos WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [chatId], function(err, rows) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows[0]);
                    }
                });
            });
            if (convos == null || convos.prompts_token == 0) {
                sendMessage(chatId, await translateText((config.noRequests), message.from.language_code));
            }
            else {
                sendMessage(chatId, await translateText(`Баланс: ${convos.prompts_token + convos.complitions_token - 2775}/1320`, message.from.language_code));
            }
            console.log("Balance Command");
        }
        else if (text === '/calculate') {
            exports.valuesList[chatId] = [];
            sendInlineMarkupMessage(chatId, await translateText((config.chooseBlockchain), message.from.language_code),
                {
                    inline_keyboard: [
                        [
                            { text: 'Bitcoin', callback_data: 'Bitcoin' },
                            { text: 'Ethereum', callback_data: 'Ethereum' },
                            { text: 'Tron', callback_data: 'Tron' }
                        ]
                    ]
                })
            console.log("Calculate Command");
        }
        else if ((req.body.message.date - lastMsgDate) >= 5 && text.length < 2) {
            console.log("Spam Message");
            sendDirectReply(chatId, await translateText(config.spamMessage, message.from.language_code), message.message_id)
        }
        else if (isLink(req.body.message.text)) {
            sendDirectReply(chatId, await translateText(config.linkReceived, message.from.language_code));
            console.log("Link message");
        }
        else if ((req.body.message.date - lastMsgDate) >= 7) {
            let ms_id = await sendDirectReply(chatId, await translateText(config.newMessage, message.from.language_code), message.message_id);
            //console.log('ms_id', ms_id)
            try {
                resp = await getChatCompletion(text, chatId);
                if (resp[0] == 429) {
                    sendDirectReplyUpdate(chatId, await translateText(config.manyRequests, message.from.language_code), ms_id);
                    console.log("Answer: Too Many Requests");
                    return new Error("Too Many Requests in ChatGPT");
                }
                else if (resp[0] == 400) {
                    sendDirectReplyUpdate(chatId, await translateText(config.tokenLimit, message.from.language_code), ms_id);
                    console.log("Answer: Bad Request");
                    return new Error("Bad Request in ChatGPT");
                }
                await sendDirectReplyUpdate(chatId, resp.choices[0].message.content, ms_id);
                console.log("Answer: " + resp.choices[0].message.content);
                
                //await forwardMessageWithText(chatAdmin, req.body.message.text, additionalText);
                //await forwardMessage(chatAdmin, chatId, ms_id);
            }
            catch (error) {
                return error
            }

            db.serialize(function() {
                db.run('INSERT INTO convos (question, answer, chat_id, q_date, prompts_token, complitions_token, price) \
            VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        req.body.message.text,
                        resp.choices[0].message.content,
                        req.body.message.chat.id,
                        req.body.message.date,
                        resp.usage.prompt_tokens,
                        resp.usage.completion_tokens,
                        ((resp.usage.total_tokens / 1000) * 0.002).toFixed(6)
                    ]);
            })
        }
        // else if ((req.body.message.date - lastMsgDate) < 5) {
        //     console.log("Spam Message");
        //     sendDirectReply(chatId, await translateText(config.timeSpam, message.from.language_code), message.message_id)
        // }
    }
    console.log("---- ");
    db.serialize(function() {
        db.run('UPDATE chats SET last_msg_date = ? WHERE chat_id = ?',
            [ req.body.message.date,  chatId]);
    })

    await clearValue(chatId);
}