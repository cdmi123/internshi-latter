const User = require('../models/User');

module.exports = async (req, res, next) => {
    const isFeeApiRequest = req.path.startsWith('/fees/');
    if (!req.session.userId) {
        if (isFeeApiRequest) {
            return res.status(401).json({ success: false, error: 'Your staff session has expired. Please sign in again.' });
        }
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.userId).select('branch username');
        if (!user) {
            req.session.destroy(() => {
                if (isFeeApiRequest) {
                    return res.status(401).json({ success: false, error: 'Your staff session has expired. Please sign in again.' });
                }
                return res.redirect('/login');
            });
            return;
        }

        req.session.branch = user.branch || null;
        req.session.username = user.username;
        res.locals.branch = req.session.branch;
        next();
    } catch (err) {
        console.error('Authentication check failed:', err);
        if (isFeeApiRequest) {
            return res.status(500).json({ success: false, error: 'Unable to verify your account.' });
        }
        res.status(500).send('Unable to verify your account.');
    }
};
