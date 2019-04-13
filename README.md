# node-redis
A wrapper that handles some of the connection deficiencies of the "redis" 2.x.x package.

## Motivation
When using Redis in a high-availability environment, one might find that in some cases the NodeRedis's `retry_strategy` might not provide enough flexibility. If the server does not come back before the next reconnection attempt happens, the client hangs until the underlying socket times out, usually 120 seconds - the system's default. If however, the `connection_timeout` is lowered so that the the reconnection attempts are given up on sooner, once the socket times out no further attempts are made, rendering the `retry_strategy` useless.

## Usage
This wrapper can be used as a drop in replacement for the NodeRedis library, as it exposes the same API interface.

### Example

```js
const redis = require('@luckbox/redis');

const client = redis.createClient({
  host: '127.0.0.1',
  port: 6379,
  heartbeat_interval: 10000,
  heartbeat_timeout: 5000
});

client.on('heartbeat-timeout', error => {
  console.warn('Connection to Redis lost. Retrying...', error);
});

client.set('myKey', 'foo', redis.print);
...
```

## API
For general usage, refer to the [official documentation](http://redis.js.org/).

The following additional functionality has been added:

### Initialization options
Name                  | Default | Description
----------------------|---------|------------
heartbeat_interval    | `5000`  | How often to check the connection's health in milliseconds
heartbeat_timeout     | `1000`  | How long before a heartbeat times out in milliseconds

### Events

**`heartbeat-timeout`**
`client` will emit `heartbeat-timeout` when the last heartbeat has timed out.
