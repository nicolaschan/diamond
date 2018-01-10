# Diamond
💎 A website for keeping track of and transferring Minecraft in-game item ownership

## API Documentation
All payloads are `x-www-form-urlencoded`.

- `POST /api/tokens` Receive a session token
  - Payload: `{ username: String, password: String }`
  - Response: `{ token: String }`
- `DELETE /api/tokens/:token` Invalidate a session token
- `POST /api/transactions` Create a new transaction
  - Payload: `{ token: String, recipient: String, amount: Number, memo: String }`
- `GET /api/transactions` List all transactionss
  - Response: `[{ transaction_id: Number, sender: String, recipient: String, amount: Number, memo: String, timestamp: String }]`
- `GET /api/transactions/:user_id` All transactions relating to a user
  - Response: `[{ transaction_id: Number, sender: String, recipient: String, amount: Number, memo: String, timestamp: String }]`
- `POST /api/users` Create a new user
  - Payload: `{ username: String, password: String }`
- `GET /api/users` All users
  - Response: `[{ user_id: String, username: String, balance: Number }]`
- `GET /api/users?username=$USERNAME` Get user by username
  - Response: `{ user_id: String, username: String, balance: Number }`
- `GET /api/users/:user_id` Get user by user_id
  - Response: `{ user_id: String, username: String, balance: Number }`
- `GET /api/tax/calculate/:amount` Calculate the tax for a given amount sent
  - Response: `{ success: Boolean, tax: Number }`