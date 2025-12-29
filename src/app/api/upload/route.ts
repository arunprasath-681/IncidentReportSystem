import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";
import { getDriveClient } from "@/lib/drive/client";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const files = formData.getAll("files") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        const maxFiles = 5;
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (files.length > maxFiles) {
            return NextResponse.json({ error: `Maximum ${maxFiles} files allowed` }, { status: 400 });
        }

        // Set up Drive client
        // Set up Drive client with Service Account
        const drive = await getDriveClient();

        const folderId = process.env.DRIVE_FOLDER_ID;
        if (!folderId) {
            return NextResponse.json({ error: "Drive folder not configured" }, { status: 500 });
        }

        const uploadedFiles: { name: string; url: string; id: string }[] = [];

        for (const file of files) {
            // Validate file size
            if (file.size > maxSize) {
                return NextResponse.json({ error: `File ${file.name} exceeds 10MB limit` }, { status: 400 });
            }

            // Convert file to buffer
            const buffer = Buffer.from(await file.arrayBuffer());

            // Upload to Drive
            const response = await drive.files.create({
                requestBody: {
                    name: `${Date.now()}_${file.name}`,
                    parents: [folderId],
                },
                media: {
                    mimeType: file.type,
                    body: require("stream").Readable.from(buffer),
                },
                fields: "id, name, webViewLink",
                supportsAllDrives: true,
            });

            // Make the file viewable by anyone with the link
            await drive.permissions.create({
                fileId: response.data.id!,
                requestBody: {
                    role: "reader",
                    type: "anyone",
                },
                supportsAllDrives: true,
            });

            // Get the updated file with webViewLink
            const fileInfo = await drive.files.get({
                fileId: response.data.id!,
                fields: "id, name, webViewLink",
                supportsAllDrives: true,
            });

            uploadedFiles.push({
                name: file.name,
                url: fileInfo.data.webViewLink || "",
                id: fileInfo.data.id || "",
            });
        }

        return NextResponse.json({ files: uploadedFiles });
    } catch (error) {
        console.error("Error uploading files:", error);
        const message = error instanceof Error ? error.message : "Failed to upload files";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
