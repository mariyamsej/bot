const axios = require("axios");
require('dotenv').config();
const botToken = process.env.BOT_TOKEN;

exports.sendMessage = async function(chatId, text) {
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
}

exports.sendDirectReply = async function (chatId, text, message_id) {
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

exports.sendDirectReplyUpdate = async function (chatId, text, message_id) {
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

exports.forwardMessage =  async function (chatId, sourceChatId, message_id){
    const forwardMessageUrl = 'https://api.telegram.org/bot' + botToken + '/forwardMessage';
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
        
        if (forwardResponse.data.ok) {
            console.log('Сообщение переслано');
          } else {
            console.error('Ошибка при пересылке сообщения');
          }
        } catch (error) {
          console.error('Error: ', error.message);
        }
}

exports.forwardMessageWithText = async function (chatId, text, add_text){
    console.log(chatId);

    try {
    const newMessage = `${add_text} ${text}`;
    console.log('yo', newMessage);

    const sendMessageUrl = 'https://api.telegram.org/bot' + botToken + '/sendMessage' ;
    await axios.post(sendMessageUrl, JSON.stringify({
          chat_id: chatId,
          text: newMessage
    }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });

    if (sendMessageUrl.data.ok) {
        console.log('Обновленое сообщение переслано');
    } else {
        console.error('Ошибка при пересылке обн. сообщения');
        }
    } catch (error) {
          console.error('Error: ', error.message);
        }
}
