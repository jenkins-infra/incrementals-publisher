const express = require('express');
const winston = require('winston');
const expressWinston = require('express-winston');
const bodyParser = require('body-parser')
const {IncrementalsPlugin} = require('./index.js');

const app = express()
const port = process.env.PORT || 3000

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'debug',
      handleExceptions: true,
      json: false,
      colorize: true,
    })
  ],
  format: process.env.NODE_ENV === 'production' ? winston.format.combine(
    winston.format.json()
  ) : winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  exitOnError: false, // do not exit on handled exceptions
});

app.use(bodyParser());

const asyncWrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(err => next(err));

app.post('/', asyncWrap(async (req, res) => {
  const context = {
    log: logger
  };
  //try {
  const obj = new IncrementalsPlugin(context, { body: req.body });
  res.send((await obj.main()).body);
  //} catch (e) {
  //  res.status(context.res.status);
  //  res.send(context.res.body);
  //  throw err;
  //}
}))

/* Logger after routing */
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true, // optional: control whether you want to log the meta data about the request (default to true)
  expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
  colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
  ignoreRoute: function (req) { return req.url.startsWith('/healthcheck'); }
}));

/* ERROR HANDLER GOES HERE */
app.use(function (err, req, res, next) {
  logger.error(err.stack)
  res.status(err.status || err.code || 400).send(err.message || 'Unknown error');
  next()
})

app.listen(port, () => {
  console.log(`Incrementals listening at http://localhost:${port}`)
})
