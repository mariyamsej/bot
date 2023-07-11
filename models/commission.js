const axios = require('axios');
const { sendMessage } = require('./telegram');
const {translateText} = require("./functions");
const config = require('../config');

exports.calculateCommission = async function (chatId, amount, network, languageCode) {
    const commissionPercentage = 0.001;
    let blockchain = network.split('-')[0];

    if (blockchain === 'Bitcoin') {
        blockchain = 'BTC';
    }
    else if (blockchain === 'Ethereum') {
        blockchain = 'ETH';
    }
    else if (blockchain === 'Tron') {
        blockchain = 'TRX';
    }

    const currency = network.split('-')[1];
     
    try {
        const res = await getExchangeRate(currency, blockchain + ',USD');
        const exchangeRate = res.data;
        
        let commission = amount * exchangeRate['USD'] * commissionPercentage;
        commission = Math.max(1, Math.min(commission, 999));
            
        const nativeTokenAmount = commission / exchangeRate['USD'] * exchangeRate[blockchain];

        sendMessage(chatId, await translateText(`Комиссия: ${commission} $, ${nativeTokenAmount} ${blockchain}\nПо курсу 1 ${currency} = ${exchangeRate['USD']} USD`, languageCode));
 
    }
    catch (error) {
        console.error('Error in obtaining the cryptocurrency exchange rate:', error);
        sendMessage(chatId, translateText(config.error, languageCode));
    }

    
}

async function getExchangeRate(fsymbol, tsymbol) {
    try {
        const url = `https://min-api.cryptocompare.com/data/price?fsym=${fsymbol}&tsyms=${tsymbol}`;
        return axios.get(url);
    }
    catch (error) {
        console.error(error);
        return null;
        }
}


