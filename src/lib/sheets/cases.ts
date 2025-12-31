import { google, sheets_v4 } from "googleapis";
import { getSpreadsheetId, parseRows, findRowIndex, formatDateForStorage, parseDateFromStorage, getSheetsClient } from "./client";
import { v4 as uuidv4 } from "uuid";

export type CaseStatus =
    | "Pending Investigation"
    | "Investigation Submitted"
    | "Verdict Given"
    | "Appealed"
    | "Final Decision";

export type CategoryOfOffence =
    | "Breach of student code of conduct"
    | "Breach of mentor code of conduct"
    | "Breach of internship code of conduct";

export type Verdict = "Guilty" | "Not Guilty";

export interface Case {
    case_id: string;
    incident_id: string;
    reported_individual_id: string;
    squad: string;
    campus: string;
    category_of_offence: string;
    sub_category_of_offence: string;
    level_of_offence: string;
    case_comments: string;
    attachments: string; // JSON array
    verdict: string;
    punishment: string;
    case_status: CaseStatus;
    appeal_reason: string;
    appeal_submitted_at?: string;
    appeal_attachments: string; // JSON array
    investigator_attachments: string; // JSON array
    approver_attachments: string; // JSON array
    review_comments: string;
    last_updated_by: string;
    last_updated_at: string;
    metadata_changelog: string; // JSON object for changelog
}

export interface CreateCaseInput {
    incidentId: string;
    reportedIndividualEmail: string;
    squad: string;
    campus: string;
    createdBy: string;
    attachments?: string[];
}

import { SUB_CATEGORIES } from "../constants";

export { SUB_CATEGORIES }; // Re-export if used elsewhere, but mainly use it.


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

// Helper to normalize keys to lowercase to ensure matching interface
function normalizeCase(row: any): Case {
    const normalized: any = {};
    Object.keys(row).forEach(k => {
        normalized[k] = row[k];
        normalized[k.toLowerCase()] = row[k];
    });
    return normalized as Case;
}

// Create a new case
export async function createCase(
    accessToken: string | undefined,
    input: CreateCaseInput
): Promise<Case> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    // Get actual headers from the sheet
    const headers = await getSheetHeaders(sheets, "Cases");

    // Generate Sequential ID
    const newId = await generateNextCaseId(sheets, spreadsheetId, input.incidentId);

    const now = formatDateForStorage();
    const newCase: Case = {
        case_id: newId,
        incident_id: input.incidentId,
        reported_individual_id: input.reportedIndividualEmail,
        squad: input.squad,
        campus: input.campus,
        category_of_offence: "",
        sub_category_of_offence: "",
        level_of_offence: "",
        case_comments: "",
        attachments: JSON.stringify(input.attachments || []),
        investigator_attachments: "[]",
        approver_attachments: "[]",
        verdict: "",
        punishment: "",
        case_status: "Pending Investigation",
        appeal_reason: "",
        appeal_attachments: "[]",
        review_comments: "",
        last_updated_by: input.createdBy,
        last_updated_at: now,
        metadata_changelog: JSON.stringify({
            changelog: [
                {
                    action: "created",
                    by: input.createdBy,
                    at: now,
                },
            ],
        }),
    };

    const row = objectToRowDynamic(headers, newCase as unknown as Record<string, unknown>);

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `Cases!A:${String.fromCharCode(64 + headers.length)}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
            values: [row],
        },
    });

    return newCase;
}

async function generateNextCaseId(sheets: sheets_v4.Sheets, spreadsheetId: string, incidentId: string): Promise<string> {
    // 1. Determine Incident Suffix
    // Format: INCYYYYABCD -> YYYYABCD
    // If not matching, fallback to last 8 chars (legacy support)
    let incidentSuffix = "";
    if (incidentId.startsWith("INC") && incidentId.length === 11 && !isNaN(parseInt(incidentId.substring(3)))) {
        // Standard new format: INC + 4 digit year + 4 digit id = 11 chars.
        // Wait, INC20250001 is 3+4+4 = 11? 
        // "INC" (3) + "2025" (4) + "0001" (4) = 11. Yes.
        incidentSuffix = incidentId.substring(3);
    } else {
        // Fallback for UUIDs or other formats: use last 8 chars to try and be consistent?
        // Or just append Case sequence to the full ID if it's not too long?
        // Request says: CASE-<last 8digist of incident id>-abc
        // If UUID: INC-1234-.... 
        // Let's take last 8 chars of whatever string it is.
        incidentSuffix = incidentId.slice(-8);
    }

    const prefix = `CASE-${incidentSuffix}-`;

    // 2. Fetch existing cases to find max sequence for THIS incident prefix
    // Only need Case ID column (Col A usually)
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Cases!A:A", // Assuming Case ID is in Col A
    });

    const rows = response.data.values || [];
    const ids = rows.slice(1).map(r => r[0] as string).filter(id => id && id.startsWith(prefix));

    let maxSeq = 0;
    for (const id of ids) {
        const seqPart = id.substring(prefix.length); // "001"
        const seq = parseInt(seqPart, 10);
        if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
        }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${nextSeq.toString().padStart(3, "0")}`; // CASE-20250001-001



}

// Get cases by incident
export async function getCasesByIncident(
    accessToken: string | undefined,
    incidentId: string
): Promise<Case[]> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Cases!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return [];

    const headers = rows[0] as string[];
    const cases = parseRows<Case>(headers, rows.slice(1) as string[][]).map(normalizeCase);

    return cases.filter((c) => c.incident_id === incidentId);
}

// Get all cases (with filters)
export async function getCases(
    accessToken: string | undefined,
    filters?: {
        status?: CaseStatus;
        campusCode?: string;
        reportedIndividualEmail?: string;
    }
): Promise<Case[]> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Cases!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return [];

    const headers = rows[0] as string[];
    let cases = parseRows<Case>(headers, rows.slice(1) as string[][]).map(normalizeCase);

    if (filters?.status) {
        cases = cases.filter((c) => c.case_status === filters.status);
    }

    if (filters?.campusCode) {
        cases = cases.filter((c) => c.campus === filters.campusCode);
    }

    if (filters?.reportedIndividualEmail) {
        cases = cases.filter(
            (c) => c.reported_individual_id?.toLowerCase() === filters.reportedIndividualEmail!.toLowerCase()
        );
    }

    // Sort by case_id descending (latest first)
    cases.sort((a, b) => b.case_id.localeCompare(a.case_id));

    return cases;
}

// Get single case by ID
export async function getCaseById(
    accessToken: string | undefined,
    caseId: string
): Promise<Case | null> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Cases!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return null;

    const headers = rows[0] as string[];
    const cases = parseRows<Case>(headers, rows.slice(1) as string[][]).map(normalizeCase);

    return cases.find((c) => c.case_id === caseId) || null;
}

// Update case (investigation details)
export async function updateCase(
    accessToken: string | undefined,
    caseId: string,
    updates: Partial<Case>,
    updatedBy: string
): Promise<Case | null> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    // Get actual headers from the sheet
    const headers = await getSheetHeaders(sheets, "Cases");

    const rowIndex = await findRowIndex(sheets, "Cases", "case_id", caseId);
    if (!rowIndex) return null;

    const currentCase = await getCaseById(accessToken, caseId);
    if (!currentCase) return null;

    // Validate status transitions
    if (updates.case_status) {
        const validTransition = validateStatusTransition(
            currentCase.case_status,
            updates.case_status,
            currentCase.level_of_offence,
            currentCase.category_of_offence
        );
        if (!validTransition) {
            throw new Error(`Invalid status transition from ${currentCase.case_status} to ${updates.case_status}`);
        }
    }

    // Add to changelog
    const metadata = JSON.parse(currentCase.metadata_changelog || "{}");
    const changelog = metadata.changelog || [];
    changelog.push({
        action: updates.case_status ? `status_changed_to_${updates.case_status}` : "updated",
        by: updatedBy,
        at: formatDateForStorage(),
        changes: Object.keys(updates),
    });

    const updatedCase: Case = {
        ...currentCase,
        ...updates,
        last_updated_by: updatedBy,
        last_updated_at: formatDateForStorage(),
        metadata_changelog: JSON.stringify({ ...metadata, changelog }),
    };

    const row = objectToRowDynamic(headers, updatedCase as unknown as Record<string, unknown>);

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Cases!A${rowIndex}:${String.fromCharCode(64 + headers.length)}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
            values: [row],
        },
    });

    return updatedCase;
}

// Submit investigation
export async function submitInvestigation(
    accessToken: string | undefined,
    caseId: string,
    data: {
        categoryOfOffence: string;
        subCategoryOfOffence: string;
        levelOfOffence: string;
        caseComments: string;
        attachments?: string[];
    },
    submittedBy: string
): Promise<Case | null> {
    return updateCase(
        accessToken,
        caseId,
        {
            category_of_offence: data.categoryOfOffence,
            sub_category_of_offence: data.subCategoryOfOffence,
            level_of_offence: data.levelOfOffence,
            case_comments: data.caseComments,
            investigator_attachments: JSON.stringify(data.attachments || []),
            case_status: "Investigation Submitted",
        },
        submittedBy
    );
}

// Record verdict
export async function recordVerdict(
    accessToken: string | undefined,
    caseId: string,
    data: {
        verdict: Verdict;
        punishment?: string;
        attachments?: string[];
        newLevelOfOffence?: string;
        newCategoryOfOffence?: string;
        newSubCategoryOfOffence?: string;
    },
    recordedBy: string
): Promise<Case | null> {
    const currentCase = await getCaseById(accessToken, caseId);
    if (!currentCase) return null;

    const updates: Partial<Case> = {
        verdict: data.verdict,
        punishment: data.punishment || "",
        approver_attachments: JSON.stringify(data.attachments || []),
    };

    if (data.newLevelOfOffence) updates.level_of_offence = data.newLevelOfOffence;
    if (data.newCategoryOfOffence) updates.category_of_offence = data.newCategoryOfOffence;
    if (data.newSubCategoryOfOffence) updates.sub_category_of_offence = data.newSubCategoryOfOffence;

    // Determine status based on POTENTIALLY NEW values
    const levelNum = parseInt(updates.level_of_offence || currentCase.level_of_offence) || 0;
    const category = updates.category_of_offence || currentCase.category_of_offence;

    let newStatus: CaseStatus = "Verdict Given";

    // For lesser offenses, go straight to Final Decision
    if (category === "Breach of student code of conduct" && levelNum <= 3) {
        newStatus = "Final Decision";
    } else if (category === "Breach of internship code of conduct" && levelNum <= 2) {
        newStatus = "Final Decision";
    } else if (data.verdict === "Not Guilty") {
        newStatus = "Final Decision";
    }

    updates.case_status = newStatus;

    return updateCase(accessToken, caseId, updates, recordedBy);
}

// Submit appeal
export async function submitAppeal(
    accessToken: string | undefined,
    caseId: string,
    data: {
        appealReason: string;
        appealAttachments?: string[];
    },
    submittedBy: string
): Promise<Case | null> {
    const currentCase = await getCaseById(accessToken, caseId);
    if (!currentCase) return null;

    // Verify appeal is allowed
    if (currentCase.case_status !== "Verdict Given" || currentCase.verdict !== "Guilty") {
        throw new Error("Appeals can only be submitted for Guilty verdicts");
    }

    const levelNum = parseInt(currentCase.level_of_offence) || 0;
    const category = currentCase.category_of_offence;

    // Check if appeal is allowed based on level
    if (category === "Breach of student code of conduct" && levelNum < 4) {
        throw new Error("Appeals are only allowed for Level 4 offences in Student Code of Conduct");
    }
    if (category === "Breach of internship code of conduct" && levelNum < 3) {
        throw new Error("Appeals are only allowed for Level 3 offences in Internship Code of Conduct");
    }

    return updateCase(
        accessToken,
        caseId,
        {
            appeal_reason: data.appealReason,
            appeal_attachments: JSON.stringify(data.appealAttachments || []),
            appeal_submitted_at: formatDateForStorage(),
            case_status: "Appealed",
        },
        submittedBy
    );
}

// Resolve appeal (Final Decision)
export async function resolveAppeal(
    accessToken: string | undefined,
    caseId: string,
    data: {
        reviewComments: string;
        finalVerdict: "Uphold Original" | "Overturn to Not Guilty" | "Modify Level";
        newLevelOfOffence?: string;
        newCategoryOfOffence?: string;
        newSubCategoryOfOffence?: string;
        punishment?: string;
    },
    resolvedBy: string
): Promise<Case | null> {
    const updates: Partial<Case> = {
        review_comments: data.reviewComments,
        case_status: "Final Decision",
    };

    if (data.finalVerdict === "Overturn to Not Guilty") {
        updates.verdict = "Not Guilty";
        updates.punishment = "";
    } else if (data.finalVerdict === "Modify Level") {
        if (data.newLevelOfOffence) updates.level_of_offence = data.newLevelOfOffence;
        if (data.newCategoryOfOffence) updates.category_of_offence = data.newCategoryOfOffence;
        if (data.newSubCategoryOfOffence) updates.sub_category_of_offence = data.newSubCategoryOfOffence;
    }

    if (data.punishment) {
        updates.punishment = data.punishment;
    }

    return updateCase(accessToken, caseId, updates, resolvedBy);
}

// Validate status transitions
function validateStatusTransition(
    currentStatus: CaseStatus,
    newStatus: CaseStatus,
    levelOfOffence: string,
    categoryOfOffence: string
): boolean {
    const validTransitions: Record<CaseStatus, CaseStatus[]> = {
        "Pending Investigation": ["Investigation Submitted"],
        "Investigation Submitted": ["Verdict Given", "Pending Investigation", "Final Decision"],
        "Verdict Given": ["Final Decision", "Appealed"],
        "Appealed": ["Final Decision"],
        "Final Decision": [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

// Check if all cases for incident are in Final Decision
export async function areAllCasesFinalized(
    accessToken: string,
    incidentId: string
): Promise<boolean> {
    const cases = await getCasesByIncident(accessToken, incidentId);
    if (cases.length === 0) return false;
    return cases.every((c) => c.case_status === "Final Decision");
}
