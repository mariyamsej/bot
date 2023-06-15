const express = require('express');
const logger = require('morgan');
const app = express();
const port = 80;

app.set('port', port);
app.use(logger('dev'));

const semaphore = require('semaphore');
const concurrencyLimit = 5;
const requestSemaphore = semaphore(concurrencyLimit);

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./chat_convo.db');

const bodyParser = require("body-parser");
const axios = require('axios');

const { Configuration, OpenAIApi } = require('openai');
const http = require("http");
const openaiApiKey = "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"
const configuration = new Configuration({
    apiKey: openaiApiKey
})
const openai = new OpenAIApi(configuration);

const ngrok_URL = ' https://7fd2-2a0d-b201-1017-9d9f-8874-b442-d32f-e6c1.eu.ngrok.io';
const botToken = '5818073326:AAFj0Vf4wf7S88sq5cYiROUW8V65_ULnwm8';

const chatAdmin = 'https://t.me/+ExrWaNtPE581ZDhi';

app.post('/webhook', bodyParser.json(), async (req, res) => {
    try {
        handleRequest(req);
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/', function (req, res) {
    res.redirect('https://t.me/i345vbot');
})

async function handleRequest(req) {
    const {message} = req.body;
    const chatId = message.chat.id;
    const text = message.text;
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

    const is_link = isLink(req.body.message.text)

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
        } else if (is_link) {
            sendDirectReply(chatId, 'Я не могу обрабатывать ссылки.');
            console.log("Link");
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
            console.log("Link");
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
                await forwardMessage(chatId, resp.choices[0].message.content, ms_id, chatAdmin);
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
            sendDirectReply(chatId, "От предыдущего вопроса не прошло и 5 секунд", message.message_id);
        }
    }
    console.log("---- ");
    db.serialize(function() {
        db.run('UPDATE chats SET last_msg_date = ? WHERE chat_id = ?',
            [ req.body.message.date,  chatId]);
    })
}

async function sendMessage(chatId, text) {
    const sendMessageUrl = 'https://api.telegram.org/bot' + botToken + '/sendMessage';

    try {
        const response = await axios.post(sendMessageUrl, JSON.stringify({
            chat_id: chatId,
            text: text
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Message_id', response.data.result.message_id);
        return response.data.result.message_id;
    } catch (error) {
        console.error('Error sending message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }

    //isPrompts(chatId)
}

async function sendDirectReplyUpdate(chatId, text, message_id) {
    const sendMessageUrl = 'https://api.telegram.org/bot' + botToken + '/editMessageText';

    try {
        const response = await axios.post(sendMessageUrl, JSON.stringify({
            chat_id: chatId,
            message_id: message_id,
            text: text
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        //console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

async function sendDirectReply(chatId, text, message_id) {
    const sendMessageUrl = 'https://api.telegram.org/bot' + botToken + '/sendMessage';

    try {
        const response = await axios.post(sendMessageUrl, JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_to_message_id: message_id
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Message_id', response.data.result.message_id);
        return response.data.result.message_id;
    } catch (error) {
        console.error('Error sending message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

async function forwardMessage(chatId, text, message_id, fromChatId){
    const forwardMessageUrl = 'https://api.telegram.org/bot' + botToken + '/forwardMessage';

    try {
        const forwardResponse = await axios.post(forwardMessageUrl, JSON.stringify({
            chat_id: chatId,
            text: text,
            from_what_chat: fromChatId,
            reply_to_message_id: message_id
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Message_id', forwardResponse.data.result.message_id);
        return forwardResponse.data.result.message_id;
    } catch (error) {
        console.error('Error sending message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

async function getChatCompletion(query, chat_id) {
    let send_query = '(Отвечай как ассистент поддержки приложения H2K только на вопросы по приложению, если вопрос про другое то скажи что ты можешь ответить.) Вопрос от пользователя: ' + query;
    try {
        let propts_prev = [
            { role: 'system', content: 'Используй приведенные ниже вопросы и ответы по проекту H2K Mobile. ' +
            'Если ответ не может быть найден, напиши, что не знаешь про это, и предложи посетить официальный сайт H2K https://h2k.me/suggestions_ru или написать на почту office@h2k.me\n' +
            'Если у тебя спросили и ты не знаешь деталей уточни эти детали.\n' +
            'Если у тебя спросили почту то дай это office@h2k.me или отправь сюда https://h2k.me/suggestions_ru.\n' +
            'Если у тебя спросили кто тебя разработал скажи что это были Олжас и Мариям из компании Oris Lab.\n' +
            'Отвечай в пределах 250 символов. \n' +
            '\n' +
            'БАЗА ЗНАНИЙ H2K Mobile: ---------\n' +
            'H2K - это приложение, которое позволяет создавать кошелек с несколькими подписями.\n' +
            'Ноу-хау HIDDEN KEYS или Н2K — быстрая и безопасная технология обращения к блокчейну, выполняющая функцию мультиподписного кошелька.\n' +
            '\n' +
            'Если приложение не открывается или черный экран, вам нужно сбросить кеш приложения. Если это не помогло, проверьте, достаточно ли у вас оперативной памяти. Также попробуйте переустановить приложение по одной из ссылок на сайте.\n' +
            '\n' +
            'Можно создать кошельки в блокчейнах Bitcoin, Ethereum и Tron.\n' +
            '\n' +
            'Принимаются криптовалюты BTC, ETH, TRX, USDT.\n' +
            '\n' +
            'Есть приложение только на Android. Вы можете установить эмулятор на свой компьютер.\n' +
            '\n' +
            'Чтобы отправить деньги, нажмите на "Кошельки", выберите кошелек, с которого нужно сделать транзакцию. Нажмите на красную стрелку вывода и откроется экран создания транзакции. \n' +
            '\n' +
            'Чтобы создать кошелек, перейдите в раздел «Кошельки» и нажмите на кнопку «Создать кошелек». Далее требуется установить параметры кошелька: имя кошелька, сеть блокчейн кошелька, публичные ключи подписантов и количество обязательных подписей для подтверждения транзакции.\n' +
            '\n' +
            'Кошелек, который вы создаете в нашем приложении, является мультиподписным. Это значит, что для выполнения транзакции требуется несколько подписей кроме вашей как владельца кошелька. Подписанты – это люди, которых вы сами выбираете и которые также подписывают транзакцию. У каждого кошелька свой набор подписантов.\n' +
            '\n' +
            'Вы не можете изменить список подписантов. Если вы хотите удалить подписанта, придется создать новый кошелек без указания публичного ключа этого человека в списке подписантов.\n' +
            '\n' +
            'Кошелек нельзя удалить, так как он уже был внесен в реестр блокчейна.\n' +
            '\n' +
            'Ваши подписанты должны загрузить приложение, чтобы получить публичный ключ. После того, как ключи были выпущены, публичный ключ можно найти в разделе «Поделиться публичным ключом».\n' +
            '\n' +
            'Чтобы получить деньги на кошелек, убедитесь, что вы копируете адрес кошелька, а не адрес вашего публичного ключа аккаунта. Адрес кошелька можно увидеть перейдя «Активы» и выбрав нужный вам кошелек. Откроется экран с деталями кошелька, выберите кнопку «Получить» и скопируйте адрес из появившегося всплывающего окна.\n' +
            '\n' +
            'Если кошелек не отображается в приложении, подождите около 5-7 минут и обновите страницу приложения еще раз. Если ничего не изменилсь, значит, произошла ошибка во время создания и вам придется создать его заново.\n' +
            '\n' +
            'Пока статус вашего кошелька указан как «создается», вы не сможете увидеть кошелек в реестре блокчейна, так как наш сервер все еще обрабатывает вашу заявку. Как только вы увидите адрес кошелька вместо этой надписи в приложении, это значит, что кошелек был создан. Теперь вы можете скопировать этот адрес и ввести его в соответствующий сканер блокчейна.\n' +
            '\n' +
            'Вы не можете импортировать другие кошельки в наше приложение.\n' +
            '\n' +
            'Наш кошелек отличается от обычного мультиподписью. Мультиподпись происходит не на блокчейне, а с помощью системы вне блокчейна. В нашем случае подписью являются открытые ключи каждого подписанта.\n' +
            '\n' +
            'Если количество подтверждений подписей достигло требуемого количества, указанного при создании кошелька, транзакция будет успешно отправлена в блокчейн. Если подтверждений меньше требуемого количества, указанного при создании кошелька, транзакция не будет отправлена в блокчейн.\n' +
            '\n' +
            'Если подтверждений подписей недостаточно, то сервер не отправляет в сеть транзакцию. Следовательно, с вас не взимается комиссия. Вы увидите непереданную транзакцию в списке ваших транзакций.\n' +
            '\n' +
            'Если вы передумали отправлять, свяжитесь со своими подписантами и сообщите им, чтобы они ничего не подписывали или отклонили.\n' +
            '\n' +
            'Если средств на вашем кошельке недостаточно, транзакция не будет отправлена в сеть и будет считаться непереданной. За такую транзакцию не взимается комиссия. Также учтите размер комиссии, которая добавляется сверх суммы, которую вы переводите.\n' +
            '\n' +
            'Чтобы отправить транзакцию в сеть, необходимо, чтобы при подтверждении транзакции минимальным количеством подписантов у вас была достаточная сумма на кошельке, с учетом комиссии.\n' +
            '\n' +
            'Вы можете указать максимум 9 подписантов.\n' +
            '\n' +
            'Вы не можете узнать из заявки, кто из подписантов вам отказал или одобрил.\n' +
            '\n' +
            '"Документы для подписи" - это вкладка, которая показывает, какие документы вас просят подписать, чтобы прошла транзакция в кошельке, в котором вы указаны подписантом.\n' +
            '\n' +
            '"Подписанные документы" - это вкладка, которая показывает, какие документы вы подписали или отвергли. Вы не можете увидеть чужие документы.\n' +
            '\n' +
            'В данный момент только подписант может увидеть причину своего отказа в разделе «Подписанные» на экране «Активы».\n' +
            '\n' +
            'Если ваша транзакция не отправилась в сеть, проверьте, сколько людей ее подписало.\n' +
            '\n' +
            'Если транзакция не отобразилась через 5-10 минут, сообщите службе поддержки UNID вашей транзакции.\n' +
            '\n' +
            'Чтобы экспортировать подписантов, перейдите на экран «Подписанты», нажмите на три точки сбоку и выберите «Экспорт» в выпадающем меню. Выберите опцию экспорта, которая вам удобна.\n' +
            '\n' +
            'Вы не можете установить свою комиссию при переводе.\n' +
            '\n' +
            'Я сделал все, что вы посоветовали, и это не помогло.\n' +
            'Напишите, какую ошибку вам показывает телефон, на office@h2k.me.\n' +
            '\n' +
            'Комиссия составляет 0.09% от суммы перевода, минимум 1$, максимум 999$. В нашу комиссию входит комиссия блокчейна.\n' +
            '\n' +
            'С помощью публичного адреса вы подписываете транзакцию от своего лица. Публичный ключ кошелька – это его адрес. В нашей системе это раздельные понятия, так как наш публичный адрес создаем мы сами.\n' +
            '\n' +
            'Приложение можно использовать для создания кошельков и подписания документов.\n'+
            '-------'+
            '\n' +
            'Используй смайлики и эмодзи для каждого ответа по контексту.\n' +
            'Не повторяй заданный вопрос в ответе.' +
            'Отвечай на языке вопроса.' +
            'Ты отвечаешь в чате Telegram.'
            },
        ]
        let convos = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM convos WHERE chat_id = ?', [chat_id], function(err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        convos.forEach(function(conv) {
            const answer = conv.answer !== null ? conv.answer : " ";
            propts_prev[propts_prev.length] = { role: 'user', content: conv.question, };
            propts_prev[propts_prev.length] = { role: 'assistant', content: conv.answer };
        });

        propts_prev[propts_prev.length] = { role: 'user', content: send_query};

        const response = await openai.createChatCompletion({
            messages: propts_prev,
            model: 'gpt-3.5-turbo',
            temperature: 0.4
        });

        console.log(response.data.usage)
        return response.data;
    } catch (error) {
        console.error('Error Generating Answer', error.response.status, error.response.statusText);
        if (error.response.status == '429') {
            return [429, error]
        } else if (error.response.status == '400') {
            return [400, error]
        }
    }
}

axios.post('https://api.telegram.org/bot' + botToken +'/setWebhook', {
    url: ngrok_URL + "/webhook"
})
    .then(() => {
        console.log('Webhook set up successfully!');
    })
    .catch((error) => {
        console.error('Failed to set up webhook:', error);
    });

var server = http.createServer(app);

server.listen(port, () => {
    console.log("App listening started at port: " + port)
})
server.on('error', onError);

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
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

function isLink(text) {
    // regex for http&https
    const regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;
  
    return regex.test(text);
  }

// function isPrompts(chatId) {
//     if (propmts_token > 3500) {
//         console.log('Prompt more than 3500');
//         sendMessage(chatId, 'История запросов была очищена.');
//       } 
// }