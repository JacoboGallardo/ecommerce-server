const path = require('path');
const { queryDb } = require('../data-access/dataAccessService')

const getProducts = async (categoryId) => {
    const query = "SELECT * FROM products WHERE category_id = ?";
    const results = await queryDb(query, [categoryId]);
    const baseURL = "http://localhost:4000";
    const updatedProducts = results.map((product) => ({
        ...product,
        image_url: `${baseURL}/public/images/${path.basename(product.image_url)}`,
    }));

    return updatedProducts;
}

module.exports = { getProducts }