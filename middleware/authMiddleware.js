const User = require('../models/User');

module.exports = async (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.userId).select('branch username');
        if (!user) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        req.session.branch = user.branch || null;
        req.session.username = user.username;
        res.locals.branch = req.session.branch;
        next();
    } catch (err) {
        console.error('Authentication check failed:', err);
        res.status(500).send('Unable to verify your account.');
    }
};
