const Internship = require('../models/Internship');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Get all internships with stats
exports.getAllInternships = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const totalRecords = await Internship.countDocuments({ status: { $ne: 'deleted' } });
        const internships = await Internship.find({ status: { $ne: 'deleted' } })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalRecords / limit);

        // Calculate Stats for all active records (not just current page)
        const allActiveInternships = await Internship.find({ status: { $ne: 'deleted' } });
        const stats = {
            total: totalRecords,
            shift6: allActiveInternships.filter(i => i.workingTime === '6 hrs/day').length,
            shift4: allActiveInternships.filter(i => i.workingTime === '4 hrs/day').length
        };

        res.render('view-internships', {
            title: 'Internship List',
            internships: internships,
            stats: stats,
            currentPage: page,
            totalPages: totalPages,
            limit: limit
        });
    } catch (err) {
        console.error("Error in getAllInternships:", err);
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

// View Internship Ending Letter
exports.viewEndingLetter = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }
        res.render('view-ending-letter', {
            internship: internship
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

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

exports.updateMarks = async (req, res) => {
    try {
        const { marks, grade } = req.body;
        await Internship.findByIdAndUpdate(req.params.id, { marks, grade });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.deleteInternship = async (req, res) => {
    try {
        await Internship.findByIdAndUpdate(req.params.id, { status: 'deleted' });
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.uploadExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const filePath = req.file.path;
        console.log("Processing file:", filePath);

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).send('Excel file is empty.');
        }

        const internships = data.map(row => {
            let wTime = (row['Working Time'] || row['workingTime'] || '6 hrs/day').toString().toLowerCase().trim();
            // Check if it matches allowed patterns
            if (wTime.includes('6')) wTime = '6 hrs/day';
            else if (wTime.includes('4')) wTime = '4 hrs/day';
            else wTime = ''; // Mark as invalid for filtering

            return {
                startDate: row['Starting Date'] || row['startDate'] || '',
                duration: row['Duration'] || row['duration'] || '',
                endingDate: row['Ending Date'] || row['endingDate'] || '',
                studentName: row['Student Name'] || row['studentName'] || '',
                collegeName: row['College Name'] || row['collegeName'] || '',
                address: row['Full Address'] || row['address'] || '',
                internshipPosition: row['Internship Position'] || row['internshipPosition'] || '',
                workingTime: wTime,
                studentContactNo: row['Student Contact No'] || row['studentContactNo'] || '',
                internFacultyName: row['Faculty Name'] || row['internFacultyName'] || '',
                facultyContactNo: row['Faculty Contact No'] || row['facultyContactNo'] || '',
                branch: (row['Branch'] || row['branch'] || 'yogichowk').toLowerCase().trim(),
                status: 'active'
            };
        });

        // Validation - ensure required fields are present and workingTime is valid
        const validInternships = internships.filter(i =>
            i.studentName && i.startDate && i.duration && i.branch && (i.workingTime === '6 hrs/day' || i.workingTime === '4 hrs/day')
        );

        console.log(`Found ${internships.length} rows, ${validInternships.length} valid.`);

        if (validInternships.length > 0) {
            await Internship.insertMany(validInternships);
        }

        // Delete the uploaded file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.redirect('/');
    } catch (err) {
        console.error("Error in uploadExcel:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).send('Error processing Excel file: ' + err.message);
    }
};
