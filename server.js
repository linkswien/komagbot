// Dependencies
const { Telegraf } = require('telegraf')
const { DateTime } = require('luxon')
const fs = require('fs')
const express = require('express')

// Settings
const config = require('./config.js')

let broadcastGroups = []

if (fs.existsSync(config.telegraf.chatIDFilePath)) {
  //file exists
  broadcastGroups = fs.readFileSync(config.telegraf.chatIDFilePath).toString().split('\n').filter(n => n)
}

// Store and serialize data
const addToBroadcastGroups = (chatID) => {
  if (!broadcastGroups.includes(chatID)) {
    broadcastGroups.push(chatID)
    fs.appendFileSync(config.telegraf.chatIDFilePath, `${chatID}\n`)
  }
}

// Telegram Bot API part
// =====================
const bot = new Telegraf(config.telegraf.botSecret)

// Add current group to broadcastGroups
bot.command('subscribe', (ctx) => {
  ctx.reply('Hallo, diese Gruppe bekommt ab sofort alle Komag Updates von mir berichtet…')
  addToBroadcastGroups(ctx.chat.id)
})

// Remove current group from broadcastGroups
// bot.command('quit', (ctx) => {
//   ctx.reply('Diese Gruppe bekommt ab sofort keine Komag Updates mehr… Melde dich mit /subscribe wieder ab.')
//   broadcastGroups.delete(ctx.chat.id)
//   console.log(broadcastGroups)
// })

// Broadcast message to all broadcastGroups
bot.command('broadcast', (ctx) => {
  broadcastMessage(broadcastGroups, ctx.message.text.replace('/broadcast', '') || 'Alarm!')
})

const broadcastMessage = (channels, message) => {
  channels.map(channel => {
    bot.telegram.sendMessage(channel, message)
    console.log('[Telegram] Message sent to ' + channel)
  })
}

const broadcastDocument = (channels, message, document) => {
  channels.map(channel => {
    bot.telegram.sendPhoto(channel, document, { 'disable_notification': true })
    console.log('[Telegram] Message sent to ' + channel)
  })
}

const broadcastMediaGroup = (channels, message, documents) => {
  channels.map(channel => {
    bot.telegram.sendMediaGroup(channel, documents, { 'disable_notification': true })
    console.log('[Telegram] Message sent to ' + channel)
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
  let message = `Hier ist ein neuer Postingvorschlag von ${posting.Von} zum Thema „${posting.Titel}“\n\nTextvorschlag: ${posting.Text}`
  if (posting.Datum) {
    message += `\n\nWunschdatum: ${DateTime.fromISO(posting.Datum).setZone('Europe/Vienna').setLocale('de-AT').toLocaleString(DateTime.DATETIME_MED)}`
  }
  return message
}

// Receive new Postingvorschlag
app.post('/webhook', function (req, res) {
  if (req.body.secret !== config.express.webhookSecret) {
    res.send('forbidden')
    console.log('[Webhook] Received request without secret:')
    console.log(req.body)
    return
  }

  console.log('[Webhook] Received valid request')

  let documents = []

  // Check whether there's something to attach
  if (req.body.posting.Bilder) {
    documents = [...documents, ...req.body.posting.Bilder]
  }
  if (req.body.posting.Anhang) {
    documents = [...documents, ...req.body.posting.Anhang]
  }

  // In any case: Send text message
  broadcastMessage(broadcastGroups, assembleMessage(req.body.posting))

  // And then some attachments if there are any
  if (documents.length === 1) {
    broadcastDocument(broadcastGroups, assembleMessage(req.body.posting), req.body.baseURL + documents[0].url)
  }
  if (documents.length > 1) {
    broadcastMediaGroup(broadcastGroups, assembleMessage(req.body.posting), documents.map(document => {
      return { type: 'document', media: req.body.baseURL + document.url }
    }))
  }

  res.send('success')
})

// Serve everything
app.listen(config.express.port, () => {
  console.log('App served on port ' + config.express.port)
})
