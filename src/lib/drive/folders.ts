
import { drive_v3 } from "googleapis";
import { getDriveClient } from "./client";

/**
 * Ensures a folder exists within a parent folder.
 * If it exists, returns its ID.
 * If not, creates it and returns the new ID.
 */
export async function ensureFolder(drive: drive_v3.Drive, parentId: string, folderName: string): Promise<string> {
    try {
        // Check if folder exists
        const query = `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and name='${folderName}' and trashed=false`;
        const res = await drive.files.list({
            q: query,
            fields: "files(id, name)",
            spaces: "drive",
        });

        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0].id!;
        }

        // Create folder
        const fileMetadata = {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id",
            supportsAllDrives: true,
        });

        return file.data.id!;
    } catch (error) {
        console.error(`Error ensuring folder '${folderName}' in '${parentId}':`, error);
        throw error;
    }
}

/**
 * Uploads a file to a specific folder with a custom name.
 */
export async function uploadFileToFolder(
    drive: drive_v3.Drive,
    folderId: string,
    file: File,
    customName: string
): Promise<{ id: string; name: string; webViewLink: string }> {
    const buffer = Buffer.from(await file.arrayBuffer());

    const response = await drive.files.create({
        requestBody: {
            name: customName,
            parents: [folderId],
        },
        media: {
            mimeType: file.type,
            body: require("stream").Readable.from(buffer),
        },
        fields: "id, name, webViewLink",
        supportsAllDrives: true,
    });

    // Make public reader
    await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
            role: "reader",
            type: "anyone",
        },
        supportsAllDrives: true,
    });

    return {
        id: response.data.id!,
        name: response.data.name!,
        webViewLink: response.data.webViewLink!,
    };
}
