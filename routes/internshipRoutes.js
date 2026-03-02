const express = require('express');
const router = express.Router();
const internshipController = require('../controllers/internshipController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
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

// Auth Routes
router.get('/login', authController.getLoginForm);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// Read (List) - PROTECTED
router.get('/', authMiddleware, internshipController.getAllInternships);

// API: Get Internships by Student Contact - PROTECTED
router.get('/api/student-internships', authMiddleware, internshipController.getStudentInternships);

// Read (View Letter) - PROTECTED
router.get('/view-letter/:id', authMiddleware, internshipController.viewInternship);

// Read (View Ending Letter) - PROTECTED
router.get('/completion-letter/:id', authMiddleware, internshipController.viewEndingLetter);

// Download Logbook - PROTECTED
router.get('/logbook/:id', authMiddleware, internshipController.generateLogbook);

// Logbook Management - PROTECTED
router.get('/logbook-manage/:id', authMiddleware, internshipController.manageLogbook);
router.post('/logbook-manage/:id/add', authMiddleware, internshipController.addLogbookEntry);
router.post('/logbook-manage/edit/:id', authMiddleware, internshipController.updateLogbookEntry);
router.get('/logbook-manage/delete/:id', authMiddleware, internshipController.deleteLogbookEntry);

// Create (Add) - PROTECTED
router.get('/add', authMiddleware, internshipController.getAddForm);
router.post('/add', authMiddleware, internshipController.createInternship);

// Excel Upload - PROTECTED
router.get('/download-template', authMiddleware, internshipController.downloadTemplate);
router.post('/upload-excel', authMiddleware, upload.single('excelFile'), internshipController.uploadExcel);

// Update (Edit) - PROTECTED
router.get('/edit/:id', authMiddleware, internshipController.getEditForm);
router.post('/edit/:id', authMiddleware, internshipController.updateInternship);

// Complete Internship - PROTECTED
router.post('/complete/:id', authMiddleware, internshipController.completeInternship);

// Update Marks - PROTECTED
router.post('/update-marks/:id', authMiddleware, internshipController.updateMarks);

// Toggle Status (AJAX) - PROTECTED
router.post('/toggle-status/:id', authMiddleware, internshipController.toggleStatus);

// Delete - PROTECTED
router.get('/delete/:id', authMiddleware, internshipController.deleteInternship);

// Public Application Form - PUBLIC
router.get('/apply', internshipController.getPublicForm);
router.post('/apply', internshipController.submitPublicForm);

module.exports = router;
