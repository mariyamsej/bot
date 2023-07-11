const axios = require("axios");
const translate = require('@iamtraction/google-translate');

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/chat_convo.db');

exports.isLink = function(text) {
  const regex = /^(https?:\/\/)?(www\.)?\S+\.\S+$/;
  
  return regex.test(text);
}

exports.translateText = async function(text, language){
  // console.log(`Translation to ${language}`);
  // console.log("----");

  try {
      const translated = await translate(text, { from: 'ru', to: language });
      return translated.text;
    } catch (error) {
      console.error(error);
      return null;
    }
}

exports.clearValue = async function(chatId){

  try {
    db.serialize(function() {
      db.all("SELECT prompts_token FROM convos WHERE chat_id = ? ORDER BY q_date DESC LIMIT 1", [chatId], function(err, rows) {
        if (err) {
          console.error("DB error:", err);
        }
        else {
          rows.forEach(async function(row) {
            const promptsToken = row.prompts_token;
    
            if (promptsToken > 3400) {
              console.log('Prompt more than 3400'); 
              db.run('INSERT INTO deleted (chat_id, question, answer, q_date) SELECT chat_id, question, answer, q_date FROM convos WHERE id < (SELECT MAX(id) FROM convos) AND chat_id = ?', [chatId]); 
              db.run('DELETE FROM convos WHERE id < (SELECT MAX(id) FROM convos) AND chat_id = ?', [chatId]); 
            }
          });
        }
      });
    })

  }
  
  catch (error) {
    console.error(error);
    return null;
  }
  
}

exports.clearArrayAfterDelay = function(array) {
  setTimeout(function() {
    array.length = null;
  }, 2 * 60 * 60 * 1000);
}

