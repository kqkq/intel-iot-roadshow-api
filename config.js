module.exports = {
  db: {
    connectionLimit: 100,
    hostname: 'localhost',
    username: 'root',
    password: '',
    database: {v0: 'guestbook', v1: 'iot_demo'},
    debug: false
  },
  server: {
    port: 3000,
    timezone: +8
  },
  api: {
    secret: 'secret',
    options: {
      algorithm: 'HS256',
      expiresIn: 86400,
      issuer: 'CheeseLabs.org'
    }
  }
};
