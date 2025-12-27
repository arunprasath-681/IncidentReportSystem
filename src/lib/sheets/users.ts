import { google } from "googleapis";
import { getSpreadsheetId, parseRows } from "./client";

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
    accessToken: string,
    email: string
): Promise<RoleInfo> {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
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
            const otherUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

            if (otherUser) {
                const roleLower = otherUser.role?.toLowerCase() || "";
                if (["admin", "approver", "investigator"].includes(roleLower)) {
                    return {
                        role: roleLower as UserRole,
                        name: otherUser.name,
                        email: otherUser.email,
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
            const staffMember = staff.find((s) => s.email?.toLowerCase() === email.toLowerCase());

            if (staffMember) {
                const roleLower = staffMember.role?.toLowerCase() || "";
                // Only Campus Manager gets access
                if (roleLower === "campus manager") {
                    return {
                        role: "campus manager",
                        campusCode: staffMember.campus_code,
                        name: staffMember.name,
                        email: staffMember.email,
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
            const student = students.find((s) => s.email?.toLowerCase() === email.toLowerCase());

            if (student) {
                return {
                    role: "student",
                    campusCode: student.campus_code,
                    name: student.name,
                    email: student.email,
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
    accessToken: string
): Promise<Array<{ email: string; name: string; role: string }>> {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
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
                if (u.email && ["admin", "approver", "investigator"].includes(u.role?.toLowerCase())) {
                    results.push({ email: u.email, name: u.name, role: u.role });
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
                if (s.email && s.role?.toLowerCase() === "campus manager") {
                    results.push({ email: s.email, name: s.name, role: "Campus Manager" });
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
    accessToken: string,
    query: string
): Promise<Array<{
    email: string;
    name: string;
    type: "student" | "staff";
    campus_code?: string;
    squad_number?: string;
    status?: string;
}>> {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
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
                .filter((s) =>
                    s.email?.toLowerCase().includes(lowerQuery) ||
                    s.name?.toLowerCase().includes(lowerQuery)
                )
                .slice(0, 10)
                .forEach((s) => {
                    results.push({
                        email: s.email,
                        name: s.name,
                        type: "student",
                        campus_code: s.campus_code,
                        squad_number: s.squad_number,
                        status: s.status,
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
                .filter((s) =>
                    s.email?.toLowerCase().includes(lowerQuery) ||
                    s.name?.toLowerCase().includes(lowerQuery)
                )
                .slice(0, 10)
                .forEach((s) => {
                    results.push({
                        email: s.email,
                        name: s.name,
                        type: "staff",
                        campus_code: s.campus_code,
                        status: s.status,
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
    accessToken: string,
    email: string
): Promise<{ name: string; campusCode: string; squadNumber?: string; type: "student" | "staff" } | null> {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
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
            const student = students.find((s) => s.email?.toLowerCase() === email.toLowerCase());

            if (student) {
                return {
                    name: student.name,
                    campusCode: student.campus_code,
                    squadNumber: student.squad_number,
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
            const staffMember = staff.find((s) => s.email?.toLowerCase() === email.toLowerCase());

            if (staffMember) {
                return {
                    name: staffMember.name,
                    campusCode: staffMember.campus_code,
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
