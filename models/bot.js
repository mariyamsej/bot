const {sendMessage, sendDirectReply, sendDirectReplyUpdate, forwardMessageWithText, forwardMessage} = require("./telegram");
const {getChatCompletion} = require("./openai");

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/chat_convo.db');
const chatAdmin = process.env.CHAT_ID;

exports.handleBotRequest = async function (req) {
    const {message} = req.body;
    const chatId = message.chat.id;
    const text = message.text;

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

    if (lastMsgDate == null) {
        if (text === '/start') {
            resp = 'Привет, ' + message.from.first_name + ' 👋! Я чат-бот приложения H2K 🤖. Постараюсь решить ваши вопросы 🤓 ';
            sendMessage(chatId, resp + '\nПрошу отправлять вопрос единым сообщением и формулировать наиболее емко. (Подождите 5 секунд прежде чем отправлить следующее сообщение, иначе оно не будет учитываться)');
            console.log("Answer: Привет!");
            db.serialize(function() {
                db.run('INSERT INTO convos (question, answer, chat_id, q_date) VALUES (?, ?, ?, ?)',
                    [
                        req.body.message.text,
                        resp,
                        chatId,
                        req.body.message.date
                    ]);
            })
        } else if (text === '/clear') {
            db.run('INSERT INTO deleted (chat_id, question, answer, q_date) SELECT chat_id, question, answer, q_date FROM convos WHERE chat_id = ?', [chatId]);
            db.run('DELETE FROM convos WHERE chat_id = ?', [chatId]);
            sendMessage(chatId, 'История запросов была очищена.');
            console.log("Clear Command");
        }
    } else {
        console.log("Time from previous message : ", req.body.message.date - lastMsgDate);
        if (text === '/start') {
            resp = 'Привет, ' + message.from.first_name + ' 👋! Я чат-бот приложения H2K 🤖. Постараюсь решить ваши вопросы 🤓 ';
            sendMessage(chatId, resp + '\nПрошу отправлять вопрос единым сообщением и формулировать наиболее емко. (Подождите 5 секунд прежде чем отправлить следующее сообщение, иначе оно не будет учитываться)');
            console.log("Answer: Привет!");
        }
        else if (text === '/clear') {
            db.run('INSERT INTO deleted (chat_id, question, answer, q_date) SELECT chat_id, question, answer, q_date FROM convos WHERE chat_id = ?', [chatId]);
            db.run('DELETE FROM convos WHERE chat_id = ?', [chatId]);
            sendMessage(chatId, 'История запросов была очищена.');
            console.log("Clear Command");
        }
        else if (text === '/balance') {
            let convos = await new Promise((resolve, reject) => {
                db.all('SELECT propmts_token, complitions_token FROM convos WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [chatId], function(err, rows) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows[0]);
                    }
                });
            });
            if (convos == null || convos.propmts_token == 0) {
                sendMessage(chatId, `Вы еще не делали запросы.`);
            }
            else {
                sendMessage(chatId, `Баланс: ${convos.propmts_token + convos.complitions_token - 2775}/1320`);
            }
            console.log("Balance Command");
        }
        else if ((req.body.message.date - lastMsgDate) >= 5 && text.length < 2 && text.toUpperCase() != "I" && text.toUpperCase() != "Я") {
            console.log("Spam Message");
            sendDirectReply(chatId, "Это сообщение не содержит в себе достаточно информации", message.message_id)
        }
        else if (isLink(req.body.message.text)) {
            sendDirectReply(chatId, "Я не могу обрабатывать ссылки.");
            console.log("Link message");
        }
        else if ((req.body.message.date - lastMsgDate) >= 5) {
            let ms_id = await sendDirectReply(chatId, "Запрос обрабатывается...", message.message_id);
            //console.log('ms_id', ms_id)
            try {
                resp = await getChatCompletion(text, chatId);
                if (resp[0] == 429) {
                    sendDirectReplyUpdate(chatId, "ChatGPT не может обработать ваш вопрос из-за большой нагрузки, попробуйте позже.", ms_id);
                    console.log("Answer: Too Many Requests");
                    return new Error("Too Many Requests in ChatGPT");
                }
                else if (resp[0] == 400) {
                    sendDirectReplyUpdate(chatId, "Вы достигли лимита. Запустите команду /clear", ms_id);
                    console.log("Answer: Bad Request");
                    return new Error("Bad Request in ChatGPT");
                }
                await sendDirectReplyUpdate(chatId, resp.choices[0].message.content, ms_id);
                console.log("Answer: " + resp.choices[0].message.content);
                
                await forwardMessageWithText(chatAdmin, req.body.message.text, additionalText);
                await forwardMessage(chatAdmin, chatId, ms_id);
            }
            catch (error) {
                return error
            }

            db.serialize(function() {
                db.run('INSERT INTO convos (question, answer, chat_id, q_date, propmts_token, complitions_token, price) \
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
        else if ((req.body.message.date - lastMsgDate) < 5) {
            console.log("Spam Message");
            sendDirectReply(chatId, "От предыдущего вопроса не прошло и 5 секунд", message.message_id)
        }
    }
    console.log("---- ");
    db.serialize(function() {
        db.run('UPDATE chats SET last_msg_date = ? WHERE chat_id = ?',
            [ req.body.message.date,  chatId]);
    })

    isPrompts(chatId,  req.body.message.date)
}

function isLink(text) {
    // regex for http&https
    const regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;
  
    return regex.test(text);
  }

  //limit for prompt
  function isPrompts(chatId, prompts_token) { 
    if (prompts_token > 3500) { 
        console.log('Prompt more than 3500'); 
        sendMessage(chatId, 'Превышен лимит токенов. История запросов была очищена.'); 
        db.run('INSERT INTO deleted (chat_id, question, answer, q_date) SELECT chat_id, question, answer, q_date FROM convos WHERE id < (SELECT MAX(id) FROM convos) AND chat_id = ?', [chatId]); 
        db.run('DELETE FROM convos WHERE id < (SELECT MAX(id) FROM convos) AND chat_id = ?', [chatId]); 
        console.log("Clear Command"); 
      }  
}
