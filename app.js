const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');
const internshipRoutes = require('./routes/internshipRoutes');
const User = require('./models/User');

// Initialize Express
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Session
app.use(session({
    secret: 'secret-key-for-internship-app',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Global variable for template
app.use((req, res, next) => {
    res.locals.userId = req.session.userId;
    next();
});

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', internshipRoutes);

// Seed Admin User
const seedAdmin = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const admin = new User({
                username: 'admin',
                password: 'admin@0320'
            });
            await admin.save();
            console.log('Admin user seeded successfully');
        }
    } catch (err) {
        console.error('Error seeding admin user:', err);
    }
};
seedAdmin();

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
