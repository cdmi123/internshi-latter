const mongoose = require('mongoose');

const logbookSchema = new mongoose.Schema({
    internshipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Internship',
        required: true
    },
    weekNo: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    taskAssigned: {
        type: String,
        required: true
    },
    taskCompleted: {
        type: String,
        required: true
    },
    technology: {
        type: String,
        required: true
    },
    hours: {
        type: Number,
        required: true,
        default: 36
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// compound index to ensure one entry per week per internship
logbookSchema.index({ internshipId: 1, weekNo: 1 }, { unique: true });

module.exports = mongoose.model('Logbook', logbookSchema);
