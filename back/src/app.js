require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
