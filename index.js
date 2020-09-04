const fetch = require('node-fetch');
const express = require('express');
const winston = require('winston');
const expressWinston = require('express-winston');
const bodyParser = require('body-parser')
const config = require('./lib/config');
const {IncrementalsPlugin} = require('./IncrementalsPlugin.js');

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


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


async function check_jenkins() {
  const jenkinsOpts = {};
  if (config.JENKINS_AUTH) {
    jenkinsOpts.headers = {'Authorization': 'Basic ' + new Buffer.from(config.JENKINS_AUTH, 'utf8').toString('base64')};
  }
  const response = await fetch(config.JENKINS_HOST + '/whoAmI/api/json', jenkinsOpts)
  if (response.status !== 200) {
    throw new Error('Unable to talk to jenkins');
  }
  await response.json();
  return { jenkins: 'ok' }
}

app.use('/healthcheck', require('express-healthcheck')({
  test: async function (callback) {
    (async function() {
      const results = {};
      Object.assign(results,config.JENKINS_AUTH ?  await check_jenkins() : { jenkins: 'no_auth' });
      return results;
    })().then(callback, callback);
  }
}));

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

// Handle ^C
process.on('SIGINT', shutdown);

// Do graceful shutdown
function shutdown() {
  logger.info('Got SIGINT');
  process.exit();
}

app.listen(port, () => {
  logger.info(`Incrementals listening at http://localhost:${port}`)
})
