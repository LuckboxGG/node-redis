const assert = require('assert');
const redis = require('redis');

/**
 * Valdates options related to the heartbeat and sets defaults for missing ones
 * @param {Array} args
 */
function processOptions(options) {
  const defaultOptions = {
    heartbeat_timeout: 1000,
    heartbeat_interval: 5000
  };

  Object.assign(options, defaultOptions);

  for (const key in defaultOptions) {
    assert(Number.isInteger(options[key]), `"${key}" must have an integer value in milliseconds`);
    assert(options[key] > 0, `"${key}" must be a non-zero positive number`);
  }
  assert(options.heartbeat_interval > options.heartbeat_timeout, '"heartbeat_interval" must be larger than "heartbeat_timeout"');
}

/**
 * Starts the heartbeat process
 * @param {RedisClient}
 * @return {RedisClient}
 */
function init(client) {
  if (client.heartbeatStarted) {
    return;
  }
  client.heartbeatStarted = true;

  setInterval(() =>{
    let running = true;

    // Consider the connection dead after 'heartbeat_timeout' milliseconds without a response
    const timeout = setTimeout(() => {
      running = false;
      // Forces a Redis reconnection by destroying its underlying socket
      client.stream.destroy({
        message: 'Server did not respond to heartbeat in time.',
        code: 'HEARTBEAT_TIMEOUT'
      });
    }, client.options.heartbeat_timeout);

    client.ping(error => {
      if (!error && running) {
        clearTimeout(timeout);
      }
    });
  }, client.options.heartbeat_interval);

  return client;
}

/**
 * @inheritdoc
 */
class RedisClient extends redis.RedisClient {
  /**
   * @inheritdoc
   */
  constructor(options = {}, stream) {
    processArgs(options);
    super(options, stream);
    init(this);
  }

  /**
   * @inheritdoc
   */
  duplicate(options = {}, callback) {
    processArgs(options);
    const client = super.duplicate(options, callback);
    Object.setPrototypeOf(client, RedisClient.prototype);
    return init(client);
  }

  /**
   * @inheritdoc
   */
  on_error(err) {
    if (err.code === 'HEARTBEAT_TIMEOUT') {
      this.emit('heartbeat-timeout', err);
      return this.connection_gone('error', err);
    }
    return super.on_error(err);
  }
}

/**
 * @inheritdoc
 */
module.exports = Object.assign({}, redis, {
  createClient: (...args) => {
    if (!args.length || typeof args[args.length - 1] !== 'object') {
      args.push({});
    }

    const options = args[args.length - 1];
    processOptions(options);
    const client = redis.createClient(...args);
    Object.setPrototypeOf(client, RedisClient.prototype);
    return init(client);
  },
  RedisClient
});
