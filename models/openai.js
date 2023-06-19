const {Configuration, OpenAIApi} = require("openai");
const chatCompletionPrompts = require('../prompts');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/chat_convo.db');
require('dotenv').config();
const openaiApiKey = process.env.OPENAI_API_KEY;
const configuration = new Configuration({
    apiKey: openaiApiKey
})
const openai = new OpenAIApi(configuration);

exports.getChatCompletion = async function (query, chat_id) {
    let send_query = '(Отвечай как ассистент поддержки приложения H2K только на вопросы по приложению, если вопрос про другое то скажи что ты не можешь ответить.) Вопрос от пользователя: ' + query;
    try {
        let propts_prev = [
            { role: 'system', content: chatCompletionPrompts},
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
            propts_prev[propts_prev.length] = { role: 'assistant', content: answer };
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
        if (error.response.status == 429) {
            return [429, error]
        } else if (error.response.status == 400) {
            return [400, error]
        }
    }
}