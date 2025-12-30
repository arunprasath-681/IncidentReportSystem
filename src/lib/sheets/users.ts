import { google } from "googleapis";
import { getSpreadsheetId, parseRows, getSheetsClient } from "./client";

// Helper for case-insensitive property access
function getCaseInsensitive(obj: any, key: string): string | undefined {
    if (!obj) return undefined;
    // Try exact match first
    if (obj[key] !== undefined) return obj[key];
    // Try case-insensitive match
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    return foundKey ? obj[foundKey] : undefined;
}

export type UserRole =
    | "admin"
    | "approver"
    | "investigator"
    | "campus manager"
    | "student"
    | "not_authorized";

export interface Student {
    student_id: string;
    name: string;
    email: string;
    squad_number: string;
    campus_code: string;
    status: string;
}

export interface Staff {
    staff_id: string;
    name: string;
    email: string;
    campus_code: string;
    role: string;
    status: string;
}

export interface OtherUser {
    user_id: string;
    name: string;
    email: string;
    role: string;
    scope: string;
    status: string;
}

interface RoleInfo {
    role: UserRole;
    campusCode?: string;
    name?: string;
    email?: string;
    category?: "staff" | "other";
    isAuthorized: boolean;
}

// Fetch user role from spreadsheets - called during login
export async function getUserRole(email: string): Promise<RoleInfo> {
    // Default to not_authorized - will be refined after login with token
    return {
        role: "not_authorized",
        isAuthorized: false,
    };
}

// Fetch user role with access token (called from API routes after login)
export async function getUserRoleWithToken(
    accessToken: string | undefined,
    email: string
): Promise<RoleInfo> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    try {
        // Check OtherUsers table first (Admin, Approver, Investigator)
        const otherUsersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "OtherUsers!A:F",
        });

        const otherUsersRows = otherUsersResponse.data.values;
        if (otherUsersRows && otherUsersRows.length > 1) {
            const headers = otherUsersRows[0] as string[];
            const users = parseRows<OtherUser>(headers, otherUsersRows.slice(1) as string[][]);
            const otherUser = users.find((u) => {
                const uEmail = getCaseInsensitive(u, "email");
                return uEmail?.trim().toLowerCase() === email.trim().toLowerCase();
            });

            if (otherUser) {
                const status = getCaseInsensitive(otherUser, "status");
                if (status?.trim().toLowerCase() === "inactive") {
                    console.log(`User ${email} is inactive.`);
                    return { role: "not_authorized", isAuthorized: false };
                }

                const roleVal = getCaseInsensitive(otherUser, "role");
                const roleLower = roleVal?.trim().toLowerCase() || "";
                if (["admin", "approver", "investigator"].includes(roleLower)) {
                    return {
                        role: roleLower as UserRole,
                        name: getCaseInsensitive(otherUser, "name") || otherUser.name,
                        email: getCaseInsensitive(otherUser, "email") || otherUser.email,
                        category: "other",
                        isAuthorized: true,
                    };
                }
            }
        }

        // Check Staff table for Campus Manager
        const staffResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Staff!A:F",
        });

        const staffRows = staffResponse.data.values;
        if (staffRows && staffRows.length > 1) {
            const headers = staffRows[0] as string[];
            const staff = parseRows<Staff>(headers, staffRows.slice(1) as string[][]);
            const staffMember = staff.find((s) => {
                const sEmail = getCaseInsensitive(s, "email");
                return sEmail?.trim().toLowerCase() === email.trim().toLowerCase();
            });

            if (staffMember) {
                const status = getCaseInsensitive(staffMember, "status");
                if (status?.trim().toLowerCase() === "inactive") {
                    console.log(`Staff ${email} is inactive.`);
                    return { role: "not_authorized", isAuthorized: false };
                }

                const roleVal = getCaseInsensitive(staffMember, "role");
                const roleLower = roleVal?.trim().toLowerCase() || "";

                // Only Campus Manager gets access
                if (roleLower === "campus manager" || roleLower === "campus_manager") {
                    return {
                        role: "campus manager",
                        campusCode: getCaseInsensitive(staffMember, "campus_code") || staffMember.campus_code,
                        name: getCaseInsensitive(staffMember, "name") || staffMember.name,
                        email: getCaseInsensitive(staffMember, "email") || staffMember.email,
                        category: "staff",
                        isAuthorized: true,
                    };
                }
            }
        }

        // Check Students table
        const studentsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Students!A:F",
        });

        const studentRows = studentsResponse.data.values;
        if (studentRows && studentRows.length > 1) {
            const headers = studentRows[0] as string[];
            const students = parseRows<Student>(headers, studentRows.slice(1) as string[][]);
            const student = students.find((s) => {
                const sEmail = getCaseInsensitive(s, "email");
                return sEmail?.trim().toLowerCase() === email.trim().toLowerCase();
            });

            if (student) {
                const status = getCaseInsensitive(student, "status");
                if (status?.trim().toLowerCase() === "inactive") {
                    console.log(`Student ${email} is inactive.`);
                    return { role: "not_authorized", isAuthorized: false };
                }

                return {
                    role: "student",
                    campusCode: getCaseInsensitive(student, "campus_code") || student.campus_code,
                    name: getCaseInsensitive(student, "name") || student.name,
                    email: getCaseInsensitive(student, "email") || student.email,
                    category: "other", // treating as other/student category
                    isAuthorized: true,
                };
            }
        }

        // Not found in OtherUsers or Staff as Campus Manager - NOT AUTHORIZED
        return {
            role: "not_authorized",
            isAuthorized: false,
        };
    } catch (error) {
        console.error("Error fetching user role with token:", error);
        return {
            role: "not_authorized",
            isAuthorized: false,
        };
    }
}

// Get all authorized users (for admin impersonation)
export async function getAllAuthorizedUsers(
    accessToken: string | undefined
): Promise<Array<{ email: string; name: string; role: string }>> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const results: Array<{ email: string; name: string; role: string }> = [];

    try {
        // Get from OtherUsers
        const otherUsersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "OtherUsers!A:F",
        });

        const otherUsersRows = otherUsersResponse.data.values;
        if (otherUsersRows && otherUsersRows.length > 1) {
            const headers = otherUsersRows[0] as string[];
            const users = parseRows<OtherUser>(headers, otherUsersRows.slice(1) as string[][]);
            users.forEach((u) => {
                const uEmail = getCaseInsensitive(u, "email");
                const uRole = getCaseInsensitive(u, "role");
                if (uEmail && ["admin", "approver", "investigator"].includes(uRole?.toLowerCase() || "")) {
                    results.push({
                        email: uEmail,
                        name: getCaseInsensitive(u, "name") || u.name,
                        role: uRole || u.role
                    });
                }
            });
        }

        // Get Campus Managers from Staff
        const staffResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Staff!A:F",
        });

        const staffRows = staffResponse.data.values;
        if (staffRows && staffRows.length > 1) {
            const headers = staffRows[0] as string[];
            const staff = parseRows<Staff>(headers, staffRows.slice(1) as string[][]);
            staff.forEach((s) => {
                const sEmail = getCaseInsensitive(s, "email");
                const sRole = getCaseInsensitive(s, "role");
                if (sEmail && (sRole?.toLowerCase() === "campus manager" || sRole?.toLowerCase() === "campus_manager")) {
                    results.push({
                        email: sEmail,
                        name: getCaseInsensitive(s, "name") || s.name,
                        role: "Campus Manager"
                    });
                }
            });
        }

        return results;
    } catch (error) {
        console.error("Error fetching authorized users:", error);
        return [];
    }
}

// Search users by email (for autocomplete in forms)
export async function searchUsers(
    accessToken: string | undefined,
    query: string
): Promise<Array<{
    email: string;
    name: string;
    type: "student" | "staff";
    campus_code?: string;
    squad_number?: string;
    status?: string;
}>> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    const results: Array<{
        email: string;
        name: string;
        type: "student" | "staff";
        campus_code?: string;
        squad_number?: string;
        status?: string;
    }> = [];
    const lowerQuery = query.toLowerCase();

    try {
        // Search Students
        const studentsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Students!A:F",
        });

        const studentRows = studentsResponse.data.values;
        if (studentRows && studentRows.length > 1) {
            const headers = studentRows[0] as string[];
            const students = parseRows<Student>(headers, studentRows.slice(1) as string[][]);

            students
                .filter((s) => {
                    const sEmail = getCaseInsensitive(s, "email")?.toLowerCase();
                    const sName = getCaseInsensitive(s, "name")?.toLowerCase();
                    return (sEmail && sEmail.includes(lowerQuery)) || (sName && sName.includes(lowerQuery));
                })
                .slice(0, 10)
                .forEach((s) => {
                    results.push({
                        email: getCaseInsensitive(s, "email") || "",
                        name: getCaseInsensitive(s, "name") || "",
                        type: "student",
                        campus_code: getCaseInsensitive(s, "campus_code"),
                        squad_number: getCaseInsensitive(s, "squad_number"),
                        status: getCaseInsensitive(s, "status"),
                    });
                });
        }

        // Search Staff
        const staffResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Staff!A:F",
        });

        const staffRows = staffResponse.data.values;
        if (staffRows && staffRows.length > 1) {
            const headers = staffRows[0] as string[];
            const staff = parseRows<Staff>(headers, staffRows.slice(1) as string[][]);

            staff
                .filter((s) => {
                    const sEmail = getCaseInsensitive(s, "email")?.toLowerCase();
                    const sName = getCaseInsensitive(s, "name")?.toLowerCase();
                    return (sEmail && sEmail.includes(lowerQuery)) || (sName && sName.includes(lowerQuery));
                })
                .slice(0, 10)
                .forEach((s) => {
                    results.push({
                        email: getCaseInsensitive(s, "email") || "",
                        name: getCaseInsensitive(s, "name") || "",
                        type: "staff",
                        campus_code: getCaseInsensitive(s, "campus_code"),
                        status: getCaseInsensitive(s, "status"),
                    });
                });
        }

        return results.slice(0, 15);
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
}

// Get user details by email
export async function getUserByEmail(
    accessToken: string | undefined,
    email: string
): Promise<{ name: string; campusCode: string; squadNumber?: string; type: "student" | "staff" } | null> {
    const sheets = await getSheetsClient(accessToken);
    const spreadsheetId = getSpreadsheetId();

    try {
        // Check Students
        const studentsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Students!A:F",
        });

        const studentRows = studentsResponse.data.values;
        if (studentRows && studentRows.length > 1) {
            const headers = studentRows[0] as string[];
            const students = parseRows<Student>(headers, studentRows.slice(1) as string[][]);
            const student = students.find((s) => getCaseInsensitive(s, "email")?.toLowerCase() === email.toLowerCase());

            if (student) {
                return {
                    name: getCaseInsensitive(student, "name") || "",
                    campusCode: getCaseInsensitive(student, "campus_code") || "",
                    squadNumber: getCaseInsensitive(student, "squad_number"),
                    type: "student",
                };
            }
        }

        // Check Staff
        const staffResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Staff!A:F",
        });

        const staffRows = staffResponse.data.values;
        if (staffRows && staffRows.length > 1) {
            const headers = staffRows[0] as string[];
            const staff = parseRows<Staff>(headers, staffRows.slice(1) as string[][]);
            const staffMember = staff.find((s) => getCaseInsensitive(s, "email")?.toLowerCase() === email.toLowerCase());

            if (staffMember) {
                return {
                    name: getCaseInsensitive(staffMember, "name") || "",
                    campusCode: getCaseInsensitive(staffMember, "campus_code") || "",
                    type: "staff",
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error getting user by email:", error);
        return null;
    }
}
