const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0.01
    },
    method: {
        type: String,
        enum: ['cash', 'upi', 'legacy'],
        required: true
    },
    accountName: {
        type: String,
        trim: true,
        default: ''
    },
    paidAt: {
        type: Date,
        required: true,
        default: Date.now
    }
}, { _id: false });

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
        required: false
    },
    collegeAddress: {
        type: String,
        trim: true,
        default: ''
    },
    semesterCount: {
        type: Number,
        min: 1,
        max: 12,
        validate: {
            validator: Number.isInteger,
            message: 'Number of semesters must be a whole number.'
        }
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
        enum: ['6 hrs/day', '4 hrs/day', '2 hrs/day'],
        required: true
    },
    studentContactNo: {
        type: String,
        required: true
    },
    studentEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    downloadTokenHash: {
        type: String,
        select: false,
        index: true
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
        enum: ['yogichowk', 'adajan', 'katargam', 'navsari'],
        required: true
    },
    totalFees: {
        type: Number,
        min: 0,
        default: 0
    },
    isFree: {
        type: Boolean,
        default: false
    },
    feesPaid: {
        type: Number,
        min: 0,
        default: 0
    },
    feePayments: {
        type: [feePaymentSchema],
        default: []
    },
    marks: {
        type: Number
    },
    maxMarks: {
        type: Number,
        enum: [50, 60, 100],
        default: 50
    },
    grade: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'deleted'],
        default: 'active'
    },
    joiningLetterGiven: {
        type: Boolean,
        default: false
    },
    completionLetterGiven: {
        type: Boolean,
        default: false
    },
    logbookGiven: {
        type: Boolean,
        default: false
    },
    showEndingDate: {
        type: Boolean,
        default: true
    },
    idno: {
        type: String,
        required: false
    }
});

module.exports = mongoose.model('Internship', internshipSchema);
