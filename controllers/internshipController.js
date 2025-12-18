const Internship = require('../models/Internship');

// Get all internships with stats
exports.getAllInternships = async (req, res) => {
    try {
        const internships = await Internship.find().sort({ date: -1 });

        // Calculate Stats
        const stats = {
            total: internships.length,
            shift6: internships.filter(i => i.workingTime === '6 hrs/day').length,
            shift4: internships.filter(i => i.workingTime === '4 hrs/day').length
        };

        res.render('view-internships', {
            title: 'Internship List',
            internships: internships,
            stats: stats
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// View Internship Letter
exports.viewInternship = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }
        res.render('view-letter', {
            internship: internship
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// ... (Rest of the controller functions remain same, just exporting them again)
exports.getAddForm = (req, res) => {
    res.render('add-internship', {
        title: 'Add Internship',
        error: null,
        formData: {}
    });
};

exports.createInternship = async (req, res) => {
    try {
        const newInternship = new Internship(req.body);
        await newInternship.save();
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.render('add-internship', {
            title: 'Add Internship',
            error: 'Error saving data. Please check inputs.',
            formData: req.body
        });
    }
};

exports.getEditForm = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }
        res.render('edit-internship', {
            title: 'Edit Internship',
            internship: internship,
            error: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.updateInternship = async (req, res) => {
    try {
        await Internship.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        const internship = await Internship.findById(req.params.id);
        res.render('edit-internship', {
            title: 'Edit Internship',
            internship: internship,
            error: 'Error updating data.'
        });
    }
};

exports.deleteInternship = async (req, res) => {
    try {
        await Internship.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
