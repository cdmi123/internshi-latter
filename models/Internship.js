const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    startDate: {
        type: String,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    endingDate: {
        type: String
    },
    studentName: {
        type: String,
        required: true
    },
    collegeName: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    internshipPosition: {
        type: String,
        required: true
    },
    workingTime: {
        type: String,
        enum: ['6 hrs/day', '4 hrs/day'],
        required: true
    },
    studentContactNo: {
        type: String,
        required: true
    },
    internFacultyName: {
        type: String,
        required: true
    },
    facultyContactNo: {
        type: String,
        required: true
    },
    branch: {
        type: String,
        enum: ['yogichowk', 'sarthana', 'adajan', 'katargam', 'dindoli', 'navsari'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'deleted'],
        default: 'active'
    }
});

module.exports = mongoose.model('Internship', internshipSchema);
