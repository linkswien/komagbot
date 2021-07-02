// Dependencies
const { Telegraf } = require('telegraf')
const { DateTime } = require('luxon')
const fs = require('fs')
const express = require('express')
const https = require('https')

// Settings
const config = require('./config.js')

try {
  if (fs.existsSync(config.telegraf.chatIDFilePath)) {
    //file exists
    let broadcastGroups = fs.readFileSync(config.telegraf.chatIDFilePath).toString().split('\n').filter(n => n)
  }
} catch(err) {
  let broadcastGroups = []
}

// Store and serialize data
const addToBroadcastGroups = (chatID) => {
  if (!broadcastGroups.find(chatID)) {
    broadcastGroups.push(chatID)
    fs.appendFileSync(config.telegraf.chatIDFilePath, `${chatID}\n`)
  }
}

// Telegram Bot API part
// =====================
const bot = new Telegraf(config.telegraf.botSecret)

// Add current group to broadcastGroups
bot.command('subscribe', (ctx) => {
  console.log(ctx.message)
  ctx.reply('Hallo, diese Gruppe bekommt ab sofort alle Komag Updates von mir berichtet…')
  addToBroadcastGroups(ctx.chat.id)
  console.log(broadcastGroups)
})

// Remove current group from broadcastGroups
// bot.command('quit', (ctx) => {
//   ctx.reply('Diese Gruppe bekommt ab sofort keine Komag Updates mehr… Melde dich mit /subscribe wieder ab.')
//   broadcastGroups.delete(ctx.chat.id)
//   console.log(broadcastGroups)
// })

// Broadcast message to all broadcastGroups
bot.command('broadcast', (ctx) => {
  console.log(ctx.message)
  broadcastMessage(broadcastGroups, ctx.message.text.replace('/broadcast', '') || 'Alarm!')
})

const broadcastMessage = (channels, message) => {
  channels.map(channel => {
    bot.telegram.sendMessage(channel, message)
  })
}

bot.telegram.setWebhook(config.publicURL + '/telegram' + config.telegraf.webhookSecret)

// ExpressJS part
// ==============

// Serve everything with expressjs
const app = express()

app.use(bot.webhookCallback('/telegram' + config.telegraf.webhookSecret))
app.use(express.json())

const assembleMessage = (posting) => {
  let message = `Ein neuer Postingvorschlag „${posting.Titel}” von ${posting.Name}\nTextvorschlag: ${posting.Text}`
  if (posting.Deadline) {
    message += `\nDeadline: ${DateTime.fromISO(posting.Deadline).setZone('Europe/Vienna').setLocale('de-AT').toLocaleString(DateTime.DATETIME_MED)}`
  }
  return message
}

// Receive new Postingvorschlag
app.post('/webhook', function (req, res) {
  console.log(req.body)

  if (req.body.secret !== config.express.webhookSecret) {
    res.send('forbidden')
    return
  }

  broadcastMessage(broadcastGroups, assembleMessage(req.body))
  res.send('success')
})

// TLS options
const tlsOptions = {
  key: fs.readFileSync(config.express.tlsKeyPath),
  cert: fs.readFileSync(config.express.tlsCertPath),
}

// Serve everything
https.createServer(tlsOptions, app).listen(config.express.port, () => {
  console.log('App served on port ' + config.express.port)
})

// Enable graceful stop

const handleSignal = (signal) => {
  bot.stop(signal)
  fs.writeFileSync(config.telegraf.chatIDFilePath, broadcastGroups.join('\n'))
}

process.once('SIGINT', handleSignal)
process.once('SIGTERM', handleSignal)
