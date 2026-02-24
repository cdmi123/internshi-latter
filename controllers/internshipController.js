const Internship = require('../models/Internship');
const Logbook = require('../models/Logbook');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const ejs = require('ejs');



// Get all internships with stats
exports.getAllInternships = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Faculty Filter Query
        const selectedFaculty = req.query.faculty || '';
        let query = { status: { $ne: 'deleted' } };

        if (selectedFaculty) {
            // Use regex for case-insensitive partial match
            query.internFacultyName = { $regex: selectedFaculty, $options: 'i' };
        }

        const searchQuery = req.query.search || '';
        if (searchQuery) {
            const searchRegex = { $regex: searchQuery, $options: 'i' };
            query.$or = [
                { studentName: searchRegex },
                { internshipPosition: searchRegex },
                { collegeName: searchRegex },
                { studentContactNo: searchRegex },
                { branch: searchRegex }
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
        const uniqueFaculties = await Internship.distinct('internFacultyName', { status: { $ne: 'deleted' } });

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
            searchQuery: searchQuery
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
        const { marks, grade, endingDate, showEndingDate } = req.body;
        console.log("updateMarks Request Body:", req.body);

        const updateData = { marks, grade, showEndingDate };

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
            status: { $ne: 'deleted' }
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
            const branchRaw = (branch || 'yogichowk').toString().toLowerCase().trim();

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
                successRows.push({
                    studentName: studentName,
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
        const totalRecords = await Internship.countDocuments({ status: { $ne: 'deleted' } });
        const internships = await Internship.find({ status: { $ne: 'deleted' } })
            .sort({ _id: -1 })
            .limit(limit);
        const totalPages = Math.ceil(totalRecords / limit);
        const uniqueFaculties = await Internship.distinct('internFacultyName', { status: { $ne: 'deleted' } });

        // Stats
        const allActive = await Internship.find({ status: { $ne: 'deleted' } });
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
