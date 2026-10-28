const Internship = require('../models/Internship');
const Logbook = require('../models/Logbook');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const logbookTemplates = require('../data/logbookTemplates');

const internshipBranches = ['yogichowk', 'adajan', 'katargam', 'navsari'];
const feeLetterCutoffDate = '2026-09-01';
const getIndiaDateKey = (date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(date);
const isAfterFeeCutoff = (date) => {
    if (!date) return false;
    const parsedDate = new Date(date);
    return !Number.isNaN(parsedDate.getTime()) &&
        getIndiaDateKey(parsedDate) > feeLetterCutoffDate;
};
const getIndiaMonthKey = (date) => getIndiaDateKey(date).slice(0, 7);
const getIndiaDateStart = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) - 330 * 60 * 1000);
};
const getTotalFeesFromForm = (body) => {
    if (body.isFree === 'true' || body.isFree === true) {
        return { totalFees: 0, isFree: true };
    }
    if (body.totalFees == null || String(body.totalFees).trim() === '') {
        return { error: 'Enter total fees before submitting.' };
    }
    const totalFees = Number(body.totalFees);
    if (!Number.isFinite(totalFees) || totalFees <= 0) {
        return { error: 'Total fees must be greater than zero.' };
    }
    return { totalFees, isFree: false };
};
const requiresFullFeesForLetters = (internship) => {
    if (!internship || !internship.date) return false;
    if (internship.isFree) return false;
    const totalFees = Number(internship.totalFees) || 0;
    const feesPaid = Number(internship.feesPaid) || 0;
    return isAfterFeeCutoff(internship.date) &&
        (totalFees <= 0 || feesPaid < totalFees);
};
const rejectRestrictedLetter = (res) => res.status(403).send(
    'This document is available after full fees are paid. The offer letter is still available.'
);
const getBranchScope = (req) => req.session.branch ? { branch: req.session.branch } : {};

// ... existing methods ...
const getNextIdno = async () => {
    try {
        const lastIntern = await Internship.findOne({ 
            idno: { $regex: /^CWI2026/ },
            status: { $ne: 'deleted' }
        }).sort({ idno: -1 });
        
        if (!lastIntern || !lastIntern.idno) {
            return "CWI20261001";
        }
        
        const lastIdNum = parseInt(lastIntern.idno.replace("CWI2026", ""));
        return `CWI2026${lastIdNum + 1}`;
    } catch (err) {
        console.error("Error in getNextIdno:", err);
        return "CWI2026" + (Date.now() % 10000); // Fallback
    }
};


// Generate Random Logbook Entries
exports.generateRandomLogbook = async (req, res) => {
    try {
        console.log('--- Starting Random Logbook Generation ---');
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            console.error('Internship not found:', req.params.id);
            return res.status(404).send('Internship not found');
        }

        const { technology } = req.body;
        console.log('Selected Technology:', technology);
        if (!technology || !logbookTemplates[technology]) {
            console.error('Invalid technology selected:', technology);
            return res.status(400).send('Invalid technology selected');
        }

        // Helper to parse dates in various formats
        const parseDate = (dateStr) => {
            if (!dateStr) return new Date();
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) return new Date(dateStr); // YYYY-MM-DD
                return new Date(parts[2], parts[1] - 1, parts[0]); // DD-MM-YYYY
            }
            return new Date(dateStr);
        };

        const start = parseDate(internship.startDate);
        const end = internship.endingDate ? parseDate(internship.endingDate) : new Date();
        
        console.log('Parsed Start Date:', start);
        console.log('Parsed End Date:', end);

        if (isNaN(start.getTime())) {
            console.error('Invalid start date string:', internship.startDate);
            return res.status(400).send('Invalid start date in internship record');
        }

        // 1. Clear existing entries
        await Logbook.deleteMany({ internshipId: internship._id });

        // 2. Determine number of weeks
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let totalWeeks = Math.ceil(diffDays / 7);
        if (totalWeeks < 1) totalWeeks = 1;

        console.log('Total Weeks calculated:', totalWeeks);

        // 3. Get and shuffle templates
        let templates = [...logbookTemplates[technology]];
        for (let i = templates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [templates[i], templates[j]] = [templates[j], templates[i]];
        }

        // 4. Generate hours distribution
        const targetTotal = 120;
        let distribution = [];
        let currentSum = 0;
        for (let i = 1; i <= totalWeeks; i++) {
            const r = 0.8 + (Math.random() * 0.4);
            distribution.push(r);
            currentSum += r;
        }

        let integerDistribution = distribution.map(val => Math.round((val / currentSum) * targetTotal));
        let finalSum = integerDistribution.reduce((a, b) => a + b, 0);
        let diff = targetTotal - finalSum;
        let k = 0;
        while (diff !== 0 && k < 100) {
            const idx = Math.floor(Math.random() * totalWeeks);
            if (diff > 0) {
                integerDistribution[idx]++;
                diff--;
            } else if (integerDistribution[idx] > 0) {
                integerDistribution[idx]--;
                diff++;
            }
            k++;
        }

        // 5. Create entries
        const bulkEntries = [];
        for (let i = 0; i < totalWeeks; i++) {
            const weekNo = i + 1;
            const weekStart = new Date(start);
            weekStart.setDate(weekStart.getDate() + (i * 7));
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (internship.endingDate && weekEnd > end) {
                weekEnd.setTime(end.getTime());
            }

            const template = templates[i % templates.length];

            bulkEntries.push({
                internshipId: internship._id,
                weekNo: weekNo,
                startDate: weekStart,
                endDate: weekEnd,
                taskAssigned: template.task,
                taskCompleted: template.completed,
                technology: template.tools,
                hours: integerDistribution[i] || 36
            });
        }

        console.log(`Inserting ${bulkEntries.length} logbook entries...`);
        await Logbook.insertMany(bulkEntries);
        console.log('Generation completed successfully.');
        
        if (req.headers['content-type'] === 'application/json') {
            return res.status(200).json({ success: true, message: 'Logbook generated' });
        }
        res.redirect(`/logbook-manage/${internship._id}`);
    } catch (err) {
        console.error("Error in generateRandomLogbook:", err);
        res.status(500).send('Server Error');
    }
};



// Get all internships with stats
exports.getAllInternships = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Faculty Filter Query
        const selectedFaculty = req.query.faculty || '';
        const selectedBranch = req.session.branch || req.query.branch || '';
        let query = { status: { $ne: 'deleted' }, ...getBranchScope(req) };

        if (selectedFaculty) {
            query.internFacultyName = { $regex: selectedFaculty, $options: 'i' };
        }

        if (selectedBranch && !req.session.branch) {
            query.branch = { $regex: selectedBranch, $options: 'i' };
        }

        const searchQuery = req.query.search || '';
        if (searchQuery) {
            const searchRegex = { $regex: searchQuery, $options: 'i' };
            query.$or = [
                { studentName: searchRegex },
                { studentContactNo: searchRegex }
            ];
        }

        const totalRecords = await Internship.countDocuments(query);
        const internships = await Internship.find(query)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalRecords / limit);

        // AJAX Request: Return only the rows
        if (req.query.ajax) {
            return res.render('partials/internship-rows', { internships: internships }, (err, html) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error rendering partial');
                }
                res.send(html);
            });
        }

        // Get Unique Faculties for Dropdown (from ACTIVE records only)
        const uniqueFaculties = await Internship.distinct('internFacultyName', {
            status: { $ne: 'deleted' },
            ...getBranchScope(req)
        });

        // Calculate Stats for all active records
        const allActiveInternships = await Internship.find(query);
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
            limit: limit,
            uniqueFaculties: uniqueFaculties.sort(),
            selectedFaculty: selectedFaculty,
            selectedBranch: selectedBranch,
            searchQuery: searchQuery
        });
    } catch (err) {
        console.error("Error in getAllInternships:", err);
        res.status(500).send('Server Error');
    }
};

// Export internships (respecting current filters) to an Excel file
exports.exportInternships = async (req, res) => {
    console.log('exportInternships route hit. query:', req.query);
    try {
        const selectedFaculty = req.query.faculty || '';
        const selectedBranch = req.session.branch || req.query.branch || '';
        let query = { status: { $ne: 'deleted' }, ...getBranchScope(req) };

        if (selectedFaculty) {
            query.internFacultyName = { $regex: selectedFaculty, $options: 'i' };
        }

        if (selectedBranch && !req.session.branch) {
            query.branch = { $regex: selectedBranch, $options: 'i' };
        }

        const searchQuery = req.query.search || '';
        if (searchQuery) {
            const searchRegex = { $regex: searchQuery, $options: 'i' };
            query.$or = [
                { studentName: searchRegex },
                { studentContactNo: searchRegex }
            ];
        }

        const internships = await Internship.find(query).sort({ _id: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Internships');

        worksheet.columns = [
            { header: 'ID NO', key: 'idno', width: 15 },
            { header: 'Application Date', key: 'date', width: 20 },
            { header: 'Student Name', key: 'studentName', width: 25 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'Duration', key: 'duration', width: 15 },
            { header: 'Ending Date', key: 'endingDate', width: 15 },
            { header: 'College Name', key: 'collegeName', width: 25 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Position', key: 'internshipPosition', width: 25 },
            { header: 'Working Time', key: 'workingTime', width: 15 },
            { header: 'Student Contact', key: 'studentContactNo', width: 15 },
            { header: 'Faculty Name', key: 'internFacultyName', width: 20 },
            { header: 'Faculty Contact', key: 'facultyContactNo', width: 15 },
            { header: 'Branch', key: 'branch', width: 15 },
            { header: 'Marks', key: 'marks', width: 10 },
            { header: 'Grade', key: 'grade', width: 10 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Completion Letter', key: 'completionLetterGiven', width: 15 }
        ];

        internships.forEach((intern) => {
            worksheet.addRow({
                idno: intern.idno || '',
                date: intern.date ? intern.date.toLocaleDateString() : '',
                studentName: intern.studentName,
                startDate: intern.startDate,
                duration: intern.duration,
                endingDate: intern.endingDate || '',
                collegeName: intern.collegeName || '',
                address: intern.address,
                internshipPosition: intern.internshipPosition,
                workingTime: intern.workingTime,
                studentContactNo: intern.studentContactNo,
                internFacultyName: intern.internFacultyName,
                facultyContactNo: intern.facultyContactNo,
                branch: intern.branch,
                marks: intern.marks != null ? intern.marks : '',
                grade: intern.grade || '',
                status: intern.status,
                completionLetterGiven: intern.completionLetterGiven ? 'Yes' : 'No'
            });
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=Internships.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error exporting internships:', err);
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
        if (requiresFullFeesForLetters(internship)) {
            return rejectRestrictedLetter(res);
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
        formData: { branch: req.session.branch || '' },
        branches: internshipBranches,
        branch: req.session.branch || null
    });
};

exports.createInternship = async (req, res) => {
    const branch = req.session.branch || req.body.branch;
    const formData = { ...req.body, branch };
    const feeValues = getTotalFeesFromForm(req.body);
    if (feeValues.error) {
        return res.status(400).render('add-internship', {
            title: 'Add Internship',
            error: feeValues.error,
            formData,
            branches: internshipBranches,
            branch: req.session.branch || null
        });
    }
    if (!internshipBranches.includes(branch)) {
        return res.status(400).render('add-internship', {
            title: 'Add Internship',
            error: 'Select a valid branch.',
            formData,
            branches: internshipBranches,
            branch: req.session.branch || null
        });
    }

    try {
        const newInternship = new Internship({
            ...formData,
            totalFees: feeValues.totalFees,
            isFree: feeValues.isFree,
            feesPaid: 0,
            feePayments: []
        });
        newInternship.idno = await getNextIdno();
        await newInternship.save();
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.render('add-internship', {
            title: 'Add Internship',
            error: 'Error saving data. Please check inputs.',
            formData,
            branches: internshipBranches,
            branch: req.session.branch || null
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
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }
        const submittedBranch = req.session.branch || req.body.branch;
        if (submittedBranch && submittedBranch !== internship.branch && !internshipBranches.includes(submittedBranch)) {
            return res.status(400).render('edit-internship', {
                title: 'Edit Internship',
                internship: { ...internship.toObject(), ...req.body },
                error: 'Select one of the currently available branches.'
            });
        }

        const feeValues = getTotalFeesFromForm(req.body);
        if (feeValues.error) {
            return res.status(400).render('edit-internship', {
                title: 'Edit Internship',
                internship: {
                    ...internship.toObject(),
                    totalFees: req.body.totalFees
                },
                error: feeValues.error
            });
        }
        if (feeValues.totalFees < (Number(internship.feesPaid) || 0)) {
            return res.status(400).render('edit-internship', {
                title: 'Edit Internship',
                internship: { ...internship.toObject(), totalFees: req.body.totalFees },
                error: 'Total fees cannot be less than the fees already paid.'
            });
        }

        const updateData = {
            ...req.body,
            ...(req.session.branch ? { branch: req.session.branch } : {}),
            totalFees: feeValues.totalFees,
            isFree: feeValues.isFree
        };
        delete updateData.feesPaid;
        delete updateData.feePayments;
        if (!internshipBranches.includes(internship.branch) && updateData.branch === internship.branch) {
            delete updateData.branch;
        }
        await Internship.findByIdAndUpdate(req.params.id, updateData, { runValidators: true });
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

exports.addFeePayment = async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        const method = req.body.method;
        const accountName = typeof req.body.accountName === 'string'
            ? req.body.accountName.trim()
            : '';

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Enter a payment amount greater than zero.' });
        }
        if (!['cash', 'upi'].includes(method)) {
            return res.status(400).json({ success: false, error: 'Choose Cash or UPI.' });
        }
        if (method === 'upi' && !accountName) {
            return res.status(400).json({ success: false, error: 'Enter the UPI account name.' });
        }
        const paymentDate = req.body.paidAt;
        if (typeof paymentDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
            return res.status(400).json({ success: false, error: 'Choose a valid payment date.' });
        }
        const [year, month, day] = paymentDate.split('-').map(Number);
        const parsedPaymentDate = new Date(Date.UTC(year, month - 1, day));
        if (getIndiaDateKey(parsedPaymentDate) !== paymentDate) {
            return res.status(400).json({ success: false, error: 'Choose a valid calendar date.' });
        }
        const paidAt = getIndiaDateStart(paymentDate);

        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).json({ success: false, error: 'Student registration not found.' });
        }
        if (internship.isFree) {
            return res.status(400).json({ success: false, error: 'This is a free internship; fees cannot be added.' });
        }

        const currentTotalFees = Number(internship.totalFees) || 0;
        const currentFeesPaid = Number(internship.feesPaid) || 0;
        if (currentTotalFees <= 0 || currentFeesPaid + amount > currentTotalFees) {
            return res.status(400).json({
                success: false,
                error: currentTotalFees <= 0
                    ? 'Set total fees before adding a payment.'
                    : `Payment exceeds the remaining balance of ₹${(currentTotalFees - currentFeesPaid).toFixed(2)}.`
            });
        }

        const payments = internship.feePayments || [];
        const recordedPayments = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
        const legacyPaidAmount = Math.max(currentFeesPaid - recordedPayments, 0);
        const newPayments = [];
        if (legacyPaidAmount > 0) {
            newPayments.push({
                amount: legacyPaidAmount,
                method: 'legacy',
                accountName: '',
                paidAt: internship.date || new Date()
            });
        }
        newPayments.push({
            amount,
            method,
            accountName: method === 'upi' ? accountName : '',
            paidAt
        });

        const paymentFilter = {
            _id: internship._id,
            totalFees: currentTotalFees,
            $or: currentFeesPaid === 0
                ? [{ feesPaid: 0 }, { feesPaid: { $exists: false } }]
                : [{ feesPaid: currentFeesPaid }]
        };
        const updateResult = await Internship.updateOne(
            paymentFilter,
            {
                $inc: { feesPaid: amount },
                $push: { feePayments: { $each: newPayments } }
            },
            { runValidators: true }
        );
        if (updateResult.matchedCount !== 1) {
            return res.status(409).json({
                success: false,
                error: 'This registration changed while recording the payment. Refresh and try again.'
            });
        }

        return res.json({
            success: true,
            feesPaid: currentFeesPaid + amount,
            remainingFees: currentTotalFees - currentFeesPaid - amount
        });
    } catch (err) {
        console.error('Error adding fee payment:', err);
        return res.status(500).json({ success: false, error: 'Unable to save the payment.' });
    }
};

exports.getFeePaymentHistory = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id)
            .select('date totalFees feesPaid feePayments');
        if (!internship) {
            return res.status(404).json({ success: false, error: 'Student registration not found.' });
        }

        const payments = (internship.feePayments || []).map((payment, paymentIndex) => ({
            amount: Number(payment.amount) || 0,
            method: payment.method,
            accountName: payment.accountName || '',
            paidAt: payment.paidAt,
            paymentIndex,
            legacy: false
        }));
        const recordedAmount = payments.reduce((total, payment) => total + payment.amount, 0);
        const legacyAmount = Math.max((Number(internship.feesPaid) || 0) - recordedAmount, 0);
        if (legacyAmount > 0) {
            payments.unshift({
                amount: legacyAmount,
                method: 'legacy',
                accountName: '',
                paidAt: internship.date,
                paymentIndex: 'legacy',
                legacy: true
            });
        }

        return res.json({
            success: true,
            totalFees: Number(internship.totalFees) || 0,
            feesPaid: Number(internship.feesPaid) || 0,
            payments: payments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
        });
    } catch (err) {
        console.error('Error loading fee payment history:', err);
        return res.status(500).json({ success: false, error: 'Unable to load payment history.' });
    }
};

exports.deleteFeePayment = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id)
            .select('date feesPaid feePayments');
        if (!internship) {
            return res.status(404).json({ success: false, error: 'Student registration not found.' });
        }

        const currentFeesPaid = Number(internship.feesPaid) || 0;
        const payments = internship.feePayments || [];
        const paymentIndex = req.params.paymentIndex;
        let nextPayments = payments;
        let paymentAmount;

        if (paymentIndex === 'legacy') {
            const recordedAmount = payments.reduce(
                (total, payment) => total + (Number(payment.amount) || 0),
                0
            );
            paymentAmount = Math.max(currentFeesPaid - recordedAmount, 0);
        } else {
            const index = Number(paymentIndex);
            if (!Number.isInteger(index) || index < 0 || index >= payments.length) {
                return res.status(404).json({ success: false, error: 'Payment entry not found.' });
            }
            paymentAmount = Number(payments[index].amount) || 0;
            nextPayments = [...payments];
            nextPayments.splice(index, 1);
        }

        if (paymentAmount <= 0 || paymentAmount > currentFeesPaid) {
            return res.status(404).json({ success: false, error: 'Payment entry not found.' });
        }

        const updateResult = await Internship.updateOne(
            { _id: internship._id, feesPaid: currentFeesPaid },
            {
                $set: {
                    feesPaid: currentFeesPaid - paymentAmount,
                    feePayments: nextPayments
                }
            }
        );
        if (updateResult.matchedCount !== 1) {
            return res.status(409).json({
                success: false,
                error: 'This payment history changed. Refresh and try again.'
            });
        }

        return res.json({
            success: true,
            feesPaid: currentFeesPaid - paymentAmount
        });
    } catch (err) {
        console.error('Error deleting fee payment:', err);
        return res.status(500).json({ success: false, error: 'Unable to delete the payment.' });
    }
};

exports.updateFeePayment = async (req, res) => {
    try {
        const index = Number(req.params.paymentIndex);
        const amount = Number(req.body.amount);
        const method = req.body.method;
        const accountName = typeof req.body.accountName === 'string'
            ? req.body.accountName.trim()
            : '';
        const paymentDate = req.body.paidAt;

        if (!Number.isInteger(index) || index < 0) {
            return res.status(404).json({ success: false, error: 'Payment entry not found.' });
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Enter a payment amount greater than zero.' });
        }
        if (!['cash', 'upi'].includes(method)) {
            return res.status(400).json({ success: false, error: 'Choose Cash or UPI.' });
        }
        if (method === 'upi' && !accountName) {
            return res.status(400).json({ success: false, error: 'Enter the UPI account name.' });
        }
        if (typeof paymentDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
            return res.status(400).json({ success: false, error: 'Choose a valid payment date.' });
        }
        const [year, month, day] = paymentDate.split('-').map(Number);
        const parsedPaymentDate = new Date(Date.UTC(year, month - 1, day));
        if (getIndiaDateKey(parsedPaymentDate) !== paymentDate) {
            return res.status(400).json({ success: false, error: 'Choose a valid calendar date.' });
        }

        const internship = await Internship.findById(req.params.id)
            .select('totalFees feesPaid feePayments isFree');
        if (!internship) {
            return res.status(404).json({ success: false, error: 'Student registration not found.' });
        }
        if (internship.isFree) {
            return res.status(400).json({ success: false, error: 'This is a free internship; fees cannot be edited.' });
        }

        const currentFeesPaid = Number(internship.feesPaid) || 0;
        const payments = internship.feePayments || [];
        if (index >= payments.length) {
            return res.status(404).json({ success: false, error: 'Payment entry not found or cannot be edited.' });
        }
        const previousAmount = Number(payments[index].amount) || 0;
        const nextFeesPaid = currentFeesPaid - previousAmount + amount;
        const totalFees = Number(internship.totalFees) || 0;
        if (nextFeesPaid > totalFees) {
            return res.status(400).json({
                success: false,
                error: `Updated payment exceeds the remaining balance of ₹${(totalFees - (currentFeesPaid - previousAmount)).toFixed(2)}.`
            });
        }

        const nextPayments = payments.map((payment, paymentIndex) => paymentIndex === index
            ? {
                amount,
                method,
                accountName: method === 'upi' ? accountName : '',
                paidAt: getIndiaDateStart(paymentDate)
            }
            : payment);
        const updateResult = await Internship.updateOne(
            {
                _id: internship._id,
                feesPaid: currentFeesPaid,
                feePayments: payments
            },
            {
                $set: {
                    feesPaid: nextFeesPaid,
                    feePayments: nextPayments
                }
            },
            { runValidators: true }
        );
        if (updateResult.matchedCount !== 1) {
            return res.status(409).json({
                success: false,
                error: 'This payment history changed. Refresh and try again.'
            });
        }

        return res.json({
            success: true,
            feesPaid: nextFeesPaid,
            remainingFees: totalFees - nextFeesPaid
        });
    } catch (err) {
        console.error('Error editing fee payment:', err);
        return res.status(500).json({ success: false, error: 'Unable to edit the payment.' });
    }
};

exports.getFeeCollectionReport = async (req, res) => {
    try {
        const now = new Date();
        const currentMonth = getIndiaMonthKey(now);
        const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
        const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (req.query.month && (typeof req.query.month !== 'string' || !monthPattern.test(req.query.month))) {
            return res.status(400).send('Invalid month. Use YYYY-MM.');
        }
        if (req.query.date && (typeof req.query.date !== 'string' || !datePattern.test(req.query.date))) {
            return res.status(400).send('Invalid date. Use YYYY-MM-DD.');
        }
        const selectedMonth = req.query.month || currentMonth;
        const selectedDate = req.query.date || getIndiaDateKey(now);
        const selectedBranch = req.session.branch || req.query.branch || '';

        if (selectedBranch && (typeof selectedBranch !== 'string' || !internshipBranches.includes(selectedBranch))) {
            return res.status(400).send('Invalid branch');
        }

        const [selectedYear, selectedMonthNumber, selectedDay] = selectedDate.split('-').map(Number);
        const parsedSelectedDate = new Date(Date.UTC(selectedYear, selectedMonthNumber - 1, selectedDay));
        if (getIndiaDateKey(parsedSelectedDate) !== selectedDate) {
            return res.status(400).send('Invalid date. Use a valid calendar date.');
        }

        const registrationsQuery = {
            status: { $ne: 'deleted' },
        };
        if (req.session.branch || selectedBranch) registrationsQuery.branch = selectedBranch;
        const registrations = await Internship.find(registrationsQuery)
            .select('idno studentName branch date totalFees feesPaid feePayments')
            .sort({ date: 1, studentName: 1 });

        const paymentRows = [];
        registrations.forEach((registration) => {
            const paymentHistory = registration.feePayments || [];
            const recordedPaid = paymentHistory.reduce(
                (sum, payment) => sum + (Number(payment.amount) || 0),
                0
            );
            const legacyPaid = Math.max((Number(registration.feesPaid) || 0) - recordedPaid, 0);
            const payments = [...paymentHistory];
            if (legacyPaid > 0) {
                payments.push({
                    amount: legacyPaid,
                    method: 'legacy',
                    accountName: '',
                    paidAt: registration.date
                });
            }
            payments.forEach((payment) => {
                if (!payment.paidAt || !(Number(payment.amount) > 0)) return;
                paymentRows.push({
                    idno: registration.idno,
                    studentName: registration.studentName,
                    branch: registration.branch,
                    date: payment.paidAt,
                    totalFees: Number(registration.totalFees) || 0,
                    feesPaid: Number(payment.amount),
                    balancePaid: Number(registration.feesPaid) || 0,
                    paymentMethod: payment.method,
                    accountName: payment.accountName || ''
                });
            });
        });
        const rowDate = (row) => getIndiaDateKey(new Date(row.date));
        const selectedDateApplications = paymentRows
            .filter(row => rowDate(row) === selectedDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const applications = paymentRows
            .filter(row => rowDate(row).startsWith(`${selectedMonth}-`))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const sumPaidFees = (rows) => rows.reduce((total, row) => total + row.feesPaid, 0);

        res.render('fee-collection-report', {
            title: 'Fee Collection Report',
            applications,
            todayApplications: selectedDateApplications,
            monthlyPaidTotal: sumPaidFees(applications),
            todayPaidTotal: sumPaidFees(selectedDateApplications),
            selectedMonth,
            selectedDate,
            selectedBranch,
            branches: req.session.branch ? [req.session.branch] : internshipBranches
        });
    } catch (err) {
        console.error('Error loading fee collection report:', err);
        res.status(500).send('Server Error');
    }
};

exports.updateMarks = async (req, res) => {
    try {
        const { marks, grade, endingDate, showEndingDate, maxMarks } = req.body;
        console.log("updateMarks Request Body:", req.body);

        const updateData = { marks, grade, showEndingDate, maxMarks };

        if (endingDate) {
            // Ensure format consistency if needed, but standardizing on what we receive or what we want to store
            // If receiving YYYY-MM-DD from date input, store as DD-MM-YYYY or keep YYYY-MM-DD.
            // Existing data seems to use DD-MM-YYYY strings. Input type="date" gives YYYY-MM-DD.
            if (endingDate.includes('-')) {
                const p = endingDate.split('-');
                if (p[0].length === 4) {
                    updateData.endingDate = `${p[2]}-${p[1]}-${p[0]}`;
                } else {
                    updateData.endingDate = endingDate;
                }
            } else {
                updateData.endingDate = endingDate;
            }
        }
        console.log("Updata Data:", updateData);

        await Internship.findByIdAndUpdate(req.params.id, updateData);
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

exports.getStudentInternships = async (req, res) => {
    try {
        const contactNo = req.query.contactNo;
        if (!contactNo) {
            return res.status(400).json({ error: 'Contact number is required' });
        }

        const internships = await Internship.find({
            studentContactNo: contactNo,
            status: { $ne: 'deleted' },
            ...getBranchScope(req)
        }).select('studentName internshipPosition startDate duration _id');

        res.json(internships);
    } catch (err) {
        console.error("Error fetching student internships:", err);
        res.status(500).json({ error: 'Server Error' });
    }
};



exports.generateLogbook = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }

        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            if (dateStr instanceof Date) return dateStr;
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
            return new Date(dateStr);
        };

        const startDate = parseDate(internship.startDate);
        const endDate = internship.endingDate ? parseDate(internship.endingDate) : new Date();

        if (!startDate || isNaN(startDate.getTime())) {
            return res.status(400).send('Invalid Start Date.');
        }

        const logbookEntries = await Logbook.find({ internshipId: internship._id }).sort({ weekNo: 1 });
        const formatDate = (d) => `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;

        let weekData = [];

        if (logbookEntries.length > 0) {
            weekData = logbookEntries.map(entry => ({
                weekNo: entry.weekNo,
                startDate: formatDate(new Date(entry.startDate)),
                endDate: formatDate(new Date(entry.endDate)),
                taskAssigned: entry.taskAssigned,
                taskCompleted: entry.taskCompleted,
                tools: entry.technology,
                hours: entry.hours
            }));
        }

        const templatePath = path.join(__dirname, '../views/logbook-template.ejs');
        const logoPath = 'http://localhost:3000/logo.png';
        let logoBase64 = '';
        try {
            const logoFile = fs.readFileSync(path.join(__dirname, '../public/logo.png'));
            logoBase64 = `data:image/png;base64,${logoFile.toString('base64')}`;
        } catch (e) {
            console.log("Logo not found", e);
        }

        const html = await ejs.renderFile(templatePath, {
            logoUrl: logoBase64,
            contactNo: internship.facultyContactNo,
            weeks: weekData
        });

        // Render HTML directly for view (Bypassing Puppeteer/PDF for now)
        res.render('logbook-template', {
            logoUrl: logoBase64,
            contactNo: internship.facultyContactNo,
            weeks: weekData
        });

        /*
        const { join } = require('path');
        const fs = require('fs');

        // Try to automatically find the chrome executable in our local cache
        const cacheDir = join(__dirname, '../.cache/puppeteer');
        let executablePath = null;

        if (fs.existsSync(cacheDir)) {
            const findFile = (dir, name) => {
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const filePath = join(dir, file);
                        const stat = fs.statSync(filePath);
                        if (stat.isDirectory()) {
                            const found = findFile(filePath, name);
                            if (found) return found;
                        } else if (file === name) {
                            return filePath;
                        }
                    }
                } catch (e) { return null; }
                return null;
            };

            // Look for 'chrome' (Linux) or 'chrome.exe' (Windows)
            executablePath = findFile(cacheDir, process.platform === 'win32' ? 'chrome.exe' : 'chrome');
        }

        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ],
            executablePath: executablePath || undefined
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
        });

        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Logbook_${internship.studentName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
        */

    } catch (err) {
        console.error("Logbook PDF Error:", err);
        res.status(500).send('Server Error: ' + err.message);
    }
};

// Print All Letters View
exports.printAllLetters = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }
        if (requiresFullFeesForLetters(internship)) {
            return rejectRestrictedLetter(res);
        }

        // Fetch associated logbook entries sorted by week number
        const logbookEntries = await Logbook.find({ internshipId: internship._id }).sort({ weekNo: 1 });

        res.render('print-all-letters', {
            internship: internship,
            logbooks: logbookEntries
        });
    } catch (err) {
        console.error("Error in printAllLetters:", err);
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

        const successRows = [];
        const errorRows = [];
        let rowNumber = 2; // Starting from row 2 (assuming header is row 1)

        // Date Parsing Helper
        const parseExcelDate = (input) => {
            if (!input) return null;

            // If it's a number (Excel date code)
            if (typeof input === 'number') {
                // Excel dates start from Dec 30, 1899
                const date = new Date(Math.round((input - 25569) * 86400 * 1000));
                return date;
            }

            // If it's a string (e.g., "DD-MM-YYYY" or "YYYY-MM-DD")
            if (typeof input === 'string') {
                const parts = input.split(/[-/.]/);
                if (parts.length === 3) {
                    // Check for DD-MM-YYYY (most common in India)
                    // Heuristic: if first part is > 1900, it's YYYY-MM-DD
                    if (parts[0].length === 4) {
                        return new Date(parts[0], parts[1] - 1, parts[2]);
                    } else {
                        return new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                }
                return new Date(input);
            }
            return null;
        };

        const formatDateForDB = (dateObj) => {
            if (!dateObj || isNaN(dateObj.getTime())) return null;
            // We need simple string format or Date object? Schema says Date for 'date' and String for 'startDate'.
            // Existing data has 'startDate' as format "DD-MM-YYYY" string (mostly).
            // Let's stick to "YYYY-MM-DD" for better sorting or "DD-MM-YYYY" to match consistency.
            // Looking at getStudentInternships, client expects startDate string.
            // Let's use standard DD-MM-YYYY
            const d = dateObj.getDate().toString().padStart(2, '0');
            const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const y = dateObj.getFullYear();
            return `${d}-${m}-${y}`;
        };


        let nextIdNum = 0;
        const lastIntern = await Internship.findOne({ 
            idno: { $regex: /^CWI2026/ },
            status: { $ne: 'deleted' }
        }).sort({ idno: -1 });
        
        if (!lastIntern || !lastIntern.idno) {
            nextIdNum = 1001;
        } else {
            nextIdNum = parseInt(lastIntern.idno.replace("CWI2026", "")) + 1;
        }

        for (const row of data) {
            const errors = [];


            // Normalize Keys (handle case variations)
            const getVal = (keys) => {
                for (let k of keys) {
                    if (row[k]) return row[k];
                }
                return null;
            };

            const studentName = getVal(['Student Name', 'studentName', 'Name']);
            const applicationDateRaw = getVal(['Application Date', 'applicationDate', 'Date']);
            const startDateRaw = getVal(['Starting Date', 'startDate', 'Start Date']);
            const duration = getVal(['Duration', 'duration']);
            const branch = getVal(['Branch', 'branch']);
            const workingTimeRaw = getVal(['Working Time', 'workingTime']);

            // Validations
            if (!studentName) errors.push("Missing Student Name");

            // Strict Date Validation
            let startDateFormatted = null;
            if (!startDateRaw) {
                errors.push("Missing Starting Date");
            } else {
                const parsedDate = parseExcelDate(startDateRaw);
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    startDateFormatted = formatDateForDB(parsedDate);
                } else {
                    errors.push(`Invalid Starting Date: ${startDateRaw}`);
                }
            }

            // Duration
            if (!duration) errors.push("Missing Duration");

            // Branch
            const inputBranch = branch ? branch.toString().toLowerCase().trim() : '';
            const branchRaw = req.session.branch || inputBranch || 'yogichowk';
            if (req.session.branch && inputBranch && inputBranch !== req.session.branch) {
                errors.push(`Branch must be ${req.session.branch}`);
            }
            if (!internshipBranches.includes(branchRaw)) {
                errors.push(`Invalid Branch: ${branchRaw}`);
            }

            // Working Time
            let workingTime = '6 hrs/day';
            if (workingTimeRaw) {
                const wt = workingTimeRaw.toString().toLowerCase();
                if (wt.includes('4')) workingTime = '4 hrs/day';
                else if (wt.includes('6')) workingTime = '6 hrs/day';
                else errors.push("Invalid Working Time (must be 4 or 6 hrs)");
            }

            if (errors.length > 0) {
                errorRows.push({ row: rowNumber, name: studentName || 'Unknown', errors: errors.join(', ') });
            } else {
                const nextId = `CWI2026${nextIdNum++}`;
                
                successRows.push({
                    studentName: studentName,
                    idno: nextId,
                    startDate: startDateFormatted,
                    duration: duration,
                    endingDate: getVal(['Ending Date', 'endingDate']) ? formatDateForDB(parseExcelDate(getVal(['Ending Date', 'endingDate']))) : '',
                    collegeName: getVal(['College Name', 'collegeName']) || '',
                    address: getVal(['Full Address', 'address']) || 'Surat',
                    internshipPosition: getVal(['Internship Position', 'internshipPosition']) || 'Intern',
                    workingTime: workingTime,
                    studentContactNo: getVal(['Student Contact No', 'studentContactNo', 'Contact']) || '0000000000',
                    internFacultyName: getVal(['Faculty Name', 'internFacultyName', 'Faculty']) || 'TBD',
                    facultyContactNo: getVal(['Faculty Contact No', 'facultyContactNo']) || '0000000000',
                    branch: branchRaw,
                    status: 'active',
                    date: parseExcelDate(applicationDateRaw) || new Date() // Use provided date or current date
                });
                
                // We need to locally increment for the next row to avoid duplicate IDs in the same batch
                // But getNextIdno queries the DB. Let's optimize this.
            }
            rowNumber++;
        }

        // Insert Valid Rows
        if (successRows.length > 0) {
            await Internship.insertMany(successRows);
        }

        // Delete File
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Render with feedback
        // Instead of simple redirect, we render the page with params or use flush
        // For simplicity, we can pass query params or Render 'view-internships' directly with alert

        // Re-fetching data for the view
        const page = 1;
        const limit = 20;
        const scopedQuery = { status: { $ne: 'deleted' }, ...getBranchScope(req) };
        const totalRecords = await Internship.countDocuments(scopedQuery);
        const internships = await Internship.find(scopedQuery)
            .sort({ _id: -1 })
            .limit(limit);
        const totalPages = Math.ceil(totalRecords / limit);
        const uniqueFaculties = await Internship.distinct('internFacultyName', scopedQuery);

        // Stats
        const allActive = await Internship.find(scopedQuery);
        const stats = {
            total: totalRecords,
            shift6: allActive.filter(i => i.workingTime === '6 hrs/day').length,
            shift4: allActive.filter(i => i.workingTime === '4 hrs/day').length
        };

        res.render('view-internships', {
            title: 'Internship List',
            internships: internships,
            stats: stats,
            currentPage: page,
            totalPages: totalPages,
            limit: limit,
            uniqueFaculties: uniqueFaculties.sort(),
            selectedFaculty: '',
            selectedBranch: req.session.branch || '',
            uploadResult: {
                success: successRows.length,
                failed: errorRows.length,
                errors: errorRows
            }
        });

    } catch (err) {
        console.error("Error in uploadExcel:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).send('Error processing Excel file: ' + err.message);
    }
};

// Download Excel Template
exports.downloadTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        worksheet.columns = [
            { header: 'Application Date', key: 'applicationDate', width: 15 },
            { header: 'Student Name', key: 'studentName', width: 25 },
            { header: 'Starting Date', key: 'startDate', width: 15 },
            { header: 'Duration', key: 'duration', width: 15 },
            { header: 'Ending Date', key: 'endingDate', width: 15 },
            { header: 'College Name', key: 'collegeName', width: 25 },
            { header: 'Full Address', key: 'address', width: 30 },
            { header: 'Internship Position', key: 'internshipPosition', width: 25 },
            { header: 'Working Time', key: 'workingTime', width: 15 },
            { header: 'Student Contact No', key: 'studentContactNo', width: 15 },
            { header: 'Faculty Name', key: 'internFacultyName', width: 20 },
            { header: 'Faculty Contact No', key: 'facultyContactNo', width: 15 },
            { header: 'Branch', key: 'branch', width: 15 }
        ];

        // Add a sample row
        worksheet.addRow({
            applicationDate: '01-01-2024',
            studentName: 'John Doe',
            startDate: '01-01-2024',
            duration: '6 Months',
            endingDate: '30-06-2024',
            collegeName: 'XYZ College',
            address: '123, Main St, Surat',
            internshipPosition: 'Web Developer',
            workingTime: '6 hrs/day',
            studentContactNo: '9876543210',
            internFacultyName: 'Dr. Smith',
            facultyContactNo: '9123456780',
            branch: 'Yogichowk'
        });

        // Add instructions
        worksheet.addRow({});
        const noteRow = worksheet.addRow(['Note: Date format should be DD-MM-YYYY or Excel Date format. Working Time should be "6 hrs/day" or "4 hrs/day".']);
        noteRow.font = { italic: true, color: { argb: 'FF888888' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Internship_Bulk_Upload_Template.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Error generating template:", err);
        res.status(500).send('Server Error');
    }
};

// Manage Logbook Page
exports.manageLogbook = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }

        let logbookEntries = await Logbook.find({ internshipId: internship._id }).sort({ weekNo: 1 });

        // Auto-populate for Web Developers if empty - REMOVED logic
        // const isWebDeveloper = internship.internshipPosition && internship.internshipPosition.toLowerCase().includes('web developer');


        res.render('manage-logbook', {
            title: 'Manage Logbook',
            internship: internship,
            logbookEntries: logbookEntries
        });
    } catch (err) {
        console.error("Error in manageLogbook:", err);
        res.status(500).send('Server Error');
    }
};

// Add Logbook Entry
exports.addLogbookEntry = async (req, res) => {
    try {
        const { weekNo, startDate, endDate, taskAssigned, taskCompleted, technology, hours } = req.body;

        const newEntry = new Logbook({
            internshipId: req.params.id,
            weekNo,
            startDate,
            endDate,
            taskAssigned,
            taskCompleted,
            technology,
            hours
        });

        await newEntry.save();
        res.redirect(`/logbook-manage/${req.params.id}`);

    } catch (err) {
        console.error("Error adding logbook entry:", err);
        // Ideally pass error back to view, but for now redirecting
        res.redirect(`/logbook-manage/${req.params.id}`);
    }
};

// Update Logbook Entry
exports.updateLogbookEntry = async (req, res) => {
    try {
        const { weekNo, startDate, endDate, taskAssigned, taskCompleted, technology, hours } = req.body;
        const entryId = req.params.id;

        const entry = await Logbook.findById(entryId);
        if (!entry) {
            return res.status(404).send('Logbook entry not found');
        }

        const internshipId = entry.internshipId;

        await Logbook.findByIdAndUpdate(entryId, {
            weekNo,
            startDate,
            endDate,
            taskAssigned,
            taskCompleted,
            technology,
            hours
        });

        res.redirect(`/logbook-manage/${internshipId}`);

    } catch (err) {
        console.error("Error updating logbook entry:", err);
        res.status(500).send('Server Error');
    }
};

// Delete Logbook Entry
exports.deleteLogbookEntry = async (req, res) => {
    try {
        const entry = await Logbook.findById(req.params.id);
        if (entry) {
            const internshipId = entry.internshipId;
            await Logbook.findByIdAndDelete(req.params.id);
            res.redirect(`/logbook-manage/${internshipId}`);
        } else {
            res.redirect('/');
        }
    } catch (err) {
        console.error("Error deleting logbook entry:", err);
        res.status(500).send('Server Error');
    }
};

// Complete Internship (Update End Date)
exports.completeInternship = async (req, res) => {
    try {
        const { endingDate } = req.body;

        // Standardize Date Format
        let formattedDate = endingDate;
        if (endingDate && endingDate.includes('-')) {
            const p = endingDate.split('-');
            // Input date YYYY-MM-DD -> DD-MM-YYYY (if needed by DB convention)
            // However, checking existing data, if we want consistency with upload which uses DD-MM-YYYY
            // But input type="date" gives YYYY-MM-DD.
            // Let's store as DD-MM-YYYY to match what seems to be the preferred string format in this app
            if (p[0].length === 4) {
                formattedDate = `${p[2]}-${p[1]}-${p[0]}`;
            }
        }

        await Internship.findByIdAndUpdate(req.params.id, { endingDate: formattedDate });
        res.redirect('/');
    } catch (err) {
        console.error("Error completing internship:", err);
        res.status(500).send('Server Error');
    }
};

// Toggle Status (Joining, Completion, Logbook)
exports.toggleStatus = async (req, res) => {
    try {
        const { type } = req.query; // 'joining', 'completion', 'logbook'
        const internship = await Internship.findById(req.params.id);

        if (!internship) {
            return res.status(404).json({ success: false, error: 'Internship not found' });
        }

        let updateField = {};
        if (type === 'joining') {
            updateField.joiningLetterGiven = !internship.joiningLetterGiven;
        } else if (type === 'completion') {
            updateField.completionLetterGiven = !internship.completionLetterGiven;
        } else if (type === 'logbook') {
            updateField.logbookGiven = !internship.logbookGiven;
        } else {
            return res.status(400).json({ success: false, error: 'Invalid type' });
        }

        await Internship.findByIdAndUpdate(req.params.id, updateField);
        res.json({ success: true, newState: updateField });

    } catch (err) {
        console.error("Error toggling status:", err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// Public form page
exports.getPublicForm = (req, res) => {
    res.render('public-form', {
        title: 'Internship Application',
        success: req.query.success === 'true',
        error: null,
        applicationId: req.query.applicationId || null,
        formData: {},
        branches: internshipBranches
    });
};

// Handle public form submission
exports.submitPublicForm = async (req, res) => {
    try {
        const { studentName, collegeName, address, studentContactNo, startDate, internshipPosition, branch } = req.body;
        if (!internshipBranches.includes(branch)) {
            return res.status(400).render('public-form', {
                title: 'Internship Application',
                success: false,
                error: 'Select a valid branch.',
                applicationId: null,
                formData: req.body,
                branches: internshipBranches
            });
        }

        // Set default values for required fields not in public form
        const internshipData = {
            studentName,
            collegeName,
            address,
            studentContactNo,
            startDate, // Should be YYYY-MM-DD from form
            date: new Date(), // Application date
            internshipPosition,
            workingTime: '6 hrs/day',
            internFacultyName: 'Administrative Office',
            facultyContactNo: '0000000000',
            branch,
            duration: '3 Months',
            status: 'active'
        };

        // Auto-calculate ending date (approx 3 months)
        if (startDate) {
            const start = new Date(startDate);
            if (!isNaN(start.getTime())) {
                start.setMonth(start.getMonth() + 3);
                const y = start.getFullYear();
                const m = String(start.getMonth() + 1).padStart(2, '0');
                const d = String(start.getDate()).padStart(2, '0');
                internshipData.endingDate = `${y}-${m}-${d}`;
            }
        }

        const newInternship = new Internship(internshipData);
        newInternship.idno = await getNextIdno();
        await newInternship.save();

        res.redirect(`/apply?success=true&applicationId=${encodeURIComponent(newInternship.idno)}`);
    } catch (err) {
        console.error("Error in submitPublicForm:", err);
        res.render('public-form', {
            title: 'Internship Application',
            success: false,
            error: 'Error submitting application. Please check your details and try again.',
            applicationId: null,
            formData: req.body,
            branches: internshipBranches
        });
    }
};
