import { format } from "date-fns";

export function parseDate(dateStr: string): Date {
    if (!dateStr) return new Date(NaN);

    // Check if it's ISO format
    if (dateStr.includes("T") && dateStr.endsWith("Z")) {
        return new Date(dateStr);
    }

    // Try parsing dd/mm/yyyy hh:mm:ss
    // Regex for dd/mm/yyyy HH:mm:ss
    const dmyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
    const match = dateStr.match(dmyRegex);

    if (match) {
        const [_, day, month, year, hours, minutes, seconds] = match;
        return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            hours ? parseInt(hours) : 0,
            minutes ? parseInt(minutes) : 0,
            seconds ? parseInt(seconds) : 0
        );
    }

    // Fallback to native parsing
    return new Date(dateStr);
}

export function formatDate(dateStr: string, formatStr: string = "MMM d, yyyy"): string {
    try {
        if (!dateStr) return "-";
        const date = parseDate(dateStr);
        if (isNaN(date.getTime())) return "-";
        return format(date, formatStr);
    } catch {
        return "-";
    }
}
