const assert = require('assert');
const redis = require('redis');

/**
 * Valdates options related to the heartbeat and sets defaults for missing ones
 * @param {Array} args
 */
function processArgs(args) {
  if (!args.length) {
    args[0] = {};
  }

  const defaultOptions = {
    heartbeat_timeout: 1000,
    heartbeat_interval: 5000
  };

  Object.assign(args[0], defaultOptions);

  for (const key in defaultOptions) {
    assert(Number.isInteger(args[0][key]), `"${key}" must have an integer value in milliseconds`);
    assert(args[0][key] > 0, `"${key}" must be a non-zero positive number`);
  }
  assert(args[0].heartbeat_interval > args[0].heartbeat_timeout, '"heartbeat_interval" must be larger than "heartbeat_timeout"');
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
  constructor(...args) {
    processArgs(args);
    super(...args);
    init(this);
  }

  /**
   * @inheritdoc
   */
  duplicate(...args) {
    processArgs(args);
    const client = super.duplicate(...args);
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
    processArgs(args);
    const client = redis.createClient(...args);
    Object.setPrototypeOf(client, RedisClient.prototype);
    return init(client);
  },
  RedisClient
});
