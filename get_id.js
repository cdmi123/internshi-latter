const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

mongoose.connect('mongodb://localhost:27017/internship_db' || process.env.MONGODB_URI)
  .then(async () => {
    const internship = await Internship.findOne();
    if (internship) {
      console.log('ID:' + internship._id);
    } else {
      console.log('No internships found');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
