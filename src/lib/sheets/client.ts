import { google, sheets_v4 } from "googleapis";

let sheetsClient: sheets_v4.Sheets | null = null;

export async function getSheetsClient(accessToken?: string): Promise<sheets_v4.Sheets> {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();

    return google.sheets({ version: "v4", auth: client as any });
}

export function getSpreadsheetId(): string {
    const id = process.env.SPREADSHEET_ID;
    if (!id) {
        throw new Error("SPREADSHEET_ID environment variable is not set");
    }
    return id;
}

// Helper to parse sheet rows into objects
export function parseRows<T>(headers: string[], rows: string[][]): T[] {
    return rows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
            let value = row[index] || "";
            // Remove leading single quote if present (common in Sheets for forcing text)
            if (value.startsWith("'")) {
                value = value.substring(1);
            }
            obj[header] = value;
        });
        return obj as T;
    });
}

// Helper to convert object back to row
export function objectToRow(headers: string[], obj: Record<string, unknown>): string[] {
    return headers.map((header) => {
        const value = obj[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    });
}

// Helper to find row index by a specific field value
export async function findRowIndex(
    sheets: sheets_v4.Sheets,
    sheetName: string,
    fieldName: string,
    value: string
): Promise<number | null> {
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0] as string[];
    const fieldIndex = headers.indexOf(fieldName);
    if (fieldIndex === -1) return null;

    for (let i = 1; i < rows.length; i++) {
        if (rows[i][fieldIndex] === value) {
            return i + 1; // 1-indexed for Sheets API
        }
    }

    return null;
}

// Helper to format date for storage in sheets (dd/mm/yyyy hh:mm:ss format)
export function formatDateForStorage(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Helper to parse date from storage format (dd/mm/yyyy hh:mm:ss) to Date object
export function parseDateFromStorage(dateStr: string): Date {
    if (!dateStr) return new Date(0);
    // If it's already an ISO string (legacy data), try parsing it directly
    if (dateStr.includes("T") && dateStr.endsWith("Z")) {
        return new Date(dateStr);
    }

    // Parse dd/mm/yyyy hh:mm:ss
    const [datePart, timePart] = dateStr.split(" ");
    if (!datePart) return new Date(0);

    const [day, month, year] = datePart.split("/").map(Number);

    let hours = 0, minutes = 0, seconds = 0;
    if (timePart) {
        [hours, minutes, seconds] = timePart.split(":").map(Number);
    }

    // Month is 0-indexed in Date constructor
    return new Date(year, month - 1, day, hours, minutes, seconds);
}
