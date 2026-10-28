const express = require('express');
const router = express.Router();
const internshipController = require('../controllers/internshipController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const branchAccessMiddleware = require('../middleware/branchAccessMiddleware');
const multer = require('multer');
const path = require('path');

// simple logger to show incoming requests
router.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.originalUrl);
    next();
});

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

// Public applications are not tied to a staff branch account.
router.get('/apply', internshipController.getPublicForm);
router.post('/apply', internshipController.submitPublicForm);

router.use(authMiddleware, branchAccessMiddleware);

// Read (List) - PROTECTED
router.get('/', internshipController.getAllInternships);

// API: Get Internships by Student Contact - PROTECTED
router.get('/api/student-internships', internshipController.getStudentInternships);

// Read (View Letter) - PROTECTED
router.get('/view-letter/:id', internshipController.viewInternship);

// Read (View Ending Letter) - PROTECTED
router.get('/completion-letter/:id', internshipController.viewEndingLetter);

// Print All Letters - PROTECTED
router.get('/print-all/:id', internshipController.printAllLetters);

// Download Logbook - PROTECTED
router.get('/logbook/:id', internshipController.generateLogbook);

// Logbook Management - PROTECTED
router.get('/logbook-manage/:id', internshipController.manageLogbook);
router.post('/logbook-manage/:id/add', internshipController.addLogbookEntry);
router.post('/logbook-manage/:id/auto-generate', internshipController.generateRandomLogbook);
router.post('/logbook-manage/edit/:id', internshipController.updateLogbookEntry);
router.get('/logbook-manage/delete/:id', internshipController.deleteLogbookEntry);

// Create (Add) - PROTECTED
router.get('/add', internshipController.getAddForm);
router.post('/add', internshipController.createInternship);

// Excel Upload - PROTECTED
router.get('/download-template', internshipController.downloadTemplate);
router.post('/upload-excel', upload.single('excelFile'), internshipController.uploadExcel);

// Export internships as Excel - PROTECTED
console.log('Registering GET /export route');
router.get('/export', internshipController.exportInternships);

// Private fee collection report (not linked in the navigation)
router.get('/day1', internshipController.getFeeCollectionReport);

// Update (Edit) - PROTECTED
router.get('/edit/:id', internshipController.getEditForm);
router.post('/edit/:id', internshipController.updateInternship);
router.get('/fees/:id/payments', internshipController.getFeePaymentHistory);
router.post('/fees/:id/payments/:paymentIndex/edit', internshipController.updateFeePayment);
router.post('/fees/:id/payments/:paymentIndex/delete', internshipController.deleteFeePayment);
router.post('/fees/:id/pay', internshipController.addFeePayment);

// Complete Internship - PROTECTED
router.post('/complete/:id', internshipController.completeInternship);

// Update Marks - PROTECTED
router.post('/update-marks/:id', internshipController.updateMarks);

// Toggle Status (AJAX) - PROTECTED
router.post('/toggle-status/:id', internshipController.toggleStatus);

// Delete - PROTECTED
router.get('/delete/:id', internshipController.deleteInternship);

module.exports = router;
