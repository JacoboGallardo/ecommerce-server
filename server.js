const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jwt-simple");
const mysql = require("mysql2/promise");
const path = require('path');
const cors = require('cors');
const guid = require('guid');



// Initialize Express app
const app = express();
app.use(cors());
// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files (images) from the 'public' directory
app.use('/public', express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: "localhost",
  user: "callile",
  password: "toor", // Replace with your MySQL password
  database: "Tienda_Calile", // Replace with your database name
});


// Function to query the database
const queryDb = async (query, params) => {
  const [rows] = await pool.execute(query, params); // Execute query and get the result rows
  return rows;
};

app.get("/api/products", async (req, res) => {
  console.log("Getting all products")
  const categoryId = req.query.category_id;
  if (!categoryId) {
    return res.status(400).json({ message: "Category ID is required" });
  }

  try {
    console.log("Category id is", categoryId)
    const query = "SELECT * FROM products WHERE category_id = ?";
    const results = await queryDb(query, [categoryId]);

    console.log("Results are", results)
    // Aquí agregamos la baseURL y modificamos la URL de las imágenes
    const baseURL = "http://localhost:4000"; // Tu baseURL
    const updatedProducts = results.map((product) => ({
      ...product,
      image_url: `${baseURL}/public/images/${path.basename(product.image_url)}`, // Modificamos la URL de la imagen
    }));

    res.json(updatedProducts);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Error fetching products" });
  }
});


// Endpoint: Get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const query = "SELECT * FROM categories";
    const results = await queryDb(query);
    res.json(results);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});


app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = "SELECT * FROM users WHERE name = ? AND password = ?";
    const results = await queryDb(query, [username, password]);

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = results[0];
    const token = jwt.encode({ userId: user.id }, "your_jwt_secret");
    res.json({ id: user.id, name: user.name, token });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/cart", async (req, res) => {
  const userId = req.query.user_id;
  try {
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

    const cart = {
      productsInCart,
      cartTotalPrice: cartPrice[0].total_price,
      cartId,
    };

    res.json(cart);
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});


app.post("/api/cart/add-item", async (req, res) => {
  const { user_id, product_id, quantity } = req.body;

  let cartId = null;
  try {
    const query = "SELECT * FROM carts WHERE user_id = ?";
    const results = await queryDb(query, [user_id]);

    if (results.length === 0) {
      console.log("Cart does not exist, creating");
      const newId = guid.create().toString();
      await queryDb("INSERT INTO carts (id, user_id, creation_date) VALUES (?, ?, NOW())", [newId, user_id]);
      cartId = newId;
    } else {
      cartId = results[0].id;
      console.log("Cart exists with id", cartId);
    }

    const checkQuery = "SELECT * FROM cart_products WHERE cart_id = ? AND product_id = ?";
    const cartItemCheck = await queryDb(checkQuery, [cartId, product_id]);

    if (cartItemCheck.length > 0) {
      console.log(`Cart item in cart ${cartId} with product_id ${product_id} exists, updating`);
      const newQuantity = cartItemCheck[0].quantity + quantity;
      const itemId = cartItemCheck[0].id;
      await queryDb("UPDATE cart_products SET quantity = ? WHERE id = ?", [newQuantity, itemId]);
      console.log(`Item updated with new quantity: ${newQuantity}`);
      res.json({ message: "Cart item updated", newQuantity });
    } else {
      const itemId = guid.create().toString();
      await queryDb("INSERT INTO cart_products (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)", [
        itemId,
        cartId,
        product_id,
        quantity,
      ]);
      console.log("Item did not exist in cart, added new item", itemId);

      res.json({ message: "Item added to cart", itemId });
    }
  } catch (err) {
    console.error("Error adding item to cart:", err);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});


app.post("/api/cart/remove-item", async (req, res) => {
  const { product_id, cart_id } = req.body;

  try {
    const checkQuery = "SELECT * FROM cart_products WHERE cart_id = ? AND product_id = ?";
    const cartItemCheck = await queryDb(checkQuery, [cart_id, product_id]);

    if (!cartItemCheck) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    if (cartItemCheck[0].quantity >= 2) {
      console.log(`Cart item in cart ${cart_id} with product_id ${product_id} exists, removing one`);
      const newQuantity = cartItemCheck[0].quantity - 1;
      const itemId = cartItemCheck[0].id;
      await queryDb("UPDATE cart_products SET quantity = ? WHERE id = ?", [newQuantity, itemId]);
      console.log(`Item updated with new quantity: ${newQuantity}`);
      res.json({ message: "Cart item updated", newQuantity });
    } else {
      await queryDb("DELETE FROM cart_products WHERE cart_id = ? AND product_id = ?", [cart_id, product_id]);
      res.json({ message: "Item removed from cart" });
    }
  } catch (err) {
    console.error("Error removing item from cart:", err);
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
});

app.post("/api/cart/checkout", async (req, res) => {
  const { user_id, payment_method } = req.body;
  try {
    // Replace 100.00 with the calculated total from cart items
    await queryDb("INSERT INTO orders (user_id, payment_method, total_amount) VALUES (?, ?, ?)", [
      user_id,
      payment_method,
      100.0,
    ]);
    res.json({ message: "Checkout successful" });
  } catch (err) {
    console.error("Error during checkout:", err);
    res.status(500).json({ error: "Failed to checkout" });
  }
});

app.get("/api/orders", async (req, res) => {
  const userId = req.query.user_id;
  try {
    const query = "SELECT * FROM orders WHERE user_id = ?";
    const results = await queryDb(query, [userId]);
    res.json(results);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

