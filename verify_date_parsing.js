const xlsx = require('xlsx');

// Mock Data mimicking Excel input
const mockData = [
    { 'Student Name': 'Test 1', 'Starting Date': 45353, 'Duration': '6 Months' }, // Excel Date
    { 'Student Name': 'Test 2', 'Starting Date': '01-05-2024', 'Duration': '6 Months' }, // String DD-MM-YYYY
    { 'Student Name': 'Test 3', 'Starting Date': '2024-05-01', 'Duration': '6 Months' }, // String YYYY-MM-DD
    { 'Student Name': 'Test 4', 'Duration': '6 Months' }, // Missing Date
    { 'Student Name': 'Test 5', 'Starting Date': 'Invalid', 'Duration': '6 Months' } // Invalid Date
];

// Replicating Controller Logic
const parseExcelDate = (input) => {
    if (!input) return null;

    // If it's a number (Excel date code)
    if (typeof input === 'number') {
        const date = new Date(Math.round((input - 25569) * 86400 * 1000));
        return date;
    }

    // If it's a string
    if (typeof input === 'string') {
        const parts = input.split(/[-/.]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        return new Date(input);
    }
    return null;
};

const formatDateForDB = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return null;
    const d = dateObj.getDate().toString().padStart(2, '0');
    const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}-${m}-${y}`;
};

console.log("--- Testing Date Parsing Logic ---");
mockData.forEach(row => {
    const rawDate = row['Starting Date'];
    let formatted = null;
    let error = null;

    if (!rawDate) {
        error = "Missing Starting Date";
    } else {
        const parsed = parseExcelDate(rawDate);
        if (parsed && !isNaN(parsed.getTime())) {
            formatted = formatDateForDB(parsed);
        } else {
            error = `Invalid Starting Date: ${rawDate}`;
        }
    }

    console.log(`Input: ${rawDate} (${typeof rawDate}) -> Result: ${formatted || error}`);
});
