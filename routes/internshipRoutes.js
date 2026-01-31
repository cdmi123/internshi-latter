const express = require('express');
const router = express.Router();
const internshipController = require('../controllers/internshipController');
const multer = require('multer');
const path = require('path');

// Configure Multer for Excel uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /xlsx|xls|csv/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Only Excel/CSV files are allowed!'));
    }
});

// Read (List)
router.get('/', internshipController.getAllInternships);

// API: Get Internships by Student Contact
router.get('/api/student-internships', internshipController.getStudentInternships);

// Read (View Letter)
router.get('/view-letter/:id', internshipController.viewInternship);

// Read (View Ending Letter)
router.get('/completion-letter/:id', internshipController.viewEndingLetter);

// Download Logbook
router.get('/logbook/:id', internshipController.generateLogbook);

// Logbook Management
router.get('/logbook-manage/:id', internshipController.manageLogbook);
router.post('/logbook-manage/:id/add', internshipController.addLogbookEntry);
router.get('/logbook-manage/delete/:id', internshipController.deleteLogbookEntry);

// Create (Add)
router.get('/add', internshipController.getAddForm);
router.post('/add', internshipController.createInternship);

// Excel Upload
router.get('/download-template', internshipController.downloadTemplate);
router.post('/upload-excel', upload.single('excelFile'), internshipController.uploadExcel);

// Update (Edit)
router.get('/edit/:id', internshipController.getEditForm);
router.post('/edit/:id', internshipController.updateInternship);

// Complete Internship
router.post('/complete/:id', internshipController.completeInternship);

// Update Marks
router.post('/update-marks/:id', internshipController.updateMarks);

// Toggle Status (AJAX)
router.post('/toggle-status/:id', internshipController.toggleStatus);

// Delete
router.get('/delete/:id', internshipController.deleteInternship);

module.exports = router;
