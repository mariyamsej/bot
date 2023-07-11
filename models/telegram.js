const axios = require("axios");
require('dotenv').config();
const botToken = process.env.BOT_TOKEN;

exports.sendMessage = async function(chatId, text, replyMarkup) {
    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const response = await axios.post(sendMessageUrl, JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_markup: replyMarkup
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Sent message_id', response.data.result.message_id);
        return response.data.result.message_id;
    } catch (error) {
        console.error('Error sending message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

exports.sendDirectReply = async function (chatId, text, message_id) {
    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

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
        console.log('Replied message_id', response.data.result.message_id);
        return response.data.result.message_id;
    } catch (error) {
        console.error('Error sending reply message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

exports.answerCallbackQuery = async function (callback_query_id) {
    const api_url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;

    try {
        const response = await axios.post(api_url, JSON.stringify({
            callback_query_id: callback_query_id,
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Callback query result', response.data.result);
        return response.data.result;
    } catch (error) {
        console.error('Error answering callback query: ', text, 'Error: ', error.message);
    }
}

exports.sendInlineMarkupMessage = async function (chatId, text, replyMarkup) {
    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const response = await axios.post(sendMessageUrl, JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_markup: replyMarkup
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Sent inline message_id', response.data.result.message_id);
        return response.data.result.message_id;
    } catch (error) {
        console.error('Error sending inline message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

exports.editMessageText = async function(chatId, message_id, text, replyMarkup) {
    const editMessageUrl = 'https://api.telegram.org/bot' + botToken + '/editMessageText';

    try {
        const response = await axios.post(editMessageUrl, JSON.stringify({
            chat_id: chatId,
            message_id: message_id,
            text: text,
            reply_markup: replyMarkup
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Edited message_id', response.data.result.message_id);
        return response.data.result.message_id;
    } catch (error) {
        console.error('Error editing message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

exports.sendDirectReplyUpdate = async function (chatId, text, message_id) {
    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/editMessageText`;

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
        console.error('Error updating reply message: ', chatId, 'Text: ', text, 'Error: ', error.message);
    }
}

exports.forwardMessage =  async function (chatId, sourceChatId, message_id){
    const forwardMessageUrl = `https://api.telegram.org/bot${botToken}/forwardMessage`;
    //console.log('yo');
    try {
        const forwardResponse = await axios.post(forwardMessageUrl, JSON.stringify({
            chat_id: chatId,
            from_chat_id: sourceChatId,
            message_id: message_id
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error) {
        console.error('Error forwarding message: ', error.message);
    }
}

exports.forwardMessageWithText = async function (chatId, text, add_text){
    console.log(chatId);

    try {
    const newMessage = `${add_text} ${text}`;
    console.log('Forwarded question', newMessage);

    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(sendMessageUrl, JSON.stringify({
          chat_id: chatId,
          text: newMessage
    }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });

    } catch (error) {
          console.error('Error forwarding UPDATED message: ', error.message);
    }
}