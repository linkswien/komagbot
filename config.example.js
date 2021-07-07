const config = {
  publicURL: 'https://public.url',
  express: {
    port: 9001,
    webhookSecret: 'random string',
  },
  telegraf: {
    botSecret: 'bot secret from Telegram Bot API',
    webhookSecret: 'random string',
    chatIDFilePath: 'file path to txt file where IDs are saved for now',
  },
}

module.exports = config;
