import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIncidentById, updateIncident } from "@/lib/sheets/incidents";
import { getCasesByIncident, areAllCasesFinalized, updateCase } from "@/lib/sheets/cases";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const incident = await getIncidentById(session.accessToken, id);

        if (!incident) {
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        // Get associated cases
        const cases = await getCasesByIncident(session.accessToken, id);

        // Check access: complainant can only view their own incidents
        const isComplainant = incident.complainant_id.toLowerCase() === session.user.email.toLowerCase();
        const isStaff = ["investigator", "approver", "admin", "campus manager"].includes(session.user.role);
        const isReportedIndividual = cases.some(
            (c) => c.reported_individual_id.toLowerCase() === session.user.email.toLowerCase()
        );

        if (!isComplainant && !isStaff && !isReportedIndividual) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Campus Manager Restriction: Can only view if at least one case belongs to their campus
        if (session.user.role === "campus manager" && session.user.campusCode) {
            const hasCampusCase = cases.some(c => c.campus === session.user.campusCode);
            if (!hasCampusCase) {
                return NextResponse.json({ error: "Forbidden: Not authorized for this campus" }, { status: 403 });
            }
        }

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
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // Check if user is complainant or staff
        let authorized = false;
        if (["investigator", "approver", "admin"].includes(session.user.role)) {
            authorized = true;
        } else {
            // Check if user is the complainant for this incident
            // We need to fetch the incident first to check ownership if not staff
            const existingIncident = await getIncidentById(session.accessToken, id);
            if (existingIncident && existingIncident.complainant_id.toLowerCase() === session.user.email.toLowerCase()) {
                authorized = true;
                // Optional: Restrict what complainants can update (e.g., only attachments)
                // For now, we allow updates as they are trusting the UI logic
            }
        }

        if (!authorized) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Check if all cases are finalized, if so, close the incident
        if (body.checkClosure) {
            const allFinalized = await areAllCasesFinalized(session.accessToken, id);
            if (allFinalized) {
                body.status = "Closed";
            }
        }

        const updatedIncident = await updateIncident(
            session.accessToken,
            id,
            body,
            session.user.email
        );

        if (!updatedIncident) {
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        // Sync attachments to associated cases if they were updated
        if (body.attachments) {
            const cases = await getCasesByIncident(session.accessToken, id);
            for (const c of cases) {
                await updateCase(
                    session.accessToken,
                    c.case_id,
                    { attachments: body.attachments },
                    session.user.email
                );
            }
        }

        return NextResponse.json({ incident: updatedIncident });
    } catch (error) {
        console.error("Error updating incident:", error);
        return NextResponse.json(
            { error: "Failed to update incident" },
            { status: 500 }
        );
    }
}
