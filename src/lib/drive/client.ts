import { google, drive_v3 } from "googleapis";

export async function getDriveClient(): Promise<drive_v3.Drive> {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
    });

    const client = await auth.getClient();

    return google.drive({ version: "v3", auth: client as any });
}
