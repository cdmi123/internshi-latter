const mongoose = require('mongoose');
const Internship = require('../models/Internship');
const connectDB = require('../config/db');

const updateStudentIds = async () => {
    try {
        await connectDB();
        console.log('Connected to database...');

        const internships = await Internship.find({ status: 'active' }).sort({ date: 1 });
        console.log(`Found ${internships.length} active internships.`);

        let startId = 1001;
        const prefix = "CWI2026";

        for (let i = 0; i < internships.length; i++) {
            const studentId = `${prefix}${startId + i}`;
            internships[i].idno = studentId;
            await internships[i].save();
            console.log(`Assigned ID ${studentId} to ${internships[i].studentName}`);
        }

        console.log('Successfully updated all student IDs.');
        process.exit(0);
    } catch (err) {
        console.error('Error updating student IDs:', err);
        process.exit(1);
    }
};

updateStudentIds();
