const parseDate = (value) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    }

    if (typeof value !== 'string') return null;
    const parts = value.trim().split(/[-/.]/);
    if (parts.length !== 3) return null;

    let year;
    let month;
    let day;
    if (parts[0].length === 4) {
        [year, month, day] = parts.map(Number);
    } else {
        [day, month, year] = parts.map(Number);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return date;
};

const formatDate = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const extendEndDateForSundays = (startDateValue, endDateValue) => {
    const startDate = parseDate(startDateValue);
    const endDate = parseDate(endDateValue);
    if (!startDate || !endDate || endDate < startDate) return '';

    const daySpan = (endDate.getTime() - startDate.getTime()) / 86400000;
    const firstSundayOffset = 7 - startDate.getUTCDay();
    const sundayCount = daySpan >= firstSundayOffset
        ? Math.floor((daySpan - firstSundayOffset) / 7) + 1
        : 0;
    endDate.setUTCDate(endDate.getUTCDate() + sundayCount);
    if (Number.isNaN(endDate.getTime())) return '';
    return formatDate(endDate);
};

const calculateEndDate = (startDateValue, duration, workingTime) => {
    const startDate = parseDate(startDateValue);
    const durationMatch = typeof duration === 'string' && duration.match(/^\s*(\d+)\s*(month|week|day|hour)/i);
    if (!startDate || !durationMatch) return '';

    const amount = Number(durationMatch[1]);
    if (!Number.isSafeInteger(amount) || amount <= 0) return '';

    const unit = durationMatch[2].toLowerCase();
    const endDate = new Date(startDate);
    if (unit === 'month') {
        endDate.setUTCMonth(endDate.getUTCMonth() + amount);
    } else {
        let days = amount;
        if (unit === 'week') {
            days *= 7;
        } else if (unit === 'hour') {
            const shiftHours = Number.parseInt(workingTime, 10);
            if (!Number.isFinite(shiftHours) || shiftHours <= 0) return '';
            days = Math.ceil(amount / shiftHours);
        }
        endDate.setUTCDate(endDate.getUTCDate() + days);
    }

    return extendEndDateForSundays(formatDate(startDate), formatDate(endDate));
};

module.exports = { calculateEndDate, extendEndDateForSundays };
