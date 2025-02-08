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

const removeItemFromCart = async ({ cartId, productId }) => {
    const checkQuery = "SELECT * FROM cart_products WHERE cart_id = ? AND product_id = ?";
    const cartItemCheck = await queryDb(checkQuery, [cartId, productId]);

    if (!cartItemCheck) {
        return undefined;
    }

    if (cartItemCheck[0].quantity >= 2) {
        console.log(`Cart item in cart ${cartId} with product_id ${productId} exists, removing one`);
        const newQuantity = cartItemCheck[0].quantity - 1;
        const itemId = cartItemCheck[0].id;
        await queryDb("UPDATE cart_products SET quantity = ? WHERE id = ?", [newQuantity, itemId]);
        console.log(`Item updated with new quantity: ${newQuantity}`);
        return newQuantity;
    }


    await queryDb("DELETE FROM cart_products WHERE cart_id = ? AND product_id = ?", [cartId, productId]);
    console.log('Item removed from cart completely')
    return 0;

}

const getCart = async (userId) => {
    const query = "SELECT * FROM carts WHERE user_id = ?";
    const results = await queryDb(query, [userId]);
    if (results.length === 0) {
        return {}
    }

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

const checkoutCart = async (userId) => {
    const cart = await getCart(userId);

    const { totalQuantity, productsInCart } = cart;

    console.log("Cart is", cart);

    const orderId = guid.create().toString();
    const cartId = cart.cartId;

    console.log("About to insert into orders", { orderId: orderId.toString(), userId, totalQuantity })

    await queryDb("INSERT INTO orders (id, user_id, total, creation_date) VALUES (?, ?, ?, NOW())", [
        orderId,
        userId,
        totalQuantity,
    ]);

    console.log('Order table updated')

    for (const productInCart of productsInCart) {
        const orderProductId = guid.create().toString();
        console.log("Product in cart", {
            id: orderProductId,
            orderId,
            productId: productInCart.id,
            price: productInCart.price,
            quantity: productInCart.quantity
        })

        await queryDb("INSERT INTO order_products (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)", [
            orderProductId,
            orderId,
            productInCart.id,
            productInCart.quantity,
            productInCart.price
        ]);
    }

    console.log('Order products updated in cartId', cartId);

    await queryDb('DELETE FROM cart_products WHERE cart_id=?', [cartId]);
    await queryDb('DELETE FROM carts WHERE id=?', [cartId]);

    console.log('Cart emptied');
}

module.exports = { getCart, addItemToCart, removeItemFromCart, checkoutCart }