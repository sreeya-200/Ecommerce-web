// Step 1: Set Up the Project Structure
//mkdir my-ecommerce-app
//cd my-ecommerce-app
//mkdir server
//cd server
//npm init -y
//npm install express mongoose bcryptjs jsonwebtoken cors dotenv express-validator
//cd ..
//npx create-react-app client
//cd client
//npm install axios react-router-dom redux react-redux

// Step 2: Backend Setup
// 1. Create the Basic Server:
// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { check, validationResult } = require('express-validator');

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 2. Create User and Product Models:
// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        minlength: 3,
        maxlength: 30
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        match: [/.+@.+\..+/, 'Please enter a valid email']
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('User', UserSchema);

// backend/models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    price: { 
        type: Number, 
        required: true,
        min: 0
    },
    description: { 
        type: String, 
        required: true,
        minlength: 10
    },
    imageUrl: { 
        type: String, 
        required: true 
    },
    stock: { 
        type: Number, 
        required: true, 
        min: 0 
    }
});

module.exports = mongoose.model('Product', ProductSchema);

// 3. Create User and Product Routes:
// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

// Sign Up
router.post('/signup', [
    check('username', 'Username must be 3+ characters').isLength({ min: 3 }),
    check('email', 'Valid email required').isEmail(),
    check('password', 'Password must be 6+ characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { username, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ username, email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// Sign In
router.post('/signin', [
    check('email', 'Valid email required').isEmail(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id, username: user.username, email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error during signin' });
    }
});

module.exports = router;

// backend/routes/products.js
const express = require('express');
const Product = require('../models/Product');
const { check, validationResult } = require('express-validator');
const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching products' });
    }
});

// Add a new product (protected route)
router.post('/', [
    check('name', 'Name is required').notEmpty(),
    check('price', 'Price must be a positive number').isFloat({ min: 0 }),
    check('description', 'Description must be 10+ characters').isLength({ min: 10 }),
    check('imageUrl', 'Image URL is required').notEmpty(),
    check('stock', 'Stock must be a non-negative number').isInt({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, price, description, imageUrl, stock } = req.body;
        const newProduct = new Product({ name, price, description, imageUrl, stock });
        await newProduct.save();
        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding product' });
    }
});

module.exports = router;

// Step 3: Frontend Setup
// 1. Create Sign In and Sign Up Pages:
// frontend/src/pages/SignIn.js
import React, { useState } from 'react';
import axios from 'axios';

const SignIn = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5000/api/users/signin', { email, password });
            localStorage.setItem('token', response.data.token);
            setError('');
            window.location.href = '/products'; // Redirect to products page
        } catch (error) {
            setError(error.response?.data?.message || 'Error signing in');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto' }}>
            <h2>Sign In</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Email" 
                    required 
                    style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }}
                />
                <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Password" 
                    required 
                    style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }}
                />
                <button type="submit" style={{ padding: '8px 16px' }}>Sign In</button>
            </form>
        </div>
    );
};

export default SignIn;

// frontend/src/pages/SignUp.js
import React, { useState } from 'react';
import axios from 'axios';

const SignUp = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5000/api/users/signup', { username, email, password });
            localStorage.setItem('token', response.data.token);
            setError('');
            window.location.href = '/products'; // Redirect to products page
        } catch (error) {
            setError(error.response?.data?.message || 'Error signing up');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto' }}>
            <h2>Sign Up</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="Username" 
                    required 
                    style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }}
                />
                <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Email" 
                    required 
                    style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }}
                />
                <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Password" 
                    required 
                    style={{ display: 'block', margin: '10px 0', padding: '8px', width: '100%' }}
                />
                <button type="submit" style={{ padding: '8px 16px' }}>Sign Up</button>
            </form>
        </div>
    );
};

export default SignUp;

// 2. Create a Product Page:
// frontend/src/pages/ProductPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ProductPage = () => {
    const [products, setProducts] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:5000/api/products', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProducts(response.data);
                setError('');
            } catch (error) {
                setError('Please sign in to view products');
            }
        };
        fetchProducts();
    }, []);

    return (
        <div style={{ maxWidth: '800px', margin: '50px auto' }}>
            <h1>Products</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {products.map(product => (
                    <li key={product._id} style={{ border: '1px solid #ddd', margin: '10px 0', padding: '15px' }}>
                        <h2>{product.name}</h2>
                        <p>{product.description}</p>
                        <p><strong>Price:</strong> ${product.price}</p>
                        <p><strong>Stock:</strong> {product.stock}</p>
                        <img src={product.imageUrl} alt={product.name} style={{ maxWidth: '200px' }} />
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ProductPage;

// 3. Set Up Routing:
// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ProductPage from './pages/ProductPage';

const App = () => {
    return (
        <Router>
            <Switch>
                <Route path="/signin" component={SignIn} />
                <Route path="/signup" component={SignUp} />
                <Route path="/products" component={ProductPage} />
                <Route path="/" component={ProductPage} />
            </Switch>
        </Router>
    );
};

export default App;

// Step 4: Run the Application
// 1. Start the Backend:
// In the backend directory, create a .env file:
// MONGODB_URI=your_mongodb_connection_string
// JWT_SECRET=your_jwt_secret
// Then run:
// node server.js
// 2. Start the Frontend:
// In the frontend directory, run:
// npm start