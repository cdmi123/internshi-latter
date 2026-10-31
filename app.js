require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');
const internshipRoutes = require('./routes/internshipRoutes');
const User = require('./models/User');
const getBranchAddress = require('./utils/branchAddresses');

// Initialize Express
const app = express();
app.locals.getBranchAddress = getBranchAddress;

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
    res.locals.branch = req.session.branch || null;
    next();
});

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', internshipRoutes);

// Seed Admin User
const seedAdmin = async () => {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
        const admin = new User({
            username: 'admin',
            password: 'admin@0320'
        });
        await admin.save();
        console.log('Admin user seeded successfully');
    }
};

const seedBranchAccounts = async () => {
    const branchAccounts = require('./config/branchAccounts');
    const configuredAccounts = branchAccounts.filter(account => account.password);
    const missingBranches = branchAccounts
        .filter(account => !account.password)
        .map(account => account.branch);

    if (missingBranches.length > 0) {
        console.warn(
            `Branch accounts not configured (set their password environment variables): ${missingBranches.join(', ')}`
        );
    }

    for (const account of configuredAccounts) {
        let user = await User.findOne({ username: account.username });
        if (!user) {
            user = new User({
                username: account.username,
                password: account.password,
                branch: account.branch
            });
        } else {
            if (user.branch !== account.branch) user.branch = account.branch;
            if (!(await user.comparePassword(account.password))) {
                user.password = account.password;
            }
        }
        await user.save();
    }
    if (configuredAccounts.length > 0) {
        console.log(`Configured ${configuredAccounts.length} branch account(s)`);
    }
};

const startServer = async () => {
    try {
        await connectDB();
        await seedAdmin();
        await seedBranchAccounts();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Application startup failed:', err);
        process.exit(1);
    }
};

startServer();
