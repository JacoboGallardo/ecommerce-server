const { queryDb } = require('../data-access/dataAccessService')

const getOrderHistory = async (userId) => {

    const orders = await queryDb(
        `SELECT id, user_id, creation_date FROM orders WHERE user_id = ? ORDER BY creation_date DESC`,
        [userId]
    );

    if (orders.length === 0) {
        await connection.end();
        return []; // No orders found for the user
    }

    const orderIds = orders.map(order => order.id);

    console.log('Order IDs', orderIds)

    // Step 2: Get all order items for those orders
    const query = `SELECT order_id, product_id, quantity, unit_price 
    FROM order_products 
    WHERE order_id IN (${orderIds.map(id => `'${id}'`).join(",")})`;

    orderProducts = await queryDb(query, []);

    const productIds = [...new Set(orderProducts.map(op => op.product_id))];
    let products = [];
    if (productIds.length > 0) {
        const productResults = await queryDb(
            `SELECT id, name, description, price, image_url FROM products WHERE id IN (${productIds.map(id => `'${id}'`).join(",")})`,
            []
        );
        products = productResults.reduce((acc, product) => {
            acc[product.id] = product;
            return acc;
        }, {});

        console.log('Products', products)
    }

    // Step 4: Process and format the data in JavaScript
    const ordersWithDetails = orders.map(order => {
        const items = orderProducts
            .filter(op => op.order_id === order.id)
            .map(op => ({
                product_id: op.product_id,
                name: products[op.product_id]?.name || "Unknown Product",
                description: products[op.product_id]?.description || "",
                quantity: op.quantity,
                unit_price: op.unit_price,
                total_price: op.quantity * op.unit_price,
                image_url: products[op.product_id]?.image_url || null
            }));

        return {
            order_id: order.id,
            user_id: order.user_id,
            total: items.reduce((sum, item) => sum + item.total_price, 0),
            creation_date: order.creation_date,
            products: items
        };
    })

    return ordersWithDetails;
}

module.exports = { getOrderHistory }