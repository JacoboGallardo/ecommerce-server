const express = require("express");
const bodyParser = require("body-parser");
const path = require('path');
const cors = require('cors');
const { getProducts } = require("./products/productsService");
const { getCategories } = require("./categories/categoriesService");
const { getOrderHistory } = require("./order-history/orderService")
const { loginUser } = require('./login/loginService');
const { getCart, addItemToCart, removeItemFromCart, checkoutCart } = require('./cart/cartService')

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use('/public', express.static(path.join(__dirname, 'public')));


app.get("/api/products", async (req, res) => {
  console.log("Getting all products")
  const categoryId = req.query.category_id;
  if (!categoryId) {
    return res.status(400).json({ message: "Category ID is required" });
  }

  try {
    console.log("Category id is", categoryId)
    const updatedProducts = await getProducts(categoryId)

    res.json(updatedProducts);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Error fetching products" });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const results = await getCategories()
    res.json(results);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});

app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const loginResult = await loginUser(username, password)

    console.log('Login result', loginResult)
    if (loginResult.invalid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const { user, token } = loginResult;

    res.json({ id: user.id, name: user.name, token });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(403).json({ error: "Could not authenticate user" });
  }
});

app.get("/api/cart", async (req, res) => {
  const userId = req.query.user_id;
  try {
    const cart = await getCart(userId);

    res.json(cart);
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});


app.post("/api/cart/add-item", async (req, res) => {
  const { user_id, product_id, quantity } = req.body;

  try {
    const { cartItemId, newQuantity } = await addItemToCart(user_id, product_id, quantity)

    res.json({ message: "Cart item added to cart", cartItemId, newQuantity });
  } catch (err) {
    console.error("Error adding item to cart:", err);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});


app.post("/api/cart/remove-item", async (req, res) => {
  const { product_id, cart_id } = req.body;

  try {
    const newItemQuantity = await removeItemFromCart({ cartId: cart_id, productId: product_id })

    if (!newItemQuantity) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    if (newItemQuantity === 0) {
      return res.json({ message: "Cart item removed", newQuantity });
    }

    return res.json({ message: "Cart item updated", newQuantity });
  } catch (err) {
    console.error("Error removing item from cart:", err);
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
});

app.post("/api/cart/checkout", async (req, res) => {
  const { user_id } = req.body;
  const userId = user_id;

  try {
    await checkoutCart(userId);
    res.json({ message: "Checkout successful" });
  } catch (err) {
    console.error("Error during checkout:", err);
    res.status(500).json({ error: "Failed to checkout" });
  }
});

app.get("/api/orders", async (req, res) => {
  const userId = req.query.user_id;
  try {
    const results = await getOrderHistory(userId)
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

