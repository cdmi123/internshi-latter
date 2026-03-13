const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Internship = require('./models/Internship');

mongoose.connect('mongodb+srv://cdmi:123@cluster0.rarib.mongodb.net/internship_db').then(async () => {
    console.log('Connected to DB');
    const internships = await Internship.find({ status: { $ne: 'deleted' } }).sort({ _id: -1 });
    console.log('Found', internships.length, 'internships');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Internships');

    worksheet.columns = [
        { header: 'Application Date', key: 'date', width: 20 },
        { header: 'Student Name', key: 'studentName', width: 25 },
        { header: 'Start Date', key: 'startDate', width: 15 },
        { header: 'Duration', key: 'duration', width: 15 },
        { header: 'Ending Date', key: 'endingDate', width: 15 },
        { header: 'College Name', key: 'collegeName', width: 25 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Position', key: 'internshipPosition', width: 25 },
        { header: 'Working Time', key: 'workingTime', width: 15 },
        { header: 'Student Contact', key: 'studentContactNo', width: 15 },
        { header: 'Faculty Name', key: 'internFacultyName', width: 20 },
        { header: 'Faculty Contact', key: 'facultyContactNo', width: 15 },
        { header: 'Branch', key: 'branch', width: 15 },
        { header: 'Marks', key: 'marks', width: 10 },
        { header: 'Grade', key: 'grade', width: 10 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Completion Letter', key: 'completionLetterGiven', width: 15 }
    ];

    internships.forEach((intern) => {
        worksheet.addRow({
            date: intern.date ? intern.date.toLocaleDateString() : '',
            studentName: intern.studentName,
            startDate: intern.startDate,
            duration: intern.duration,
            endingDate: intern.endingDate || '',
            collegeName: intern.collegeName || '',
            address: intern.address,
            internshipPosition: intern.internshipPosition,
            workingTime: intern.workingTime,
            studentContactNo: intern.studentContactNo,
            internFacultyName: intern.internFacultyName,
            facultyContactNo: intern.facultyContactNo,
            branch: intern.branch,
            marks: intern.marks != null ? intern.marks : '',
            grade: intern.grade || '',
            status: intern.status,
            completionLetterGiven: intern.completionLetterGiven ? 'Yes' : 'No'
        });
    });

    await workbook.xlsx.writeFile('test_export.xlsx');
    console.log('Exported to test_export.xlsx');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
