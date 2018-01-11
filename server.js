const config = require('./config.json')
const Database = require('better-sqlite3')
const express = require('express')
const http = require('http')
const bodyParser = require('body-parser')
const uuid = require('uuid/v4')
const shortid = require('shortid')
const passwordHash = require('password-hash')

const db = new Database('diamond.sqlite3', {
  memory: false,
  readonly: false,
  fileMustExist: false
})
const app = express()
const server = http.createServer(app)

var calculateTax = function (amount) {
  amount = parseInt(amount)
  return Math.ceil(amount * config.tax.rate)
}

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const router = express.Router()
app.use('/api', router)

var asTransaction = function (func) {
  var inTransaction = db.inTransaction
  if (!inTransaction) {
    db.prepare('BEGIN').run()
  }
  try {
    func()
    if (!inTransaction) {
      db.prepare('COMMIT').run()
    }
  } catch (e) {
    if (!inTransaction) {
      db.prepare('ROLLBACK').run()
    }
    throw e
  }
}

var makeTransaction = function (sender, recipient, amount, memo = '') {
  if (sender === recipient) { throw new Error('Cannot send money to yourself') }
  if (amount < 0) { throw new Error('Cannot send negative amount') }
  if (amount === 0) { return }

  if (memo.length > 48) { throw new Error('Memo must be at most 48 characters long') }

  try {
    asTransaction(function () {
      [
        'UPDATE balances SET balance = balance - $amount WHERE user_id = $sender',
        'UPDATE balances SET balance = balance + $amount WHERE user_id = $recipient',
        `INSERT INTO transactions (sender, recipient, amount, memo, timestamp)
        VALUES ($sender, $recipient, $amount, $memo, datetime("now"))`
      ].map(statement => db.prepare(statement).run({sender, recipient, amount, memo}))
    })
  } catch (e) {
    throw new Error('Transaction failed')
  }
}

router.route('/transactions')
  .get((req, res) => {
    if (req.query.limit) {
      return res.json(
        db.prepare(`SELECT transaction_id, sender, recipient, amount, memo, timestamp 
          FROM transactions ORDER BY transaction_id DESC LIMIT ?`).all(req.query.limit))
    } else {
      return res.json(
        db.prepare('SELECT transaction_id, sender, recipient, amount, memo, timestamp FROM transactions').all())
    }
  })
  .post((req, res) => {
    var data = db.prepare(`SELECT user_id, token FROM tokens WHERE token = ?`).get(req.body.token)

    if (data && data.token === req.body.token) {
      var sender = data.user_id
      var amount = parseInt(req.body.amount)
      var memo = req.body.memo
      var recipient = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(req.body.recipient)
      if (!recipient) { return res.json({ error: 'Recipient does not exist' }) }
      recipient = recipient.user_id

      try {
        asTransaction(function () {
          makeTransaction(sender, recipient, amount, memo)
          if (sender !== config.tax.id) {
            makeTransaction(sender, config.tax.id, calculateTax(amount), `${parseInt(config.tax.rate * 100)}% tax`)
          }
        })
        res.json({ success: true })
      } catch (e) {
        res.json({ error: e.message })
      }
    } else {
      return res.json({ error: 'Invalid token' })
    }
  })

router.route('/transactions/:user_id')
  .get((req, res) => {
    if (req.query.limit) {
      return res.json(
        db.prepare(`SELECT transaction_id, sender, recipient, amount, memo, timestamp 
          FROM transactions 
          WHERE sender = $userId OR recipient = $userId
          ORDER BY transaction_id DESC LIMIT $limit`).all({
            userId: req.params.user_id,
            limit: req.query.limit
          }))
    } else {
      return res.json(db.prepare('SELECT * FROM transactions WHERE sender = $userId OR recipient = $userId').all({
        userId: req.params.user_id
      }))
    }
  })

var validateUsername = function (username) {
  username = username.trim()
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters long')
  }
  if (username.length > 16) {
    throw new Error('Username must be at most 16 characters long')
  }
  if (!/^[a-zA-Z0-9_]*$/g.test(username)) {
    throw new Error('Username contains invalid characters')
  }
  return username
}

var createUser = function (username, password) {
  username = validateUsername(username)
  var userId = shortid.generate()
  var usernameLower = username.toLowerCase()
  password = passwordHash.generate(password)

  try {
    db.transaction([
      'INSERT INTO users (user_id, username, username_lower, password) VALUES ($userId, $username, $usernameLower, $password)',
      'INSERT INTO balances (user_id) VALUES ($userId)'
    ]).run({
      userId,
      username,
      usernameLower,
      password
    })
  } catch (e) {
    throw new Error('Could not create user')
  }

  return userId
}

router.route('/users')
  .get((req, res) => {
    if (req.query.username) {
      return res.json(db.prepare(`SELECT users.user_id, username, balance FROM users, balances 
        WHERE users.user_id = balances.user_id AND username_lower = ?`)
        .get(req.query.username.trim().toLowerCase()))
    } else {
      return res.json(db.prepare(`SELECT users.user_id, username, balance FROM users, balances
        WHERE users.user_id = balances.user_id`).all())
    }
  })
  .post((req, res) => {
    try {
      createUser(req.body.username, req.body.password)
      return res.json({ success: true })
    } catch (e) {
      return res.json({ error: e.message })
    }
  })

router.route('/users/:user_id')
  .get((req, res) => {
    return res.json(db.prepare(`SELECT users.user_id, username, balance FROM users, balances 
      WHERE users.user_id = balances.user_id AND users.user_id = ?`).get(req.params.user_id))
  })

router.route('/tokens')
  .post((req, res) => {
    if (!req.body.username) { return res.json({ error: 'No username provided' }) }
    if (!req.body.password) { return res.json({ error: 'No password provided' }) }

    var username = req.body.username.trim()
    var usernameLower = username.toLowerCase()
    var data = db.prepare('SELECT user_id, password FROM users WHERE username_lower = ?').get(usernameLower)
    if (!data) { return res.json({ error: 'Incorrect username or password' }) }
    var userId = data.user_id
    var hashedPassword = data.password

    var verified = passwordHash.verify(req.body.password, hashedPassword)
    if (verified) {
      var token = uuid()
      try {
        db.prepare('INSERT INTO tokens VALUES (?, ?, datetime("now"))').run(userId, token)
        return res.json({ success: true, token: token })
      } catch (e) {
        return res.json({ error: 'Could not save session' })
      }
    } else {
      return res.json({ error: 'Incorrect username or password' })
    }
  })

router.route('/tokens/:token')
  .get((req, res) => {
    var token = db.prepare('SELECT user_id, token, created FROM tokens WHERE token = ?').get(req.params.token)
    if (token) {
      return res.json(token)
    } else {
      return res.json({ error: 'Invalid token' })
    }
  })
  .delete((req, res) => {
    try {
      db.prepare('DELETE FROM tokens WHERE token = ?').run(req.params.token)
      return res.json({ success: true })
    } catch (e) {
      return res.json({ error: 'Could not delete token' })
    }
  })

router.route('/tax/calculate/:amount')
  .get((req, res) => {
    try {
      var amount = parseInt(req.params.amount)
      var tax = calculateTax(amount)
      return res.json({ success: true, tax: tax })
    } catch (e) {
      return res.json({ error: 'Not a valid amount (must be an integer)' })
    }
  })

var createTables = [
  `CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE, 
    sender TEXT, 
    recipient TEXT, 
    amount INTEGER, 
    memo TEXT, 
    timestamp DATETIME)`,
  'CREATE TABLE IF NOT EXISTS balances (user_id TEXT, balance INTEGER CHECK(balance >= 0) DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY UNIQUE, username TEXT, username_lower TEXT UNIQUE, password TEXT)',
  'CREATE TABLE IF NOT EXISTS tokens (user_id TEXT, token TEXT, created DATETIME)'
]
createTables.map(statement => db.prepare(statement).run())

var ensureUser = function (username, password) {
  try {
    return createUser(username, password)
  } catch (e) {
    return db.prepare('SELECT user_id FROM users WHERE username_lower = ?')
      .get(username.trim().toLowerCase()).user_id
  }
}
config.tax.id = ensureUser(config.tax.username, config.tax.password)
config.admin.id = ensureUser(config.admin.username, config.admin.password)

server.listen(config.port, () => console.log(`Started on *:${config.port}`))
