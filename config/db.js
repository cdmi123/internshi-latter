const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://cdmi:123@cluster0.rarib.mongodb.net/internship_db'); // local connection
        // await mongoose.connect('mongodb://localhost:27017/internship_db'); // local connection



        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
