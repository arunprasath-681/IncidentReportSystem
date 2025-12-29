import fs from 'fs';
import path from 'path';

// Manually load .env.local
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
        console.log("Loaded .env.local");
    }
} catch (e) {
    console.error("Error loading .env.local", e);
}

import { getSheetsClient, getSpreadsheetId } from './src/lib/sheets/client';

async function debugStaff() {
    try {
        console.log("Initializing Sheets Client...");
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        console.log("Spreadsheet ID:", spreadsheetId);

        console.log("Fetching Staff Sheet...");
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Staff!A:F",
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found in Staff sheet.");
            return;
        }

        console.log("Headers (Row 0):", JSON.stringify(rows[0]));
        if (rows.length > 1) {
            console.log("First Row (Row 1):", JSON.stringify(rows[1]));
        }

        // Check for Campus Manager
        const headers = rows[0];
        const roleIndex = headers.findIndex(h => h.trim().toLowerCase() === "role");
        const emailIndex = headers.findIndex(h => h.trim().toLowerCase() === "email");

        console.log("Role Index:", roleIndex);
        console.log("Email Index:", emailIndex);

        if (roleIndex !== -1) {
            rows.slice(1).forEach((row, i) => {
                const role = row[roleIndex];
                if (role?.toLowerCase() === "campus manager") {
                    console.log(`Found Campus Manager at index ${i + 1}:`, row);
                }
            });
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

debugStaff();
