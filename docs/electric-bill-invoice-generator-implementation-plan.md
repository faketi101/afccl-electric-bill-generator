# Electric Bill Invoice Generator — Full Implementation Plan

> **Stack:** MongoDB · Express.js · Vite + React · JavaScript  
> **Deployment:** Single combined server (cPanel Node.js compatible)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Prerequisites & Environment Setup](#3-prerequisites--environment-setup)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 package.json (root)
   - 4.2 server/index.js (entry point)
   - 4.3 Database Connection
   - 4.4 Mongoose Models
   - 4.5 Auth Middleware
   - 4.6 API Routes
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 Vite Setup
   - 5.2 React Entry & Router
   - 5.3 Auth Context
   - 5.4 Pages & Tabs
   - 5.5 PDF Generation Logic
   - 5.6 Print Logic
6. [Invoice PDF Layout Spec](#6-invoice-pdf-layout-spec)
7. [Paid Seal Logic](#7-paid-seal-logic)
8. [Admin Login System](#8-admin-login-system)
9. [cPanel Deployment Guide](#9-cpanel-deployment-guide)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Complete API Reference](#11-complete-api-reference)
12. [Step-by-Step Build Order](#12-step-by-step-build-order)

---

## 1. Project Overview

This is a full-stack electric bill invoice management system for a single admin. It lets you:

- Store customer information (name, address, meter number)
- Configure the per-unit electricity rate in BDT
- Generate a professional A4 invoice (customer copy + office copy on one page)
- Apply optional fines to the total
- Download invoices as PDF or print them
- Mark bills as paid/unpaid and download a "PAID" sealed version
- Customize invoice header/footer with a logo
- Protect everything behind an admin login

---

## 2. Folder Structure

```
electric-bill-app/
├── package.json                  ← root: runs both frontend build & backend
├── .env                          ← environment variables
├── server/
│   ├── index.js                  ← Express app entry point
│   ├── db.js                     ← MongoDB connection
│   ├── middleware/
│   │   └── auth.js               ← JWT verify middleware
│   ├── models/
│   │   ├── User.js               ← Admin user model
│   │   ├── Customer.js           ← Customer info model
│   │   ├── Config.js             ← Rate config model
│   │   ├── Invoice.js            ← Invoice model
│   │   └── InvoiceSettings.js    ← Header/footer/logo settings
│   └── routes/
│       ├── auth.js               ← POST /api/auth/login, /logout
│       ├── customers.js          ← CRUD /api/customers
│       ├── config.js             ← GET/PUT /api/config
│       ├── invoices.js           ← CRUD /api/invoices
│       └── settings.js           ← GET/PUT /api/settings (header/footer/logo)
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── api/
│       │   └── index.js          ← Axios instance with interceptors
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx     ← Tab shell
│       │   ├── tabs/
│       │   │   ├── CustomerTab.jsx
│       │   │   ├── ConfigTab.jsx
│       │   │   ├── GenerateTab.jsx
│       │   │   ├── AnalyzerTab.jsx
│       │   │   └── SettingsTab.jsx
│       └── components/
│           ├── InvoicePreview.jsx
│           ├── PaidSeal.jsx
│           └── ProtectedRoute.jsx
└── dist/                         ← built frontend (auto-generated, served by Express)
```

---

## 3. Prerequisites & Environment Setup

### Tools you need installed

- Node.js v18 or higher
- npm v9 or higher
- MongoDB (local or MongoDB Atlas free tier)

### Initial setup commands

```bash
mkdir electric-bill-app
cd electric-bill-app
npm init -y
mkdir server client
```

### Root `package.json`

```json
{
  "name": "electric-bill-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "node server/index.js",
    "build": "cd client && npm install && npm run build",
    "start": "npm run build && node server/index.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.0.3",
    "multer": "^1.4.5-lts.1"
  }
}
```

> **One command to run everything:** `npm start` builds the React app then serves it from Express.  
> During development, run `node server/index.js` and `cd client && npm run dev` in two terminals.

---

## 4. Backend Implementation

### 4.1 `.env` file (root)

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/electric_bill_db
JWT_SECRET=your_super_secret_key_change_this
CLIENT_URL=http://localhost:5173
```

---

### 4.2 `server/db.js`

```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

### 4.3 `server/index.js`

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' })); // higher limit for base64 logo uploads
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/config',    require('./routes/config'));
app.use('/api/invoices',  require('./routes/invoices'));
app.use('/api/settings',  require('./routes/settings'));

// Serve React build in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

### 4.4 Mongoose Models

#### `server/models/User.js`
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

#### `server/models/Customer.js`
```javascript
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  address:      { type: String, required: true, trim: true },
  meterNo:      { type: String, required: true, unique: true, trim: true },
  phone:        { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
```

#### `server/models/Config.js`
```javascript
const mongoose = require('mongoose');

// Only one config document will exist (singleton)
const configSchema = new mongoose.Schema({
  ratePerUnit:  { type: Number, required: true, default: 8.0 }, // BDT per kWh
  serviceCharge:{ type: Number, default: 0 },
  vatPercent:   { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
```

#### `server/models/Invoice.js`
```javascript
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNo:    { type: String, required: true, unique: true },
  customer:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  billMonth:    { type: String, required: true },  // e.g. "January 2025"
  previousReading: { type: Number, required: true },
  currentReading:  { type: Number, required: true },
  unitsConsumed:   { type: Number }, // auto-calculated
  ratePerUnit:     { type: Number, required: true },
  unitCharge:      { type: Number }, // auto-calculated
  serviceCharge:   { type: Number, default: 0 },
  fine:            { type: Number, default: 0 },   // manual fine input
  fineNote:        { type: String, default: '' },
  vatPercent:      { type: Number, default: 0 },
  vatAmount:       { type: Number, default: 0 },
  totalAmount:     { type: Number }, // auto-calculated
  status:          { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  paidAt:          { type: Date },
  issueDate:       { type: Date, default: Date.now },
  dueDate:         { type: Date },
}, { timestamps: true });

// Auto-calculate before save
invoiceSchema.pre('save', function(next) {
  this.unitsConsumed = this.currentReading - this.previousReading;
  this.unitCharge = this.unitsConsumed * this.ratePerUnit;
  const subtotal = this.unitCharge + this.serviceCharge + this.fine;
  this.vatAmount = (subtotal * this.vatPercent) / 100;
  this.totalAmount = subtotal + this.vatAmount;
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
```

#### `server/models/InvoiceSettings.js`
```javascript
const mongoose = require('mongoose');

// Singleton document for invoice header/footer customization
const settingsSchema = new mongoose.Schema({
  companyName:    { type: String, default: 'Electric Utility Company' },
  companyAddress: { type: String, default: '' },
  companyPhone:   { type: String, default: '' },
  companyEmail:   { type: String, default: '' },
  logoBase64:     { type: String, default: '' }, // base64 encoded image
  logoMimeType:   { type: String, default: 'image/png' },
  footerText:     { type: String, default: 'Thank you for paying your bill on time.' },
  invoiceTitle:   { type: String, default: 'ELECTRICITY BILL' },
}, { timestamps: true });

module.exports = mongoose.model('InvoiceSettings', settingsSchema);
```

---

### 4.5 `server/middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
```

---

### 4.6 API Routes

#### `server/routes/auth.js`
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/setup  ← only use once to create initial admin
router.post('/setup', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      return res.status(403).json({ message: 'Admin already exists' });
    }
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    res.json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

#### `server/routes/customers.js`
```javascript
const express = require('express');
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Meter number already exists' });
    }
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

#### `server/routes/config.js`
```javascript
const express = require('express');
const Config = require('../models/Config');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET /api/config
router.get('/', async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = await new Config({}).save();
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/config
router.put('/', async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = new Config(req.body);
    } else {
      Object.assign(config, req.body);
    }
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
```

#### `server/routes/invoices.js`
```javascript
const express = require('express');
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Auto-generate invoice number: INV-YYYYMM-XXXX
async function generateInvoiceNo() {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const count = await Invoice.countDocuments();
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// GET /api/invoices  (with optional filters: status, customerId)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customer = req.query.customerId;

    const invoices = await Invoice.find(filter)
      .populate('customer')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNo();
    const invoice = new Invoice({ ...req.body, invoiceNo });
    await invoice.save();
    const populated = await Invoice.findById(invoice._id).populate('customer');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/invoices/:id/status  — mark paid or unpaid
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'paid') update.paidAt = new Date();
    else update.paidAt = null;

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, { new: true }).populate('customer');
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

#### `server/routes/settings.js`
```javascript
const express = require('express');
const InvoiceSettings = require('../models/InvoiceSettings');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let settings = await InvoiceSettings.findOne();
    if (!settings) settings = await new InvoiceSettings({}).save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings  — accepts JSON with optional logoBase64
router.put('/', async (req, res) => {
  try {
    let settings = await InvoiceSettings.findOne();
    if (!settings) {
      settings = new InvoiceSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
```

---

## 5. Frontend Implementation

### 5.1 `client/package.json`

```json
{
  "name": "electric-bill-client",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev":   "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
```

---

### 5.2 `client/vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist',  // output goes to root/dist, served by Express
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000', // dev proxy to Express
    },
  },
});
```

---

### 5.3 `client/src/api/index.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

---

### 5.4 `client/src/context/AuthContext.jsx`

```jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  const login = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, login, logout, isAuth: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

### 5.5 `client/src/main.jsx`

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
```

---

### 5.6 `client/src/App.jsx`

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
    </Routes>
  );
}
```

---

### 5.7 Pages

#### `client/src/pages/Login.jsx`

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      login(res.data.token, res.data.username);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.title}>⚡ Electric Bill System</h2>
        <p style={styles.subtitle}>Admin Login</p>
        {error && <p style={styles.error}>{error}</p>}
        <input
          style={styles.input}
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button style={styles.button} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#f0f4f8' },
  form: { background:'#fff', padding:'2rem', borderRadius:'8px', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', width:'320px', display:'flex', flexDirection:'column', gap:'1rem' },
  title: { margin:0, textAlign:'center', color:'#1a202c' },
  subtitle: { margin:0, textAlign:'center', color:'#718096', fontSize:'0.9rem' },
  input: { padding:'0.75rem', border:'1px solid #e2e8f0', borderRadius:'4px', fontSize:'1rem' },
  button: { padding:'0.75rem', background:'#3182ce', color:'#fff', border:'none', borderRadius:'4px', fontSize:'1rem', cursor:'pointer' },
  error: { color:'#e53e3e', fontSize:'0.85rem', textAlign:'center' },
};
```

#### `client/src/pages/Dashboard.jsx`

```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CustomerTab from './tabs/CustomerTab';
import ConfigTab from './tabs/ConfigTab';
import GenerateTab from './tabs/GenerateTab';
import AnalyzerTab from './tabs/AnalyzerTab';
import SettingsTab from './tabs/SettingsTab';

const TABS = [
  { id: 'customers', label: '👥 Customers' },
  { id: 'config',    label: '⚙️ Config' },
  { id: 'generate',  label: '📄 Generate Bill' },
  { id: 'analyzer',  label: '📊 Bill Analyzer' },
  { id: 'settings',  label: '🎨 Invoice Settings' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('customers');
  const { username, logout } = useAuth();

  const renderTab = () => {
    switch (activeTab) {
      case 'customers': return <CustomerTab />;
      case 'config':    return <ConfigTab />;
      case 'generate':  return <GenerateTab />;
      case 'analyzer':  return <AnalyzerTab />;
      case 'settings':  return <SettingsTab />;
    }
  };

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.logo}>⚡ Electric Bill System</span>
        <div style={styles.headerRight}>
          <span style={styles.user}>👤 {username}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <nav style={styles.nav}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...styles.navBtn, ...(activeTab === tab.id ? styles.navBtnActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {renderTab()}
      </main>
    </div>
  );
}

const styles = {
  shell: { minHeight:'100vh', background:'#f7fafc', display:'flex', flexDirection:'column' },
  header: { background:'#1a365d', color:'#fff', padding:'1rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  logo: { fontSize:'1.2rem', fontWeight:'bold' },
  headerRight: { display:'flex', alignItems:'center', gap:'1rem' },
  user: { fontSize:'0.9rem', opacity:0.8 },
  logoutBtn: { padding:'0.4rem 0.8rem', background:'transparent', border:'1px solid rgba(255,255,255,0.5)', color:'#fff', borderRadius:'4px', cursor:'pointer' },
  nav: { background:'#2d3748', display:'flex', gap:'0', overflowX:'auto' },
  navBtn: { padding:'0.75rem 1.2rem', background:'transparent', border:'none', color:'#a0aec0', cursor:'pointer', whiteSpace:'nowrap', borderBottom:'3px solid transparent', transition:'all 0.2s' },
  navBtnActive: { color:'#fff', borderBottomColor:'#63b3ed', background:'rgba(255,255,255,0.05)' },
  main: { flex:1, padding:'2rem', maxWidth:'1200px', margin:'0 auto', width:'100%', boxSizing:'border-box' },
};
```

---

### 5.8 Tab: `CustomerTab.jsx`

```jsx
import { useState, useEffect } from 'react';
import api from '../../api';

export default function CustomerTab() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name:'', address:'', meterNo:'', phone:'' });
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/customers');
    setCustomers(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        setMsg('Customer updated!');
      } else {
        await api.post('/customers', form);
        setMsg('Customer added!');
      }
      setForm({ name:'', address:'', meterNo:'', phone:'' });
      setEditingId(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error saving customer');
    }
  };

  const handleEdit = (c) => {
    setForm({ name:c.name, address:c.address, meterNo:c.meterNo, phone:c.phone||'' });
    setEditingId(c._id);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return;
    await api.delete(`/customers/${id}`);
    load();
  };

  return (
    <div>
      <h2>Customer Management</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background:'#fff', padding:'1.5rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', marginBottom:'2rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <h3 style={{ gridColumn:'1/-1', margin:0 }}>{editingId ? 'Edit Customer' : 'Add Customer'}</h3>
        {msg && <p style={{ gridColumn:'1/-1', color: msg.includes('Error') || msg.includes('exists') ? '#e53e3e' : '#38a169', margin:0 }}>{msg}</p>}

        {[['name','Full Name'],['address','Address'],['meterNo','Meter Number'],['phone','Phone (optional)']].map(([field, label]) => (
          <div key={field} style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
            <label style={{ fontSize:'0.85rem', fontWeight:'600', color:'#4a5568' }}>{label}</label>
            <input
              value={form[field]}
              onChange={e => setForm({...form, [field]: e.target.value})}
              required={field !== 'phone'}
              style={{ padding:'0.6rem', border:'1px solid #e2e8f0', borderRadius:'4px' }}
            />
          </div>
        ))}

        <div style={{ gridColumn:'1/-1', display:'flex', gap:'0.5rem' }}>
          <button type="submit" style={{ padding:'0.6rem 1.2rem', background:'#3182ce', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer' }}>
            {editingId ? 'Update' : 'Add Customer'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm({ name:'', address:'', meterNo:'', phone:'' }); }}
              style={{ padding:'0.6rem 1.2rem', background:'#a0aec0', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#ebf8ff' }}>
              {['Name','Address','Meter No','Phone','Actions'].map(h => (
                <th key={h} style={{ padding:'0.75rem 1rem', textAlign:'left', fontSize:'0.8rem', fontWeight:'700', color:'#2d3748', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c._id} style={{ borderTop:'1px solid #e2e8f0' }}>
                <td style={{ padding:'0.75rem 1rem' }}>{c.name}</td>
                <td style={{ padding:'0.75rem 1rem', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.address}</td>
                <td style={{ padding:'0.75rem 1rem', fontFamily:'monospace' }}>{c.meterNo}</td>
                <td style={{ padding:'0.75rem 1rem' }}>{c.phone || '-'}</td>
                <td style={{ padding:'0.75rem 1rem', display:'flex', gap:'0.5rem' }}>
                  <button onClick={() => handleEdit(c)} style={{ padding:'0.3rem 0.6rem', background:'#f6ad55', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem' }}>Edit</button>
                  <button onClick={() => handleDelete(c._id)} style={{ padding:'0.3rem 0.6rem', background:'#fc8181', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem' }}>Delete</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} style={{ padding:'2rem', textAlign:'center', color:'#a0aec0' }}>No customers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### 5.9 Tab: `ConfigTab.jsx`

```jsx
import { useState, useEffect } from 'react';
import api from '../../api';

export default function ConfigTab() {
  const [config, setConfig] = useState({ ratePerUnit:8, serviceCharge:0, vatPercent:0 });
  const [previewUnits, setPreviewUnits] = useState(100);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/config').then(res => setConfig(res.data));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/config', config);
      setConfig(res.data);
      setMsg('Configuration saved!');
    } catch (err) {
      setMsg('Error saving configuration');
    }
  };

  // Live preview calculation
  const unitCharge = previewUnits * config.ratePerUnit;
  const subtotal = unitCharge + Number(config.serviceCharge);
  const vat = (subtotal * config.vatPercent) / 100;
  const total = subtotal + vat;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem' }}>
      <div>
        <h2>Rate Configuration</h2>
        <form onSubmit={handleSave} style={{ background:'#fff', padding:'1.5rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:'1rem' }}>
          {msg && <p style={{ color:'#38a169', margin:0 }}>{msg}</p>}

          <label style={labelStyle}>
            Rate per Unit (BDT / kWh)
            <input type="number" min="0" step="0.01" value={config.ratePerUnit}
              onChange={e => setConfig({...config, ratePerUnit: parseFloat(e.target.value)})}
              style={inputStyle} required />
          </label>

          <label style={labelStyle}>
            Service Charge (BDT, fixed)
            <input type="number" min="0" step="0.01" value={config.serviceCharge}
              onChange={e => setConfig({...config, serviceCharge: parseFloat(e.target.value)})}
              style={inputStyle} />
          </label>

          <label style={labelStyle}>
            VAT (%)
            <input type="number" min="0" max="100" step="0.1" value={config.vatPercent}
              onChange={e => setConfig({...config, vatPercent: parseFloat(e.target.value)})}
              style={inputStyle} />
          </label>

          <button type="submit" style={{ padding:'0.75rem', background:'#3182ce', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'600' }}>
            Save Configuration
          </button>
        </form>
      </div>

      {/* Live Preview */}
      <div>
        <h2>Bill Preview Calculator</h2>
        <div style={{ background:'#fff', padding:'1.5rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
          <label style={labelStyle}>
            Units consumed (preview)
            <input type="number" value={previewUnits} onChange={e => setPreviewUnits(Number(e.target.value))} style={inputStyle} />
          </label>
          <hr style={{ margin:'1rem 0', borderColor:'#e2e8f0' }} />
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            {[
              ['Units Consumed', `${previewUnits} kWh`],
              [`Rate per Unit`, `৳ ${config.ratePerUnit}`],
              [`Unit Charge`, `৳ ${unitCharge.toFixed(2)}`],
              [`Service Charge`, `৳ ${Number(config.serviceCharge).toFixed(2)}`],
              [`VAT (${config.vatPercent}%)`, `৳ ${vat.toFixed(2)}`],
            ].map(([k,v]) => (
              <tr key={k}>
                <td style={{ padding:'0.4rem 0', color:'#718096' }}>{k}</td>
                <td style={{ padding:'0.4rem 0', textAlign:'right', fontFamily:'monospace' }}>{v}</td>
              </tr>
            ))}
            <tr style={{ borderTop:'2px solid #e2e8f0' }}>
              <td style={{ padding:'0.6rem 0', fontWeight:'700', fontSize:'1.1rem' }}>Total</td>
              <td style={{ padding:'0.6rem 0', textAlign:'right', fontWeight:'700', fontSize:'1.1rem', color:'#2b6cb0' }}>৳ {total.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display:'flex', flexDirection:'column', gap:'0.25rem', fontSize:'0.9rem', fontWeight:'600', color:'#4a5568' };
const inputStyle = { padding:'0.6rem', border:'1px solid #e2e8f0', borderRadius:'4px', fontSize:'1rem', fontWeight:'400' };
```

---

### 5.10 Tab: `GenerateTab.jsx`

```jsx
import { useState, useEffect } from 'react';
import api from '../../api';
import { generateInvoicePDF } from '../../utils/pdfGenerator';

export default function GenerateTab() {
  const [customers, setCustomers] = useState([]);
  const [config, setConfig]       = useState({});
  const [settings, setSettings]   = useState({});
  const [form, setForm] = useState({
    customerId: '', billMonth: '', previousReading: '', currentReading: '',
    fine: 0, fineNote: '', dueDate: ''
  });
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/config'),
      api.get('/settings'),
    ]).then(([c, cf, s]) => {
      setCustomers(c.data);
      setConfig(cf.data);
      setSettings(s.data);
    });
  }, []);

  // Live calculation preview
  useEffect(() => {
    if (!form.previousReading || !form.currentReading || !config.ratePerUnit) return;
    const units = Number(form.currentReading) - Number(form.previousReading);
    if (units < 0) return;
    const unitCharge = units * config.ratePerUnit;
    const subtotal = unitCharge + Number(config.serviceCharge || 0) + Number(form.fine || 0);
    const vatAmount = (subtotal * (config.vatPercent || 0)) / 100;
    const total = subtotal + vatAmount;
    setPreview({ units, unitCharge, vatAmount, total });
  }, [form.previousReading, form.currentReading, form.fine, config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/invoices', {
        customer: form.customerId,
        billMonth: form.billMonth,
        previousReading: Number(form.previousReading),
        currentReading: Number(form.currentReading),
        ratePerUnit: config.ratePerUnit,
        serviceCharge: config.serviceCharge || 0,
        vatPercent: config.vatPercent || 0,
        fine: Number(form.fine || 0),
        fineNote: form.fineNote,
        dueDate: form.dueDate || null,
      });
      setMsg(`Invoice ${res.data.invoiceNo} created!`);

      // Auto-download PDF
      generateInvoicePDF(res.data, settings);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error creating invoice');
    }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem' }}>
      <div>
        <h2>Generate New Bill</h2>
        <form onSubmit={handleSubmit} style={{ background:'#fff', padding:'1.5rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:'1rem' }}>
          {msg && <p style={{ color: msg.includes('Error') ? '#e53e3e' : '#38a169', margin:0 }}>{msg}</p>}

          <label style={lbl}>
            Customer
            <select value={form.customerId} onChange={e => setForm({...form, customerId:e.target.value})} style={inp} required>
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c._id} value={c._id}>{c.name} — {c.meterNo}</option>)}
            </select>
          </label>

          <label style={lbl}>
            Bill Month (e.g. January 2025)
            <input value={form.billMonth} onChange={e => setForm({...form, billMonth:e.target.value})} style={inp} placeholder="January 2025" required />
          </label>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <label style={lbl}>
              Previous Reading (kWh)
              <input type="number" value={form.previousReading} onChange={e => setForm({...form, previousReading:e.target.value})} style={inp} required />
            </label>
            <label style={lbl}>
              Current Reading (kWh)
              <input type="number" value={form.currentReading} onChange={e => setForm({...form, currentReading:e.target.value})} style={inp} required />
            </label>
          </div>

          <label style={lbl}>
            Fine Amount (BDT — optional)
            <input type="number" min="0" step="0.01" value={form.fine}
              onChange={e => setForm({...form, fine:e.target.value})} style={inp} />
          </label>

          <label style={lbl}>
            Fine Note (optional)
            <input value={form.fineNote} onChange={e => setForm({...form, fineNote:e.target.value})} style={inp} placeholder="e.g. Late payment penalty" />
          </label>

          <label style={lbl}>
            Due Date
            <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate:e.target.value})} style={inp} />
          </label>

          <button type="submit" style={{ padding:'0.75rem', background:'#2f855a', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'600', fontSize:'1rem' }}>
            Generate & Download PDF
          </button>
        </form>
      </div>

      {/* Calculation Preview */}
      <div>
        <h2>Bill Summary</h2>
        {preview ? (
          <div style={{ background:'#fff', padding:'1.5rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              {[
                ['Units Consumed', `${preview.units} kWh`],
                [`Rate per Unit`, `৳ ${config.ratePerUnit}`],
                [`Unit Charge`, `৳ ${preview.unitCharge.toFixed(2)}`],
                [`Service Charge`, `৳ ${(config.serviceCharge||0).toFixed(2)}`],
                [`Fine`, `৳ ${Number(form.fine||0).toFixed(2)}`],
                [`VAT (${config.vatPercent}%)`, `৳ ${preview.vatAmount.toFixed(2)}`],
              ].map(([k,v]) => (
                <tr key={k}><td style={{ padding:'0.5rem 0', color:'#718096' }}>{k}</td><td style={{ textAlign:'right', fontFamily:'monospace' }}>{v}</td></tr>
              ))}
              <tr style={{ borderTop:'2px solid #e2e8f0' }}>
                <td style={{ padding:'0.75rem 0', fontWeight:'700', fontSize:'1.2rem' }}>Total Payable</td>
                <td style={{ textAlign:'right', fontWeight:'700', fontSize:'1.2rem', color:'#2b6cb0' }}>৳ {preview.total.toFixed(2)}</td>
              </tr>
            </table>
          </div>
        ) : (
          <div style={{ background:'#fff', padding:'2rem', borderRadius:'8px', color:'#a0aec0', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
            Enter meter readings to see bill summary
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { display:'flex', flexDirection:'column', gap:'0.25rem', fontSize:'0.85rem', fontWeight:'600', color:'#4a5568' };
const inp = { padding:'0.6rem', border:'1px solid #e2e8f0', borderRadius:'4px', fontSize:'0.95rem', fontWeight:'400' };
```

---

### 5.11 Tab: `AnalyzerTab.jsx`

```jsx
import { useState, useEffect } from 'react';
import api from '../../api';
import { generateInvoicePDF } from '../../utils/pdfGenerator';

export default function AnalyzerTab() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter]     = useState('all'); // all | paid | unpaid
  const [settings, setSettings] = useState({});

  const load = async () => {
    const [inv, s] = await Promise.all([api.get('/invoices'), api.get('/settings')]);
    setInvoices(inv.data);
    setSettings(s.data);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  const toggleStatus = async (inv) => {
    const newStatus = inv.status === 'paid' ? 'unpaid' : 'paid';
    await api.patch(`/invoices/${inv._id}/status`, { status: newStatus });
    load();
  };

  const handleDownload = (invoice, withSeal = false) => {
    generateInvoicePDF(invoice, settings, withSeal);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this invoice?')) return;
    await api.delete(`/invoices/${id}`);
    load();
  };

  // Summary stats
  const totalUnpaid = invoices.filter(i => i.status === 'unpaid').reduce((s,i) => s + i.totalAmount, 0);
  const totalPaid   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.totalAmount, 0);

  return (
    <div>
      <h2>Bill Analyzer</h2>

      {/* Stats cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'2rem' }}>
        {[
          { label:'Total Invoices', value: invoices.length, color:'#3182ce' },
          { label:'Paid (BDT)', value:`৳ ${totalPaid.toFixed(2)}`, color:'#38a169' },
          { label:'Unpaid (BDT)', value:`৳ ${totalUnpaid.toFixed(2)}`, color:'#e53e3e' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', padding:'1.25rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', borderLeft:`4px solid ${s.color}` }}>
            <div style={{ color:'#718096', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
            <div style={{ fontSize:'1.5rem', fontWeight:'700', color:s.color, marginTop:'0.25rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
        {['all','paid','unpaid'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'0.4rem 1rem', border:'1px solid #e2e8f0', borderRadius:'20px', cursor:'pointer', background: filter===f ? '#3182ce' : '#fff', color: filter===f ? '#fff' : '#4a5568', fontWeight: filter===f ? '600' : '400' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.9rem' }}>
          <thead>
            <tr style={{ background:'#ebf8ff' }}>
              {['Invoice No','Customer','Meter','Month','Total (BDT)','Status','Actions'].map(h => (
                <th key={h} style={{ padding:'0.75rem 1rem', textAlign:'left', fontSize:'0.75rem', fontWeight:'700', color:'#2d3748', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv._id} style={{ borderTop:'1px solid #e2e8f0' }}>
                <td style={{ padding:'0.6rem 1rem', fontFamily:'monospace', fontSize:'0.8rem' }}>{inv.invoiceNo}</td>
                <td style={{ padding:'0.6rem 1rem' }}>{inv.customer?.name}</td>
                <td style={{ padding:'0.6rem 1rem', fontFamily:'monospace', fontSize:'0.8rem' }}>{inv.customer?.meterNo}</td>
                <td style={{ padding:'0.6rem 1rem' }}>{inv.billMonth}</td>
                <td style={{ padding:'0.6rem 1rem', fontFamily:'monospace', fontWeight:'600' }}>৳ {inv.totalAmount?.toFixed(2)}</td>
                <td style={{ padding:'0.6rem 1rem' }}>
                  <span style={{ padding:'0.2rem 0.6rem', borderRadius:'12px', fontSize:'0.75rem', fontWeight:'600', background: inv.status==='paid' ? '#c6f6d5' : '#fed7d7', color: inv.status==='paid' ? '#22543d' : '#742a2a' }}>
                    {inv.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding:'0.6rem 1rem', display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                  <button onClick={() => handleDownload(inv, false)} style={btnSm('#3182ce')}>PDF</button>
                  {inv.status === 'paid' && (
                    <button onClick={() => handleDownload(inv, true)} style={btnSm('#2f855a')}>PAID PDF</button>
                  )}
                  <button onClick={() => toggleStatus(inv)} style={btnSm(inv.status==='paid' ? '#d69e2e' : '#38a169')}>
                    {inv.status==='paid' ? 'Unpaid' : 'Mark Paid'}
                  </button>
                  <button onClick={() => handleDelete(inv._id)} style={btnSm('#e53e3e')}>Del</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding:'2rem', textAlign:'center', color:'#a0aec0' }}>No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnSm = (bg) => ({ padding:'0.25rem 0.5rem', background:bg, color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'0.75rem', whiteSpace:'nowrap' });
```

---

### 5.12 Tab: `SettingsTab.jsx`

```jsx
import { useState, useEffect } from 'react';
import api from '../../api';

export default function SettingsTab() {
  const [form, setForm] = useState({
    companyName:'', companyAddress:'', companyPhone:'', companyEmail:'',
    logoBase64:'', logoMimeType:'image/png',
    footerText:'', invoiceTitle:'ELECTRICITY BILL'
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/settings').then(res => setForm(res.data));
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setForm(f => ({ ...f, logoBase64: base64, logoMimeType: file.type }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings', form);
      setMsg('Settings saved!');
    } catch {
      setMsg('Error saving settings');
    }
  };

  return (
    <div>
      <h2>Invoice Settings</h2>
      <form onSubmit={handleSave} style={{ background:'#fff', padding:'1.5rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', maxWidth:'700px' }}>
        {msg && <p style={{ gridColumn:'1/-1', color:'#38a169', margin:0 }}>{msg}</p>}

        {[
          ['invoiceTitle','Invoice Title'],['companyName','Company Name'],
          ['companyAddress','Company Address'],['companyPhone','Phone'],
          ['companyEmail','Email'],
        ].map(([field,label]) => (
          <label key={field} style={lbl}>
            {label}
            <input value={form[field]||''} onChange={e => setForm({...form,[field]:e.target.value})} style={inp} />
          </label>
        ))}

        <label style={{ ...lbl, gridColumn:'1/-1' }}>
          Footer Text
          <textarea value={form.footerText||''} onChange={e => setForm({...form,footerText:e.target.value})} style={{ ...inp, height:'80px', resize:'vertical' }} />
        </label>

        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>
            Company Logo (PNG/JPG)
            <input type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} style={{ fontSize:'0.9rem' }} />
          </label>
          {form.logoBase64 && (
            <img src={`data:${form.logoMimeType};base64,${form.logoBase64}`} alt="Logo preview"
              style={{ maxHeight:'80px', marginTop:'0.5rem', border:'1px solid #e2e8f0', borderRadius:'4px', padding:'4px' }} />
          )}
        </div>

        <div style={{ gridColumn:'1/-1' }}>
          <button type="submit" style={{ padding:'0.75rem 1.5rem', background:'#3182ce', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'600' }}>
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

const lbl = { display:'flex', flexDirection:'column', gap:'0.25rem', fontSize:'0.85rem', fontWeight:'600', color:'#4a5568' };
const inp = { padding:'0.6rem', border:'1px solid #e2e8f0', borderRadius:'4px', fontSize:'0.95rem', fontWeight:'400' };
```

---

## 6. Invoice PDF Layout Spec

### `client/src/utils/pdfGenerator.js`

This is the core function that creates the A4 PDF using jsPDF with two copies on one page.

```javascript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates an A4 invoice PDF with customer copy and office copy.
 * @param {Object} invoice  - Full invoice object (with populated customer)
 * @param {Object} settings - Invoice settings (logo, header, footer)
 * @param {boolean} withPaidSeal - Whether to stamp PAID seal
 */
export function generateInvoicePDF(invoice, settings, withPaidSeal = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // A4 = 210mm wide × 297mm tall
  // Draw TWO copies: top half (0–140mm) = customer copy, bottom half (148–297mm) = office copy
  // A dashed divider line at 148mm separates them

  drawCopy(doc, invoice, settings, withPaidSeal, 10,  'Customer Copy');
  
  // Dashed divider line
  doc.setLineDashPattern([3, 3], 0);
  doc.setDrawColor(150, 150, 150);
  doc.line(10, 148, 200, 148);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('✂  Cut here', 10, 151);
  doc.setTextColor(0);

  drawCopy(doc, invoice, settings, withPaidSeal, 155, 'Office Copy');

  const filename = `${invoice.invoiceNo}-${invoice.customer?.name?.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Draws one invoice copy starting at yStart mm from top.
 * Each copy is ~138mm tall to fit two on A4.
 */
function drawCopy(doc, invoice, settings, withPaidSeal, yStart, copyLabel) {
  const c = invoice.customer || {};
  const s = settings || {};
  const pageWidth = 210;
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;

  let y = yStart;

  // ── HEADER ──
  // Logo (if provided)
  if (s.logoBase64) {
    try {
      doc.addImage(
        `data:${s.logoMimeType || 'image/png'};base64,${s.logoBase64}`,
        s.logoMimeType?.includes('jpeg') ? 'JPEG' : 'PNG',
        margin, y, 25, 18
      );
    } catch (e) { /* skip bad logo */ }
  }

  // Company info
  const headerX = s.logoBase64 ? margin + 28 : margin;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 60, 120);
  doc.text(s.invoiceTitle || 'ELECTRICITY BILL', headerX, y + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(s.companyName || '', headerX, y + 12);
  doc.text(s.companyAddress || '', headerX, y + 17);

  // Copy label (top-right)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 180, 180);
  doc.text(copyLabel, pageWidth - margin, y + 6, { align: 'right' });

  // Thin horizontal rule
  y += 22;
  doc.setDrawColor(30, 60, 120);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ── INVOICE META (two columns) ──
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);

  const left = [
    [`Invoice No:`, invoice.invoiceNo],
    [`Bill Month:`, invoice.billMonth],
    [`Issue Date:`, new Date(invoice.issueDate).toLocaleDateString('en-BD')],
    [`Due Date:`,   invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-BD') : 'N/A'],
  ];
  const right = [
    [`Customer:`,  c.name],
    [`Address:`,   c.address],
    [`Meter No:`,  c.meterNo],
    [`Phone:`,     c.phone || 'N/A'],
  ];

  left.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold');  doc.text(k, margin, y + i * 6);
    doc.setFont('helvetica', 'normal'); doc.text(v || '', margin + 22, y + i * 6);
  });
  right.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold');  doc.text(k, 110, y + i * 6);
    doc.setFont('helvetica', 'normal'); doc.text(v || '', 125, y + i * 6);
  });

  y += 28;

  // ── BILL TABLE ──
  const rows = [
    ['Previous Reading', `${invoice.previousReading} kWh`],
    ['Current Reading',  `${invoice.currentReading} kWh`],
    ['Units Consumed',   `${invoice.unitsConsumed} kWh`],
    ['Rate per Unit',    `BDT ${invoice.ratePerUnit?.toFixed(2)}`],
    ['Unit Charge',      `BDT ${invoice.unitCharge?.toFixed(2)}`],
    ['Service Charge',   `BDT ${(invoice.serviceCharge || 0).toFixed(2)}`],
  ];

  if (invoice.fine > 0) {
    rows.push([`Fine${invoice.fineNote ? ` (${invoice.fineNote})` : ''}`, `BDT ${invoice.fine.toFixed(2)}`]);
  }
  if (invoice.vatPercent > 0) {
    rows.push([`VAT (${invoice.vatPercent}%)`, `BDT ${invoice.vatAmount?.toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Amount']],
    body: rows,
    foot: [['TOTAL PAYABLE', `BDT ${invoice.totalAmount?.toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [30, 60, 120], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: [235, 248, 255], textColor: [30, 60, 120], fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 70, halign: 'right' } },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
  });

  y = doc.lastAutoTable.finalY + 4;

  // ── FOOTER ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(s.footerText || '', margin, y + 4, { maxWidth: contentWidth });

  if (s.companyPhone || s.companyEmail) {
    doc.setFont('helvetica', 'normal');
    doc.text(`${s.companyPhone || ''}  ${s.companyEmail || ''}`.trim(), pageWidth - margin, y + 4, { align: 'right' });
  }

  // ── PAID SEAL ──
  if (withPaidSeal && invoice.status === 'paid') {
    drawPaidSeal(doc, pageWidth - 50, yStart + 55);
  }
}

/**
 * Draws a PAID stamp at the given position.
 */
function drawPaidSeal(doc, x, y) {
  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.25 }));
  doc.setDrawColor(0, 150, 0);
  doc.setLineWidth(1.5);
  doc.roundedRect(x - 18, y - 8, 36, 16, 2, 2, 'S');
  doc.setTextColor(0, 150, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID', x, y + 3, { align: 'center' });
  doc.restoreGraphicsState();
}
```

---

## 7. Paid Seal Logic

The `withPaidSeal = true` flag passed to `generateInvoicePDF` will:

1. Draw a semi-transparent green "PAID" rectangular stamp diagonally overlaid on the invoice (both copies)
2. The stamp uses `doc.saveGraphicsState()` / `doc.restoreGraphicsState()` with 25% opacity
3. The `paidAt` date can be added below the stamp text with `doc.setFontSize(7)` text

---

## 8. Admin Login System

### First-time Setup (Create Admin Account)

Since there's no registration UI (security), run this **once** after deployment via curl or Postman:

```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_secure_password"}'
```

Or add a one-time seed script `server/seed.js`:

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exists = await User.findOne({ username: 'admin' });
  if (exists) { console.log('Admin already exists'); process.exit(0); }
  await new User({ username: 'admin', password: 'ChangeMe123!' }).save();
  console.log('Admin created: admin / ChangeMe123!');
  process.exit(0);
}

seed().catch(console.error);
```

Run it with: `node server/seed.js`

**Then change the password immediately from the database or by adding a change-password endpoint.**

### JWT Token Flow

1. User POSTs to `/api/auth/login` → receives JWT token (24h expiry)
2. React stores token in `localStorage`
3. Every API call includes `Authorization: Bearer <token>` header
4. Express middleware (`server/middleware/auth.js`) validates the token on every protected route
5. On 401 response, Axios interceptor clears localStorage and redirects to `/login`

---

## 9. cPanel Deployment Guide

### Step 1: Build the project locally

```bash
npm run build
```

This creates `dist/` directory with the compiled React app.

### Step 2: Prepare files for upload

Zip the following for upload (exclude `node_modules` and `client/`):

```
electric-bill-app/
├── package.json
├── .env                 ← edit with production values
├── server/
└── dist/                ← built frontend
```

### Step 3: cPanel Node.js Setup

1. Log into cPanel → find **"Setup Node.js App"** (or similar)
2. Create new app:
   - **Node.js version**: 18.x or higher
   - **Application mode**: Production
   - **Application root**: `/home/yourusername/electric-bill-app`
   - **Application URL**: your domain or subdomain
   - **Application startup file**: `server/index.js`
3. Set environment variables in cPanel's interface:
   - `PORT` = 3000 (cPanel manages the port)
   - `MONGODB_URI` = your Atlas URI
   - `JWT_SECRET` = long random string
4. Click **"Run NPM Install"** in cPanel
5. Start the app

### Step 4: MongoDB Atlas (Free tier)

1. Create account at mongodb.com/atlas
2. Create free M0 cluster
3. Whitelist `0.0.0.0/0` (all IPs) or your server's IP
4. Create a database user
5. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/electric_bill_db`
6. Set as `MONGODB_URI` in your `.env`

### Step 5: Run seed script on server

```bash
node server/seed.js
```

(Only once, to create admin account)

---

## 10. Environment Variables Reference

| Variable | Example | Description |
|---|---|---|
| `PORT` | `3000` | Express server port |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB connection string |
| `JWT_SECRET` | `abc123xyz...` | Secret for signing JWT tokens — use a long random string |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin (dev only; remove for production) |

---

## 11. Complete API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | ❌ | Login with username/password |
| POST | `/api/auth/setup` | ❌ | Create first admin (one-time only) |
| GET | `/api/customers` | ✅ | List all customers |
| POST | `/api/customers` | ✅ | Create customer |
| PUT | `/api/customers/:id` | ✅ | Update customer |
| DELETE | `/api/customers/:id` | ✅ | Delete customer |
| GET | `/api/config` | ✅ | Get rate configuration |
| PUT | `/api/config` | ✅ | Update rate configuration |
| GET | `/api/invoices` | ✅ | List invoices (filter: `?status=paid\|unpaid&customerId=`) |
| GET | `/api/invoices/:id` | ✅ | Get single invoice |
| POST | `/api/invoices` | ✅ | Create invoice |
| PATCH | `/api/invoices/:id/status` | ✅ | Update invoice status (paid/unpaid) |
| DELETE | `/api/invoices/:id` | ✅ | Delete invoice |
| GET | `/api/settings` | ✅ | Get invoice header/footer settings |
| PUT | `/api/settings` | ✅ | Update invoice settings (including logo base64) |

---

## 12. Step-by-Step Build Order

Follow this exact order to avoid errors:

```
1.  mkdir electric-bill-app && cd electric-bill-app
2.  npm init -y
3.  npm install express mongoose bcryptjs jsonwebtoken cors dotenv multer
4.  Create .env with PORT, MONGODB_URI, JWT_SECRET
5.  Create server/db.js
6.  Create server/index.js
7.  Create all 5 models in server/models/
8.  Create server/middleware/auth.js
9.  Create all 5 routes in server/routes/
10. Test backend: node server/index.js  →  visit http://localhost:3000/api/config (should get 401)
11. mkdir client && cd client
12. npm create vite@latest . -- --template react
13. npm install axios jspdf jspdf-autotable react-router-dom
14. Set up vite.config.js with proxy and outDir
15. Create client/src/api/index.js
16. Create AuthContext.jsx
17. Create main.jsx and App.jsx
18. Create Login.jsx page
19. Create Dashboard.jsx with tab shell
20. Create all 5 tab components
21. Create client/src/utils/pdfGenerator.js
22. Test frontend: npm run dev  →  visit http://localhost:5173
23. Run node server/seed.js to create admin
24. Login and test all features
25. npm run build (from root) to compile frontend into dist/
26. Deploy dist/ + server/ to cPanel
```

---

## Notes for AI Model Building This

- The **PDF is generated entirely on the frontend** using jsPDF. No server-side PDF generation is needed. The invoice data is fetched from the API and rendered in the browser.
- The **logo is stored as base64** in MongoDB. For larger deployments consider storing it on disk, but base64 works fine for a single logo image.
- The **two copies on one page** are drawn by calling `drawCopy()` twice with different `yStart` values (10mm and 155mm).
- The **PAID seal** uses jsPDF's graphics state to apply opacity. If the jsPDF version doesn't support `GState`, use `doc.setTextColor` with low values and skip the rectangle stroke, just drawing the text rotated diagonally.
- The **print button** in the frontend should call `window.print()` after generating the PDF in a hidden iframe, or use jsPDF's `doc.autoPrint()` followed by `doc.output('dataurlnewwindow')`.
- All **BDT amounts** should use the `৳` symbol (U+09F3, Bengali Taka sign). In jsPDF this may not render with the default font — fallback to "BDT" text if the symbol doesn't display.
- For **print button**: add a print-specific CSS `@media print` that hides the nav and only shows the invoice preview div, then call `window.print()`.
- Always **populate the customer** field when fetching invoices (`Invoice.find().populate('customer')`) so the PDF generator has access to name/address/meter number.

---

*End of Implementation Plan*
