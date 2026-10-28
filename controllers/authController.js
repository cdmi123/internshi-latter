const User = require('../models/User');

exports.getLoginForm = (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', {
        title: 'Staff Login',
        error: null
    });
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await user.comparePassword(password))) {
            return res.render('login', {
                title: 'Staff Login',
                error: 'Invalid username or password'
            });
        }

        req.session.userId = user._id;
        req.session.branch = user.branch || null;
        req.session.username = user.username;
        req.session.save((err) => {
            if (err) {
                console.error('Error saving login session:', err);
                return res.status(500).render('login', {
                    title: 'Staff Login',
                    error: 'Unable to start your session. Please try again.'
                });
            }
            res.redirect('/');
        });
    } catch (err) {
        console.error('Login error:', err);
        res.render('login', {
            title: 'Staff Login',
            error: 'An error occurred. Please try again.'
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
};
