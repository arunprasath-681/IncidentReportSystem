import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIncidents, createIncident } from "@/lib/sheets/incidents";
import { createCase } from "@/lib/sheets/cases";
import { getUserByEmail } from "@/lib/sheets/users";
import { z } from "zod";
import { sendCaseReportedEmail } from "@/lib/email";

const createIncidentSchema = z.object({
    dateTimeOfIncident: z.string(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    attachments: z.array(z.string()).optional(),
    reportedIndividuals: z.array(z.string().email()).min(1, "At least one reported individual is required"),
    relayedFromCompany: z.boolean().optional(),
    companyName: z.string().optional(),
    companyNotes: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const complainantOnly = searchParams.get("complainantOnly") === "true";
        const status = searchParams.get("status") as "Open" | "Closed" | undefined;

        const filters: {
            complainantEmail?: string;
            status?: "Open" | "Closed";
            campusCode?: string;
        } = {};

        // If user only wants their own reports
        if (complainantOnly) {
            filters.complainantEmail = session.user.email;
        }

        if (status) {
            filters.status = status;
        }

        // Campus Managers can only see their campus cases (unless they're in OtherUsers as Investigator)
        if (session.user.role === "investigator" && session.user.campusCode) {
            filters.campusCode = session.user.campusCode;
        }

        const incidents = await getIncidents(session.accessToken, filters);

        return NextResponse.json({ incidents });
    } catch (error) {
        console.error("Error fetching incidents:", error);
        return NextResponse.json(
            { error: "Failed to fetch incidents" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validationResult = createIncidentSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validationResult.error.issues },
                { status: 400 }
            );
        }

        const data = validationResult.data;

        // Validate all reported individual emails exist
        for (const email of data.reportedIndividuals) {
            const user = await getUserByEmail(session.accessToken, email);
            if (!user) {
                return NextResponse.json(
                    { error: `User with email ${email} not found in the system` },
                    { status: 400 }
                );
            }
        }

        // Get complainant details
        const complainant = await getUserByEmail(session.accessToken, session.user.email);
        const complainantCategory = complainant?.type || "other";

        // Create the incident
        const incident = await createIncident(session.accessToken, {
            complainantEmail: session.user.email,
            complainantCategory,
            dateTimeOfIncident: data.dateTimeOfIncident,
            description: data.description,
            attachments: data.attachments,
            metadata: data.relayedFromCompany
                ? {
                    relayedFromCompany: true,
                    companyName: data.companyName,
                    companyNotes: data.companyNotes,
                }
                : undefined,
        });

        // Create cases for each reported individual
        for (const email of data.reportedIndividuals) {
            const user = await getUserByEmail(session.accessToken, email);
            await createCase(session.accessToken, {
                incidentId: incident.incident_id,
                reportedIndividualEmail: email,
                squad: user?.squadNumber || "",
                campus: user?.campusCode || "",
                createdBy: session.user.email,
            });

            // Send notification
            await sendCaseReportedEmail(email, incident.incident_id, data.description, data.dateTimeOfIncident, data.attachments);
        }

        return NextResponse.json({ incident }, { status: 201 });
    } catch (error) {
        console.error("Error creating incident:", error);
        return NextResponse.json(
            { error: "Failed to create incident" },
            { status: 500 }
        );
    }
}
