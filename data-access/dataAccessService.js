const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "localhost",
    user: "callile",
    password: "toor", // Replace with your MySQL password
    database: "Tienda_Calile", // Replace with your database name
});

const queryDb = async (query, params) => {
    const [rows] = await pool.execute(query, params); // Execute query and get the result rows
    return rows;
};

module.exports = { queryDb }