const Internship = require('../models/Internship');
const Logbook = require('../models/Logbook');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

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

        const totalRecords = await Internship.countDocuments(query);
        const internships = await Internship.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalRecords / limit);

        // Get Unique Faculties for Dropdown (from ACTIVE records only)
        const uniqueFaculties = await Internship.distinct('internFacultyName', { status: { $ne: 'deleted' } });

        // Calculate Stats for all active records (not just current page)
        // Note: Stats usually show GLOBAL stats, but if filtered, maybe show filtered stats?
        // Let's keep stats global for now as per dashboard convention, or we can make them filtered.
        // User asked for "filtering faculty name wise set". Usually dashboard stats remain global or adjust.
        // Let's filter stats too if a filter is active to be consistent.
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
            selectedFaculty: selectedFaculty
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
            // Check if it's already a Date object
            if (dateStr instanceof Date) return dateStr;

            const parts = dateStr.split('-');
            if (parts.length === 3) {
                // Check if parts[0] is year (YYYY-MM-DD)
                if (parts[0].length === 4) {
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
                // Assume DD-MM-YYYY
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
            return new Date(dateStr);
        };

        const startDate = parseDate(internship.startDate);
        const endDate = internship.endingDate ? parseDate(internship.endingDate) : new Date();

        if (!startDate || isNaN(startDate.getTime())) {
            return res.status(400).send('Invalid Start Date.');
        }

        // Create Workbook and Worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Logbook');

        // Define Columns
        worksheet.columns = [
            { header: 'Week No', key: 'weekNo', width: 15 },
            { header: 'Date (From - To)', key: 'date', width: 30 },
            { header: 'Task Assigned', key: 'taskAssigned', width: 30 },
            { header: 'Task Completed', key: 'taskCompleted', width: 30 },
            { header: 'Tools and Technologies Used', key: 'tools', width: 30 },
            { header: 'No. of Hours Completed per Week', key: 'hours', width: 15 },
            { header: 'Signature of external guide', key: 'extSign', width: 25 },
            { header: 'Signature of internal guide', key: 'intSign', width: 25 },
            { header: 'Comments', key: 'comments', width: 30 }
        ];

        // Style Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        // Web Developer Tasks from PDF
        const WEB_DEVELOPER_TASKS = [
            {
                title: "Hospital Management System Project Planning and Requirement Analysis",
                description: "In this task, the complete planning and requirement analysis of the Hospital Management System was carried out. The working process of a hospital was studied in detail, including patient registration, doctor management, appointment scheduling, billing, and report generation."
            },
            {
                title: "Database Design and Implementation using MySQL",
                description: "In this task, the database structure for the Hospital Management System was designed and implemented using MySQL. Various tables were created to store information related to admins, doctors, patients, appointments, and billing details."
            },
            {
                title: "User Authentication and Login System Development",
                description: "This task focused on developing a secure login and authentication system using PHP. Separate login access was created for admin and doctor users. PHP sessions were implemented to maintain user login states."
            },
            {
                title: "Patient Registration and Appointment Management Module",
                description: "In this task, the patient management module was developed, which allows adding, viewing, updating, and deleting patient records. A patient registration form was created using HTML and PHP."
            },
            {
                title: "Billing Module Development and System Testing",
                description: "This task involved developing the billing module of the Hospital Management System. Consultation charges and treatment costs were calculated and stored. After completing the module, the entire system was tested."
            }
        ];

        // Check for DB Entries
        const logbookEntries = await Logbook.find({ internshipId: internship._id }).sort({ weekNo: 1 });
        const formatDate = (d) => `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;

        if (logbookEntries.length > 0) {
            // Use DB Entries
            logbookEntries.forEach(entry => {
                const row = worksheet.addRow({
                    weekNo: `Week ${entry.weekNo}`,
                    date: `${formatDate(new Date(entry.startDate))} To ${formatDate(new Date(entry.endDate))}`,
                    taskAssigned: entry.taskAssigned,
                    taskCompleted: entry.taskCompleted,
                    tools: entry.technology,
                    hours: entry.hours,
                    extSign: '',
                    intSign: '',
                    comments: ''
                });
                // Style Data Rows
                row.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                // Center align Week No, Date and Hours
                row.getCell('weekNo').alignment = { vertical: 'top', horizontal: 'center' };
                row.getCell('date').alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
                row.getCell('hours').alignment = { vertical: 'top', horizontal: 'center' };
                // Set row height
                row.height = 130;
                // Apply borders
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

        } else {
            // Fallback to auto-generation
            let currentDate = new Date(startDate);
            let weekNo = 1;

            // Check if student is a Web Developer (case-insensitive)
            const isWebDeveloper = internship.internshipPosition && internship.internshipPosition.toLowerCase().includes('web developer');

            while (currentDate <= endDate) {
                let weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);
                if (weekEnd > endDate) weekEnd = new Date(endDate);

                let taskTitle = '';
                let taskDesc = '';

                if (isWebDeveloper) {
                    // Arrays are 0-indexed, weekNo is 1-indexed
                    const taskIndex = weekNo - 1;
                    if (taskIndex < WEB_DEVELOPER_TASKS.length) {
                        taskTitle = WEB_DEVELOPER_TASKS[taskIndex].title;
                        taskDesc = WEB_DEVELOPER_TASKS[taskIndex].description;
                    }
                }

                const row = worksheet.addRow({
                    weekNo: `Week ${weekNo}`,
                    date: `${formatDate(currentDate)} To ${formatDate(weekEnd)}`,
                    taskAssigned: taskTitle,
                    taskCompleted: taskDesc,
                    tools: '',
                    hours: '',
                    extSign: '',
                    intSign: '',
                    comments: ''
                });

                // Style Data Rows
                row.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

                // Center align Week No, Date and Hours
                row.getCell('weekNo').alignment = { vertical: 'top', horizontal: 'center' };
                row.getCell('date').alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
                row.getCell('hours').alignment = { vertical: 'top', horizontal: 'center' };

                // Set row height
                row.height = 130;

                // Apply borders to all cells in the row
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });

                currentDate.setDate(currentDate.getDate() + 7);
                weekNo++;
            }
        }

        // Apply borders to header row as well
        headerRow.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Logbook_${internship.studentName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Logbook Error:", err);
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

// Manage Logbook Page
exports.manageLogbook = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) {
            return res.status(404).send('Internship not found');
        }

        const logbookEntries = await Logbook.find({ internshipId: internship._id }).sort({ weekNo: 1 });

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
