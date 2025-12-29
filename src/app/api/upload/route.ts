import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/drive/client";
import { ensureFolder, uploadFileToFolder } from "@/lib/drive/folders";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const files = formData.getAll("files") as File[];
        const incidentId = (formData.get("incidentId") as string)?.trim();
        const caseId = (formData.get("caseId") as string | null)?.trim();
        const folderType = (formData.get("folderType") as string | null)?.trim(); // e.g., "Appealed"

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        if (!incidentId) {
            return NextResponse.json({ error: "Incident ID is required" }, { status: 400 });
        }

        const maxFiles = 5;
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (files.length > maxFiles) {
            return NextResponse.json({ error: `Maximum ${maxFiles} files allowed` }, { status: 400 });
        }

        // Set up Drive client
        const drive = await getDriveClient();
        const rootFolderId = process.env.DRIVE_FOLDER_ID;

        if (!rootFolderId) {
            return NextResponse.json({ error: "Drive folder not configured" }, { status: 500 });
        }

        // 1. Ensure Incident Folder
        const incidentFolderId = await ensureFolder(drive, rootFolderId, incidentId);
        let targetFolderId = incidentFolderId;

        // 2. Ensure Case Folder (if provided)
        if (caseId) {
            const caseFolderId = await ensureFolder(drive, incidentFolderId, caseId);
            targetFolderId = caseFolderId;

            // 3. Ensure Type Subfolder (if provided, e.g., "Appealed")
            if (folderType) {
                targetFolderId = await ensureFolder(drive, caseFolderId, folderType);
            }
        }

        const uploadedFiles: { name: string; url: string; id: string }[] = [];

        for (const file of files) {
            // Validate file size
            if (file.size > maxSize) {
                return NextResponse.json({ error: `File ${file.name} exceeds 10MB limit` }, { status: 400 });
            }

            // Construct Filename: <email>_<timestamp>_<originalName>
            const activeUser = session.user.email;
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const customName = `${activeUser}_${timestamp}_${file.name}`;

            const uploadedFile = await uploadFileToFolder(drive, targetFolderId, file, customName);

            uploadedFiles.push({
                name: file.name,
                url: uploadedFile.webViewLink,
                id: uploadedFile.id,
            });
        }

        return NextResponse.json({ files: uploadedFiles });
    } catch (error) {
        console.error("Error uploading files:", error);
        const message = error instanceof Error ? error.message : "Failed to upload files";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
