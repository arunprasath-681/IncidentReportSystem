import { google } from "googleapis";
import { getSpreadsheetId, parseRows, findRowIndex, formatDateForStorage, parseDateFromStorage } from "./client";
import { v4 as uuidv4 } from "uuid";

export interface Incident {
    incident_id: string;
    complainant_id: string;
    complainant_category: string;
    date_time_of_incident: string;
    reported_on: string;
    description: string;
    attachments: string; // JSON array of attachment URLs
    status: "Open" | "Closed";
    last_updated_by: string;
    last_updated_at: string;
    metadata_changelog: string; // JSON object for changelog and company relay info
}

export interface CreateIncidentInput {
    complainantEmail: string;
    complainantCategory: string;
    dateTimeOfIncident: string;
    description: string;
    attachments?: string[];
    metadata?: Record<string, unknown>;
}

function getSheetsClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.sheets({ version: "v4", auth: oauth2Client });
}

// Get headers from the sheet
async function getSheetHeaders(
    sheets: ReturnType<typeof getSheetsClient>,
    sheetName: string
): Promise<string[]> {
    const spreadsheetId = getSpreadsheetId();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
    });
    return (response.data.values?.[0] as string[]) || [];
}

// Convert object to row based on actual sheet headers
function objectToRowDynamic(headers: string[], obj: Record<string, unknown>): string[] {
    return headers.map((header) => {
        const value = obj[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    });
}

// Create a new incident
export async function createIncident(
    accessToken: string,
    input: CreateIncidentInput
): Promise<Incident> {
    const sheets = getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    // Get actual headers from the sheet
    const headers = await getSheetHeaders(sheets, "IncidentReports");

    const now = formatDateForStorage();
    const incident: Incident = {
        incident_id: `INC-${uuidv4()}`,
        complainant_id: input.complainantEmail,
        complainant_category: input.complainantCategory,
        date_time_of_incident: input.dateTimeOfIncident,
        reported_on: now,
        description: input.description,
        attachments: JSON.stringify(input.attachments || []),
        status: "Open",
        last_updated_by: input.complainantEmail,
        last_updated_at: now,
        metadata_changelog: JSON.stringify({
            ...input.metadata,
            changelog: [
                {
                    action: "created",
                    by: input.complainantEmail,
                    at: now,
                },
            ],
        }),
    };

    const row = objectToRowDynamic(headers, incident as unknown as Record<string, unknown>);

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `IncidentReports!A:${String.fromCharCode(64 + headers.length)}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
            values: [row],
        },
    });

    return incident;
}

// Get all incidents (with optional filters)
export async function getIncidents(
    accessToken: string,
    filters?: {
        complainantEmail?: string;
        status?: "Open" | "Closed";
        campusCode?: string;
    }
): Promise<Incident[]> {
    const sheets = getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "IncidentReports!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return [];

    const headers = rows[0] as string[];
    let incidents = parseRows<Incident>(headers, rows.slice(1) as string[][]);

    // Apply filters
    if (filters?.complainantEmail) {
        incidents = incidents.filter(
            (i) => i.complainant_id?.toLowerCase() === filters.complainantEmail!.toLowerCase()
        );
    }

    if (filters?.status) {
        incidents = incidents.filter((i) => i.status === filters.status);
    }

    // Sort by reported_on descending
    incidents.sort((a, b) =>
        parseDateFromStorage(b.reported_on).getTime() - parseDateFromStorage(a.reported_on).getTime()
    );

    return incidents;
}

// Get single incident by ID
export async function getIncidentById(
    accessToken: string,
    incidentId: string
): Promise<Incident | null> {
    const sheets = getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "IncidentReports!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return null;

    const headers = rows[0] as string[];
    const incidents = parseRows<Incident>(headers, rows.slice(1) as string[][]);

    return incidents.find((i) => i.incident_id === incidentId) || null;
}

// Update incident
export async function updateIncident(
    accessToken: string,
    incidentId: string,
    updates: Partial<Incident>,
    updatedBy: string
): Promise<Incident | null> {
    const sheets = getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    // Get actual headers from the sheet
    const headers = await getSheetHeaders(sheets, "IncidentReports");

    // Find the row
    const rowIndex = await findRowIndex(sheets, "IncidentReports", "incident_id", incidentId);
    if (!rowIndex) return null;

    // Get current data
    const currentIncident = await getIncidentById(accessToken, incidentId);
    if (!currentIncident) return null;

    // Add to changelog
    const metadata = JSON.parse(currentIncident.metadata_changelog || "{}");
    const changelog = metadata.changelog || [];
    changelog.push({
        action: "updated",
        by: updatedBy,
        at: formatDateForStorage(),
        changes: Object.keys(updates),
    });

    const updatedIncident: Incident = {
        ...currentIncident,
        ...updates,
        last_updated_by: updatedBy,
        last_updated_at: formatDateForStorage(),
        metadata_changelog: JSON.stringify({ ...metadata, changelog }),
    };

    const row = objectToRowDynamic(headers, updatedIncident as unknown as Record<string, unknown>);

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `IncidentReports!A${rowIndex}:${String.fromCharCode(64 + headers.length)}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
            values: [row],
        },
    });

    return updatedIncident;
}

// Check if all cases for an incident are in Final Decision status
export async function checkIncidentClosure(
    accessToken: string,
    incidentId: string
): Promise<boolean> {
    // This will be implemented after cases service
    // For now, return false
    return false;
}
