const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const express = require('express');
const winston = require('winston');
const expressWinston = require('express-winston');
const bodyParser = require('body-parser')
const helmet = require('helmet');
const asyncWrap = require('express-async-wrap');

const config = require('./lib/config');
const {IncrementalsPlugin} = require('./IncrementalsPlugin.js');

const app = express()
const port = config.PORT

const logger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.Console({ })
  ],
  format: process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  exitOnError: false, // do not exit on handled exceptions
});

/* Logger after routing */
app.use(expressWinston.logger({
  winstonInstance: logger,
}));

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

app.get('/readiness', asyncWrap(async (req, res) => {
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

app.get('/liveness', asyncWrap(async (req, res) => {
  res.status(200).json({
    status: 'OK',
    version: require('./package.json').version
  });
}));

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

/*Error handler goes last */
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
