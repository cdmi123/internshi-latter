const mongoose = require('mongoose');
const Internship = require('../models/Internship');
const Logbook = require('../models/Logbook');

module.exports = async (req, res, next) => {
    const branch = req.session.branch;
    if (!branch) {
        res.locals.branch = null;
        return next();
    }

    res.locals.branch = branch;
    const recordId = req.params.id;
    if (!recordId) return next();
    if (!mongoose.Types.ObjectId.isValid(recordId)) {
        return res.status(404).send('Record not found');
    }

    try {
        let internship;
        if (/^\/logbook-manage\/(?:edit|delete)\//.test(req.path)) {
            const entry = await Logbook.findById(recordId).select('internshipId');
            if (!entry) return res.status(404).send('Logbook entry not found');
            internship = await Internship.findById(entry.internshipId).select('branch');
        } else {
            internship = await Internship.findById(recordId).select('branch');
        }

        if (!internship) return res.status(404).send('Internship not found');
        if (internship.branch !== branch) {
            return res.status(404).send('Record not found');
        }

        next();
    } catch (err) {
        console.error('Branch access check failed:', err);
        res.status(500).send('Server Error');
    }
};
