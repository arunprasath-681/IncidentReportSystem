import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { updateIncident, getIncidentById } from "@/lib/sheets/incidents";
import { getCasesByIncident, updateCase } from "@/lib/sheets/cases";

export async function GET(
    req: Request,
    props: { params: Promise<{ incidentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user?.email) {
            console.log("[API] Unauthorized GET request to /api/incidents/[incidentId]");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { incidentId } = params;
        console.log(`[API] GET /api/incidents/${incidentId} called`);

        // Fetch Incident
        const incident = await getIncidentById(session.accessToken, incidentId);

        if (!incident) {
            console.log(`[API] Incident ${incidentId} not found`);
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        // Fetch associated Cases
        const cases = await getCasesByIncident(session.accessToken, incidentId);
        console.log(`[API] Found ${cases.length} cases for incident ${incidentId}`);

        return NextResponse.json({ incident, cases });
    } catch (error) {
        console.error("Error fetching incident:", error);
        return NextResponse.json(
            { error: "Failed to fetch incident" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: Request,
    props: { params: Promise<{ incidentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await req.json();
        const { incidentId } = params;
        console.log(`[API] PATCH /api/incidents/${incidentId} called`);

        // Verify access (optional: check if user is allowed to edit)
        // For now, allowing creators and qualified roles

        // 1. Update the Incident
        const updatedIncident = await updateIncident(
            session.accessToken,
            incidentId,
            data,
            session.user.email
        );

        if (!updatedIncident) {
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        // 2. Sync Attachments to Cases if they were updated
        if (data.attachments) {
            const cases = await getCasesByIncident(session.accessToken, incidentId);

            // The `data.attachments` from request is likely an array of strings (URLs).
            const attachmentsStr = JSON.stringify(data.attachments);

            const updatePromises = cases.map(c =>
                updateCase(
                    session.accessToken,
                    c.case_id,
                    { attachments: attachmentsStr },
                    session.user.email! // updating as the current user
                )
            );

            await Promise.all(updatePromises);
            console.log(`Synced attachments to ${cases.length} cases for incident ${incidentId}`);
        }

        return NextResponse.json(updatedIncident);
    } catch (error) {
        console.error("Error updating incident:", error);
        return NextResponse.json(
            { error: "Failed to update incident" },
            { status: 500 }
        );
    }
}
