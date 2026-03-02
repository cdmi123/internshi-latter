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
        res.redirect('/');
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
