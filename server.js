const PORT = 5000;
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
const app = express();
const routes = express.Router();
app.use("/api", routes);
// For JSON payloads
app.use(express.json({ limit: '100mb' }));

// For URL-encoded payloads
app.use(express.urlencoded({ limit: '100mb', extended: true }));
// body-parser
routes.use(bodyParser.urlencoded({ extended: false }));
routes.use(bodyParser.json());
const jsonParser = bodyParser.json();
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
//cors
routes.use(cors());

// mongoDB client
const MongoClient = require("mongodb").MongoClient;
const uri =
  "mongodb+srv://hamdichtiwi:IPzzX5rAgXExZo4r@marketplace.cxcpp5p.mongodb.net/?retryWrites=true&w=majority&appName=marketplace";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// connect to server
app.listen(PORT, () => {
  console.log(`Server up and running on http://localhost:${PORT}`);
});

// connect to DB
const DATABASE = "marketplace";
client.connect((err) => {
  if (err) {
    throw Error(err);
  }
  !err && console.log(`Successfully connected to database`);
  const db = client.db(DATABASE);
  const products = db.collection("products");
  const users = db.collection("users");
  const orders = db.collection("orders");

  routes.delete("/products/delete/:id", async function (req, res) {
    const productId = req.params.id;
  
    try {
      const deleteResult = await products.deleteOne({id: parseInt(productId)}); 
      if (deleteResult.deletedCount === 0) {
        return res.status(404).send("Product not found");
      }
  
      res.status(200).send("Successfully deleted the document");
    } catch (err) {
      console.log("Error deleting product:", err);
      res.status(500).send(err);
    }
  });

  // Update product by ID
routes.put("/products/update/:id", async (req, res) => {
  const productId = parseInt(req.params.id);
  const updatedProduct = {
    category: req.body.category,
    name: req.body.name,
    price: parseInt(req.body.price)
  };

  try {
    // Check if the product exists before updating
    const existingProduct = await products.findOne({ id: productId }); // Use findOne to get a single document
    if (!existingProduct) {
      return res.status(404).send("Product not found");
    }
// Keep the existing image
updatedProduct.image = existingProduct.image;
    console.log(updatedProduct);
    const result = await products.updateOne(
      { id: productId },
      { $set: updatedProduct }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).send("No changes made to the product");
    }

    res.status(200).send("Successfully updated the product");
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});
  // GET
  routes.get("/products", function (req, res) {
    products
      .find()
      .toArray()
      .then((error, results) => {
        if (error) {
          return res.send(error);
        }
        res.status(200).send({ results });
      })
      .catch((err) => res.send(err));
  });

  routes.get("/orders/:email", function (req, res) {
    const email = req.params.email; 
  
    orders
      .find({ "user.email": email }) 
      .toArray()
      .then((results) => {  
        res.status(200).send({ results });
      })
      .catch((error) => {
        res.status(500).send({ error: error.toString() });
      });
  });
  

  routes.get("/orders", function (req, res) {
    orders
      .find()
      .toArray()
      .then((error, results) => {
        if (error) {
          return res.send(error);
        }
        res.status(200).send({ results });
      })
      .catch((err) => res.send(err));
  });
  //route to get the user's profile with email
  routes.get("/user/:email", function (req, res) {
    users
      .findOne({ email: req.params.email  }) //retrieve user profile with email
      .then((error, results) => {
        if (error) {
          return res.send(error);
        }
        return res.status(200).send(results.data);
      })
      .catch((err) => res.send(err));
  });

  // POST
  const exampleObj = {
    id: 29999,
    category: "Clothes",
    name: "Winter Jacket for Women, All sizes",
    price: 79,
  };
 /* routes.post("/products/add", jsonParser, function (req, res) {
    products
      .insertOne(req.body)
      .then(() => res.status(200).send("successfully inserted new document"))
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });*/

  // POST
  routes.post("/products/add", upload.single('image'), function (req, res) {
    // First, fetch the current number of products in the collection
    products.countDocuments().then((count) => {
      const product = {
        id: count + 1,  // Assign an ID based on the count of existing documents
        category: req.body.category,
        name: req.body.name,
        price: req.body.price,
        image: req.file ? req.file.buffer : null
      };
  
      // Insert the new product with the assigned ID
      products.insertOne(product).then(() => {
        res.status(200).send("Successfully inserted new document");
      }).catch((err) => {
        console.log(err);
        res.status(500).send(err);  // Send status 500 for errors
      });
    }).catch((err) => {
      console.log(err);
      res.status(500).send("Error accessing product count");
    });
  });
  
  routes.post("/users/add", jsonParser, function (req, res) {
    users
      .insertOne(req.body)
      .then(() => res.status(200).send("successfully inserted new document"))
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });
  routes.post("/orders/add", jsonParser, function (req, res) { 
    orders
      .insertOne(req.body)
      .then(() => res.status(200).send("successfully inserted new document"))
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });
});

//stripe
const stripe = require("stripe")(process.env.SECRET_KEY);
const YOUR_DOMAIN = "http://localhost:3000";

routes.post("/create-checkout-session", jsonParser, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: req.body,
      mode: "payment",
      success_url: `${YOUR_DOMAIN}/success`,
      cancel_url: `${YOUR_DOMAIN}/cancel`,
    });

    res.json({ id: session.id });
  } catch (err) {
    return res.status(500).send(`failed to process payment ${err}`);
  }
});


//routes
routes.get("/", (req, res) => {
  res.send("Hello World!");
});


