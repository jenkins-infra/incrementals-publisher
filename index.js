const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const express = require('express');
const winston = require('winston');
const expressWinston = require('express-winston');
const bodyParser = require('body-parser')
const helmet = require('helmet');
const config = require('./lib/config');
const {IncrementalsPlugin} = require('./IncrementalsPlugin.js');

const app = express()
const port = process.env.PORT || 3000
const asyncWrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(err => next(err));

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

app.use(helmet());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

const healthchecks = {
  jenkins: async function () {
    const jenkinsOpts = {};
    if (!config.JENKINS_AUTH) {
      return { jenkins: 'no_auth' };
    }

    jenkinsOpts.headers = {'Authorization': 'Basic ' + new Buffer.from(config.JENKINS_AUTH, 'utf8').toString('base64')};
    const response = await fetch(config.JENKINS_HOST + '/whoAmI/api/json', jenkinsOpts)
    if (response.status !== 200) {
      throw new Error('Unable to talk to jenkins');
    }
    await response.json();
    return { jenkins: 'ok' }
  }
}

app.use('/liveness', asyncWrap(async (req, res) => {
  res.status(200);
  let responseJson = { errors: [] };
  for (const key of Object.keys(healthchecks)) {
    try {
      responseJson = { ...responseJson, ...await healthchecks[key]() };
    } catch (e) {
      logger.error(`Healthcheck: ${e}`);
      responseJson.errors.push(key);
      res.status(500);
    }
  }
  res.json(responseJson);
}));

app.use('/healthcheck', (req, res) => {
  res.status(200).send('OK');
});

const encodedPassword = bcrypt.hashSync(config.PRESHARED_KEY, 10);

app.post('/', asyncWrap(async (req, res) => {
  const authorization = (req.get('Authorization') || '').replace(/^Bearer /, '');
  // we bcrypt so nobody can learn from timing attacks
  // https://www.npmjs.com/package/bcrypt#a-note-on-timing-attacks
  const check = await bcrypt.compare(authorization, encodedPassword);
  if (!check) {
    res.status(403).send('Not authorized');
    return
  }

  const context = { log: logger };
  const obj = new IncrementalsPlugin(context, { body: req.body });
  res.send((await obj.main()).body);
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
