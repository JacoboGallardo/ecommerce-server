const jwt = require("jwt-simple");
const { queryDb } = require('../data-access/dataAccessService')

const loginUser = async (username, password) => {
    const query = "SELECT * FROM users WHERE name = ? AND password = ?";
    const results = await queryDb(query, [username, password]);

    if (results.length === 0) {
        return { invalid: true }
    }

    const user = results[0];
    const token = jwt.encode({ userId: user.id }, "your_jwt_secret");
    return { invalid: false, token, user }
}

module.exports = { loginUser }