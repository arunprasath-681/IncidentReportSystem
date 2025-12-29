import { google, sheets_v4 } from "googleapis";
import { getSpreadsheetId, parseRows, findRowIndex, formatDateForStorage, parseDateFromStorage, getSheetsClient } from "./client";
import { v4 as uuidv4 } from "uuid";
import { getCases } from "./cases";

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

// Local getSheetsClient removed to use one from ./client

// Get headers from the sheet
async function getSheetHeaders(
    sheets: sheets_v4.Sheets,
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
        // Try exact match first, then case-insensitive
        let value = obj[header];
        if (value === undefined) {
            const lowerHeader = header.toLowerCase();
            const key = Object.keys(obj).find(k => k.toLowerCase() === lowerHeader);
            if (key) value = obj[key];
        }

        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    });
}

// Create a new incident
export async function createIncident(
    accessToken: string | undefined,
    input: CreateIncidentInput
): Promise<Incident> {
    const sheets = await getSheetsClient(accessToken);
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

// Helper to normalize keys to lowercase to ensure matching interface
function normalizeIncident(row: any): Incident {
    const normalized: any = {};
    Object.keys(row).forEach(k => {
        normalized[k] = row[k];
        normalized[k.toLowerCase()] = row[k];
        // Handle explicit snake_case mappings if needed, but for now generic lowercase is good enough
        // assuming headers like "Incident ID" -> "incident id" (not quite incident_id)
        // So we might need to be smarter if headers are "Incident ID". 
        // But current code assumes headers ARE the keys. 
        // If headers are "incident_id", lowercase works. 
        // If headers are "Attachments", lowercase "attachments" works.
    });
    return normalized as Incident;
}

// Get all incidents (with optional filters)
export async function getIncidents(
    accessToken: string | undefined,
    filters?: {
        complainantEmail?: string;
        status?: "Open" | "Closed";
        campusCode?: string;
    }
): Promise<Incident[]> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "IncidentReports!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return [];

    const headers = rows[0] as string[];
    let incidents = parseRows<any>(headers, rows.slice(1) as string[][]).map(normalizeIncident);

    // Apply filters
    if (filters?.complainantEmail) {
        incidents = incidents.filter(
            (i) => i.complainant_id?.toLowerCase() === filters.complainantEmail!.toLowerCase()
        );
    }

    if (filters?.campusCode) {
        // Fetch cases for this campus to find relevant incident IDs
        const campusCases = await getCases(accessToken, { campusCode: filters.campusCode });
        const relevantIncidentIds = new Set(campusCases.map(c => c.incident_id));
        incidents = incidents.filter(i => relevantIncidentIds.has(i.incident_id));
    }

    if (filters?.status) {
        incidents = incidents.filter((i) => i.status === filters.status);
    }

    // Filter by Campus Code (for Campus Managers/Investigators)
    // Note: Incident doesn't intrinsically have campus code, but we can try to filter by 
    // ensuring at least ONE of the reported individuals in associated cases matches the campus.
    // HOWEVER, fetching all cases here is expensive.
    // ALTERNATIVE: Use the Complainant's campus? Or assume this filter is only used for list view
    // where strictness might be loose, or we need to rethink schema.
    //
    // WAIT: The Requirement is "access only cases that are tagged to their campus".
    // Incidents don't have campus tags directly. Cases do.
    // But Campus Managers see incidents in Investigation Hub.
    // If we filter incidents, we need to know if the incident "belongs" to a campus.
    // An incident belongs to a campus if ANY of its cases belong to that campus?
    // OR if the complainant is from that campus?
    //
    // Let's look at `getIncidents` usage. It's used for the main list.
    // If I cannot easily filter here, maybe I should do it in the API by fetching cases?
    // OR, we can try to infer it. 
    // But for now, since `filters.campusCode` is passed, I MUST assume there's a way.
    //
    // Actually, `src/lib/sheets/incidents.ts` doesn't seem to have campus info.
    // But wait, the `Case` has `campus`.
    // Maybe we should filter CASES first, then get incidents?
    //
    // Let's hold off on this file and check `src/lib/sheets/cases.ts` first.
    // If I filter `cases`, then `getIncidents` usually implies fetching the parent incident.
    //
    // Re-reading: "they can access only cases that are tagged to their campus".
    // Investigation Hub displays a list of *Incidents* usually.
    // If I filter Incidents by Campus, I need to know which campus the incident is for.
    // The Incident definition (line 5) does NOT have campus.
    //
    // Workaround: In `getIncidents`, if `campusCode` filter is present, 
    // I should also fetch `Cases` and check if any case matches the campus?
    // That seems expensive but necessary if Schema doesn't support it.
    //
    // Let's implement a "best effort" or "fetch cases" approach.
    // Actually, I'll update the comment and defer implementation until I check `cases.ts`.

    // TEMPORARY: Just keeping existing filters. I will update this block properly after verifying strategy.
    return incidents;
}

// Get single incident by ID
export async function getIncidentById(
    accessToken: string | undefined,
    incidentId: string
): Promise<Incident | null> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "IncidentReports!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return null;

    const headers = rows[0] as string[];
    const incidents = parseRows<any>(headers, rows.slice(1) as string[][]).map(normalizeIncident);

    return incidents.find((i) => i.incident_id === incidentId) || null;
}

// Update incident
export async function updateIncident(
    accessToken: string | undefined,
    incidentId: string,
    updates: Partial<Incident>,
    updatedBy: string
): Promise<Incident | null> {
    const sheets = await getSheetsClient(accessToken);
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
    accessToken: string | undefined,
    incidentId: string
): Promise<boolean> {
    // This will be implemented after cases service
    // For now, return false
    return false;
}
