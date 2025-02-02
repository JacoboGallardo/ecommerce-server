const { queryDb } = require('../data-access/dataAccessService')

const getCategories = async () => {
    const query = "SELECT * FROM categories";
    const results = await queryDb(query);
    return results;
}

module.exports = { getCategories }