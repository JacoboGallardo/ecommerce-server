const guid = require('guid');
const path = require('path');
const { queryDb } = require('../data-access/dataAccessService')

const addItemToCart = async (userId, productId, quantity) => {
    let cartId;
    const query = "SELECT * FROM carts WHERE user_id = ?";
    const results = await queryDb(query, [userId]);

    if (results.length === 0) {
        console.log("Cart does not exist, creating");
        const newId = guid.create().toString();
        await queryDb("INSERT INTO carts (id, user_id, creation_date) VALUES (?, ?, NOW())", [newId, userId]);
        cartId = newId;
    } else {
        cartId = results[0].id;
        console.log("Cart exists with id", cartId);
    }

    const currentCartItemsQty = "SELECT * FROM cart_products WHERE cart_id = ?"
    const cartProducts = await queryDb(currentCartItemsQty, [cartId]);
    const totalQuantity = cartProducts.reduce((total, item) => total + item.quantity, 0);

    const checkQuery = "SELECT * FROM cart_products WHERE cart_id = ? AND product_id = ?";
    const cartItemCheck = await queryDb(checkQuery, [cartId, productId]);

    if (cartItemCheck.length > 0) {
        console.log(`Cart item in cart ${cartId} with product_id ${productId} exists, updating`);
        const newQuantity = cartItemCheck[0].quantity + quantity;
        const itemId = cartItemCheck[0].id;
        await queryDb("UPDATE cart_products SET quantity = ? WHERE id = ?", [newQuantity, itemId]);
        console.log(`Item updated with new quantity: ${newQuantity}`);
        return { cartItemId: itemId, newQuantity, newTotalQuantity: totalQuantity + quantity }
    }

    const itemId = guid.create().toString();
    await queryDb("INSERT INTO cart_products (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)", [
        itemId,
        cartId,
        productId,
        quantity,
    ]);
    console.log("Item did not exist in cart, added new item", itemId);
    return { cartItemId: itemId, newQuantity: 1, newTotalQuantity: totalQuantity + 1 }
}

const getCart = async (userId) => {
    const query = "SELECT * FROM carts WHERE user_id = ?";
    const results = await queryDb(query, [userId]);
    const cartId = results[0].id;

    const cartPrice = await queryDb(
        "SELECT SUM(p.price * cp.quantity) AS total_price FROM cart_products cp JOIN products p ON cp.product_id = p.id WHERE cp.cart_id = ?",
        [cartId]
    );

    const productsInCart = await queryDb(
        "SELECT p.id, p.name, p.price, cp.quantity, p.image_url FROM cart_products cp JOIN products p ON cp.product_id = p.id WHERE cp.cart_id = ?",
        [cartId]
    );

    const baseURL = "http://localhost:4000";
    const updatedProducts = productsInCart.map((product) => ({
        ...product,
        image_url: `${baseURL}/public/images/${path.basename(product.image_url)}`,
    }));

    const totalQuantity = updatedProducts.reduce((total, item) => total + item.quantity, 0);

    const cart = {
        productsInCart: updatedProducts,
        cartTotalPrice: cartPrice[0].total_price,
        cartId,
        totalQuantity
    };

    return cart;
}

module.exports = { getCart, addItemToCart }