/* global $ */
const m = require('mithril')
const root = document.body

const Data = {
  user: {
    userId: '',
    token: '',
    username: '',
    balance: 0,
    fetch: function () {
      if (Data.user.token) {
        return m.request({
          method: 'GET',
          url: `/api/tokens/${Data.user.token}`
        })
        .then(function (token) {
          Data.user.userId = token.user_id
          return m.request({
            method: 'GET',
            url: `/api/users/${Data.user.userId}`
          })
        })
        .then(function (user) {
          if (user) {
            Data.user.username = user.username
            Data.user.balance = user.balance
          } else {
            Data.user.token = ''
          }
        })
      }
    }
  },
  transactions: {
    list: [],
    fetch: function () {
      return m.request({
        method: 'GET',
        url: '/api/transactions'
      })
      .then(function (list) {
        Data.transactions.list = list
      })
    }
  },
  users: {
    list: [],
    fetch: function () {
      return m.request({
        method: 'GET',
        url: '/api/users'
      })
      .then(function (list) {
        Data.users.list = list
      })
    }
  }
}
const CurrentUser = {
  oninit: Data.user.fetch,
  view: function () {
    return m('ul.nav.navbar-nav.navbar-right',
      (Data.user.token) ? [
        m('li', m('p.navbar-text',
          `${Data.user.username} / ${Data.user.balance.toLocaleString()}`)),
        m('li', m('a[href=#]', {
          onclick: Actions.signOut
        }, 'Sign out'))
      ] : [
        m('li', m('a[href=/create]', {
          oncreate: m.route.link
        }, 'Create account')),
        m('li', m('a[href=/signin]', {
          oncreate: m.route.link
        }, 'Sign in'))
      ])
  }
}

const CreateAccountModel = {
  username: '',
  password: '',
  setUsername: function (username) {
    CreateAccountModel.username = username
  },
  setPassword: function (password) {
    CreateAccountModel.password = password
  },
  clear: function () {
    CreateAccountModel.username = ''
    CreateAccountModel.password = ''
  }
}

const SignInModel = {
  username: '',
  password: '',
  setUsername: function (username) {
    SignInModel.username = username
  },
  setPassword: function (password) {
    SignInModel.password = password
  },
  clear: function () {
    SignInModel.username = ''
    SignInModel.password = ''
  }
}

const SignInForm = {
  view: function () {
    return m('form', {
      onsubmit: function (e) {
        e.preventDefault()
        Actions.signIn()
      }
    }, [
      m('.form-group', [
        m('label[for=username]', 'Username'),
        m('input.form-control#username[type=text][placeholder=Username]', {
          value: SignInModel.username,
          oninput: m.withAttr('value', SignInModel.setUsername)
        })
      ]),
      m('.form-group', [
        m('label[for=password]', 'Password'),
        m('input.form-control#password[type=password][placeholder=Password]', {
          value: SignInModel.password,
          oninput: m.withAttr('value', SignInModel.setPassword)
        })
      ]),
      m('button.btn.btn-default[type=submit]', 'Sign in')
    ])
  },
  oncreate: function () {
    $('#username').focus()
  }
}

const CreateAccountForm = {
  oninit: Data.user.fetch,
  view: function () {
    return m('form', {
      onsubmit: function (e) {
        e.preventDefault()
        Actions.createAccount()
      }
    }, [
      m('.form-group', [
        m('label[for=username]', 'Username'),
        m('input.form-control#username[type=text][placeholder=Username]', {
          value: CreateAccountModel.username,
          oninput: m.withAttr('value', CreateAccountModel.setUsername)
        })
      ]),
      m('.form-group', [
        m('label[for=password]', 'Password'),
        m('input.form-control#password[type=password][placeholder=Password]', {
          value: CreateAccountModel.password,
          oninput: m.withAttr('value', CreateAccountModel.setPassword)
        })
      ]),
      m('button.btn.btn-default[type=submit]', 'Create account')
    ])
  },
  oncreate: function () {
    $('#username').focus()
  }
}

const Navbar = {
  view: function () {
    return m('nav.navbar.navbar-default',
      m('.container-fluid', [
        m('.navbar-header', [
          m('button.navbar-toggle.collapsed[type=button][data-toggle=collapse][data-target=#navbar-collapse][aria-expanded=false]', [
            m('span.sr-only', 'Toggle navigation'),
            m('span.icon-bar'),
            m('span.icon-bar'),
            m('span.icon-bar')]),
          m('a.navbar-brand[href=#]', '💎')]),
        m('.collapse.navbar-collapse#navbar-collapse',
          m('ul.nav.navbar-nav', [
            m('li', m('a[href=/users]', {
              oncreate: m.route.link
            }, 'Users')),
            m('li', m('a[href=/send]', {
              oncreate: m.route.link
            }, 'Send')),
            m('li', m('a[href=/transactions]', {
              oncreate: m.route.link
            }, 'Transactions')),
            m('li', m('a[href=/tokens]', {
              oncreate: m.route.link
            }, 'Tokens'))]),
          m(CurrentUser))
      ]))
  }
}

const UsersList = {
  oninit: Data.users.fetch,
  view: function () {
    return m('table.table.table-hover', [
      m('thead',
        m('tr', [
          m('th', '#'), m('th', 'Username'), m('th', 'Balance')])),
      m('tbody', Data.users.list.map(function (user, index) {
        return m('tr', [
          m('td', index + 1),
          m('td', user.username),
          m('td', user.balance.toLocaleString())
        ])
      }))
    ])
  }
}

const TransactionsList = {
  oninit: Data.transactions.fetch,
  view: function () {
    return m('table.table.table-hover#transactions', [
      m('thead',
        m('tr', [
          m('th', '#'),
          m('th', 'Sender'),
          m('th', 'Recipient'),
          m('th', 'Amount'),
          m('th', 'Memo')])),
    ])
  },
  oncreate: function () {
    $('#transactions').dataTable({
      order: [4, 'desc'],
      ajax: function (data, callback, settings) {
        Promise.all([
          m.request({
            method: 'GET',
            url: '/api/transactions'
          }),
          m.request({
            method: 'GET',
            url: '/api/users'
          })
        ]).then(([transactions, usersList]) => {
          users = {}
          for (let user of usersList) {
            users[user.user_id] = user.username
          }
          var getUsername = function (id) {
            return users[id]
          }

          callback({
            data: transactions.map(t => [
              t.transaction_id,
              getUsername(t.sender),
              getUsername(t.recipient),
              t.amount.toLocaleString(),
              t.memo
            ])
          })
        })
      }
    })
  }
}

const Transactions = {
  view: function () {
    return addNavbar(m('h2', 'Transactions'), m(TransactionsList))
  }
}

const Users = {
  view: function () {
    return addNavbar(m('h2', 'Users'), m(UsersList))
  }
}

const Index = {
  view: function () {
    return addNavbar(m('h2', 'index'))
  }
}

const Actions = {
  signOut: function () {
    return m.request({
      method: 'DELETE',
      url: `/api/tokens/${Data.user.token}`
    })
    .then(function (result) {
      if (result.success) {
        Data.user.token = ''
        m.route.set('/signin')
      }
    })
  },
  signIn: function () {
    return m.request({
      method: 'POST',
      url: '/api/tokens',
      data: {
        username: SignInModel.username,
        password: SignInModel.password
      }
    })
    .then(function (result) {
      if (result.token) {
        Data.user.token = result.token
        SignInModel.clear()
        m.route.set('/users')
      }
    })
  },
  createAccount: function () {
    return m.request({
      method: 'POST',
      url: '/api/users',
      data: {
        username: CreateAccountModel.username,
        password: CreateAccountModel.password
      }
    })
    .then(function (result) {
      if (result.success) {
        SignInModel.setUsername(CreateAccountModel.username)
        SignInModel.setPassword(CreateAccountModel.password)
        CreateAccountModel.clear()
        return Actions.signIn()
      }
    })
  }
}

const CreateAccount = {
  view: function () {
    return addNavbar(
      m('h2', 'Create account'),
      m(CreateAccountForm))
  }
}

const SignIn = {
  view: function () {
    return addNavbar(
      m('h2', 'Sign in'),
      m(SignInForm))
  }
}

const SendForm = {
  oninit: Data.users.fetch,
  view: function () {
    return m('form', [
      m('.form-group', [
        m('label[for=recipient]', 'Recipient'),
        m('select#recipient')
      ]),
      m('.form-group', [
        m('label[for=amount]', 'Amount'),
        m('input.form-control#amount[placeholder=Amount]', {
          value: SendFormModel.amount,
          oninput: m.withAttr('value', SendFormModel.setAmount)
        })
      ]),
      m('.form-group', [
        m('label[for=memo]', 'Memo'),
        m('input.form-control#memo[placeholder=Memo]', {
          value: SendFormModel.memo,
          oninput: m.withAttr('value', SendFormModel.setMemo)
        })
      ])
    ])
  },
  oncreate: function () {
    var $select = $('#recipient')
    $select.selectize({
      placeholder: 'Recipient',
      preload: true,
      valueField: 'user_id',
      searchField: 'username',
      options: Data.users.list,
      render: {
        option: function (data, escape) {
          return `<div>${escape(data.username)}</div>`
        },
        item: function (data, escape) {
          return `<div>${escape(data.username)}</div>`
        }
      },
      load: function (query, callback) {
        m.request({
          method: 'GET',
          url: '/api/users'
        }).then(callback)
      },
      onChange: SendFormModel.setRecipient
    })
    $select[0].selectize.setValue(SendFormModel.recipient)
  }
}

const SendFormModel = {
  recipient: '',
  amount: '',
  memo: '',
  setRecipient: function (recipient) {
    SendFormModel.recipient = recipient
  },
  setAmount: function (amount) {
    SendFormModel.amount = amount
  },
  setMemo: function (memo) {
    SendFormModel.memo = memo
  }
}

const Send = {
  view: function () {
    return addNavbar(
      m('h2', 'Send'),
      m(SendForm))
  }
}

var addNavbar = function () {
  return [m(Navbar), m('.container', Array.prototype.slice.call(arguments))]
}

m.route.prefix('')
m.route(root, '/', {
  '/': Index,
  '/users': Users,
  '/send': Send,
  '/transactions': Transactions,
  '/create': CreateAccount,
  '/signin': SignIn
})
