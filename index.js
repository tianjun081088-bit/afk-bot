const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const express = require('express');
const config = require('./settings.json');

//
// --- keep-alive HTTP server (for UptimeRobot) ---
const app = express();

app.get('/', (req, res) => {
  res.send('Bot has arrived');
});

app.get('/ping', (req, res) => {
  res.send('alive'); // UptimeRobot 會 ping 這個
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Keep-alive server started on port', PORT);
});

//
// --- Minecraft bot ---
function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('\x1b[33m[AfkBot] Bot joined the server\x1b[0m');

    // 自動註冊 / 登入
    if (config.utils['auto-auth']?.enabled) {
      console.log('[INFO] Started auto-auth module');
      const password = config.utils['auto-auth'].password;

      const sendRegister = () =>
        new Promise((resolve, reject) => {
          bot.chat(`/register ${password} ${password}`);
          console.log('[Auth] Sent /register');
          bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);
            if (message.includes('successfully registered') || message.includes('already registered')) return resolve();
            if (message.includes('Invalid command')) return reject(new Error('Registration failed: Invalid command'));
            return reject(new Error('Registration failed: unexpected message'));
          });
        });

      const sendLogin = () =>
        new Promise((resolve, reject) => {
          bot.chat(`/login ${password}`);
          console.log('[Auth] Sent /login');
          bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);
            if (message.includes('successfully logged in')) return resolve();
            if (message.includes('Invalid password')) return reject(new Error('Login failed: Invalid password'));
            if (message.includes('not registered')) return reject(new Error('Login failed: Not registered'));
            return reject(new Error('Login failed: unexpected message'));
          });
        });

      // 依序嘗試
      sendRegister()
        .catch(() => {}) // 若已註冊會丟錯，忽略
        .then(() => sendLogin())
        .catch(err => console.error('[ERROR]', err.message));
    }

    // 自動發聊天
    if (config.utils['chat-messages']?.enabled) {
      console.log('[INFO] Started chat-messages module');
      const { messages = [], repeat, 'repeat-delay': delay = 60 } = config.utils['chat-messages'];
      if (repeat && messages.length) {
        let i = 0;
        setInterval(() => {
          bot.chat(String(messages[i]));
          i = (i + 1) % messages.length;
        }, delay * 1000);
      } else {
        for (const msg of messages) bot.chat(String(msg));
      }
    }

    // 自動走到指定座標
    if (config.position?.enabled) {
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.settings.colorsEnabled = false;

      const { x, y, z } = config.position;
      console.log(`\x1b[32m[AfkBot] Moving to (${x}, ${y}, ${z})\x1b[0m`);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(x, y, z));
    }

    // anti-AFK
    if (config.utils['anti-afk']?.enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }
  });

  bot.on('goal_reached', () => {
    console.log(`\x1b[32m[AfkBot] Reached target at ${bot.entity.position}\x1b[0m`);
  });

  bot.on('death', () => {
    console.log(`\x1b[33m[AfkBot] Bot died, respawned at ${bot.entity.position}\x1b[0m`);
  });

  // 自動重連
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      const delay = Number(config.utils['auto-reconnect-delay'] || 5000);
      console.log(`[INFO] Disconnected, will reconnect in ${delay} ms`);
      setTimeout(createBot, delay);
    });
  }

  bot.on('kicked', reason => {
    console.log('\x1b[33m', `[AfkBot] Kicked. Reason:\n${reason}`, '\x1b[0m');
  });

  bot.on('error', err => {
    console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`);
  });
}

// 心跳日誌（可有可無）
setInterval(() => console.log('Bot is alive!'), 10000);

createBot();
