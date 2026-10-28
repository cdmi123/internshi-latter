const mongoose = require('mongoose');
const Internship = require('../models/Internship');
const Logbook = require('../models/Logbook');

module.exports = async (req, res, next) => {
    const isFeeApiRequest = req.path.startsWith('/fees/');
    const sendNotFound = (message) => isFeeApiRequest
        ? res.status(404).json({ success: false, error: message })
        : res.status(404).send(message);
    const branch = req.session.branch;
    if (!branch) {
        res.locals.branch = null;
        return next();
    }

    res.locals.branch = branch;
    const recordId = req.params.id;
    if (!recordId) return next();
    if (!mongoose.Types.ObjectId.isValid(recordId)) {
        return sendNotFound('Record not found');
    }

    try {
        let internship;
        if (/^\/logbook-manage\/(?:edit|delete)\//.test(req.path)) {
            const entry = await Logbook.findById(recordId).select('internshipId');
            if (!entry) return sendNotFound('Logbook entry not found');
            internship = await Internship.findById(entry.internshipId).select('branch');
        } else {
            internship = await Internship.findById(recordId).select('branch');
        }

        if (!internship) return sendNotFound('Internship not found');
        if (internship.branch !== branch) {
            return sendNotFound('Record not found');
        }

        next();
    } catch (err) {
        console.error('Branch access check failed:', err);
        if (isFeeApiRequest) {
            return res.status(500).json({ success: false, error: 'Unable to verify branch access.' });
        }
        res.status(500).send('Server Error');
    }
};
