const express = require('express');
const app = express();

// 首頁
app.get('/', (req, res) => {
  res.send("Hello, I am running!");
});

// /ping 頁面（UptimeRobot 會 ping 這個）
app.get('/ping', (req, res) => {
  res.send("alive");
});

function keepAlive() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log("Server is running on port " + port);
  });
}

module.exports = keepAlive;
