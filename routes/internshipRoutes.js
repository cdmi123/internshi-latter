const express = require('express');
const router = express.Router();
const internshipController = require('../controllers/internshipController');

// Read (List)
router.get('/', internshipController.getAllInternships);

// Read (View Letter)
router.get('/view/:id', internshipController.viewInternship);

// Read (View Ending Letter)
router.get('/ending-letter/:id', internshipController.viewEndingLetter);

// Create (Add)
router.get('/add', internshipController.getAddForm);
router.post('/add', internshipController.createInternship);

// Update (Edit)
router.get('/edit/:id', internshipController.getEditForm);
router.post('/edit/:id', internshipController.updateInternship);

// Delete
router.get('/delete/:id', internshipController.deleteInternship);

module.exports = router;
