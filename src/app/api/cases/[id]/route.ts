import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getCaseById,
    updateCase,
    submitInvestigation,
    recordVerdict,
    submitAppeal,
    resolveAppeal,
    areAllCasesFinalized,
    type Verdict,
} from "@/lib/sheets/cases";
import { updateIncident, getIncidentById } from "@/lib/sheets/incidents";
import { getUserByEmail, getAllAuthorizedUsers } from "@/lib/sheets/users";
import {
    sendStatusUpdateEmail,
    sendAppealConfirmationEmail,
    sendAppealNotificationEmail,
    sendReinvestigationNotificationEmail
} from "@/lib/email";
import { z } from "zod";

const investigationSchema = z.object({
    categoryOfOffence: z.string(),
    subCategoryOfOffence: z.string(),
    levelOfOffence: z.string(),
    caseComments: z.string(),
    attachments: z.array(z.string()).optional(),
});

const verdictSchema = z.object({
    verdict: z.enum(["Guilty", "Not Guilty"]),
    punishment: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    newLevelOfOffence: z.string().optional(),
    newCategoryOfOffence: z.string().optional(),
    newSubCategoryOfOffence: z.string().optional(),
});

const appealSchema = z.object({
    appealReason: z.string().min(10),
    appealAttachments: z.array(z.string()).optional(),
});

const resolveAppealSchema = z.object({
    reviewComments: z.string().min(1),
    finalVerdict: z.enum(["Uphold Original", "Overturn to Not Guilty", "Modify Level"]),
    newLevelOfOffence: z.string().optional(),
    newCategoryOfOffence: z.string().optional(),
    newSubCategoryOfOffence: z.string().optional(),
    punishment: z.string().optional(),
});

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
        const caseData = await getCaseById(session.accessToken, id);

        if (!caseData) {
            return NextResponse.json({ error: "Case not found" }, { status: 404 });
        }

        const role = (session.user.role || "").toLowerCase();

        // Check access
        const isReportedIndividual =
            caseData.reported_individual_id?.toLowerCase() === session.user.email.toLowerCase();
        const isInvestigatorOrAbove = ["investigator", "campus manager", "approver", "admin"].includes(role);

        if (!isReportedIndividual && !isInvestigatorOrAbove) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ case: caseData });
    } catch (error) {
        console.error("Error fetching case:", error);
        return NextResponse.json({ error: "Failed to fetch case" }, { status: 500 });
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
        const action = body.action;
        const role = (session.user.role || "").toLowerCase();

        let updatedCase;

        switch (action) {
            case "submit_investigation": {
                if (!["investigator", "campus manager", "admin"].includes(role)) {
                    return NextResponse.json({ error: "Forbidden - not an investigator" }, { status: 403 });
                }
                const data = investigationSchema.parse(body.data);
                updatedCase = await submitInvestigation(
                    session.accessToken,
                    id,
                    data,
                    session.user.email
                );
                break;
            }

            case "record_verdict": {
                if (!["approver", "admin"].includes(role)) {
                    return NextResponse.json({ error: "Forbidden - not an approver" }, { status: 403 });
                }
                const data = verdictSchema.parse(body.data);
                updatedCase = await recordVerdict(
                    session.accessToken,
                    id,
                    data as {
                        verdict: Verdict;
                        punishment?: string;
                        attachments?: string[];
                        newLevelOfOffence?: string;
                        newCategoryOfOffence?: string;
                        newSubCategoryOfOffence?: string;
                    },
                    session.user.email
                );


                // Check if all cases are finalized
                const allFinalized = await areAllCasesFinalized(session.accessToken, updatedCase?.incident_id || "");
                if (allFinalized && updatedCase?.incident_id) {
                    await updateIncident(session.accessToken, updatedCase.incident_id, { status: "Closed" }, "system");
                }

                // Send Email Notification
                if (updatedCase && updatedCase.reported_individual_id && updatedCase.incident_id) {
                    const incident = await getIncidentById(session.accessToken, updatedCase.incident_id);
                    await sendStatusUpdateEmail(
                        updatedCase.reported_individual_id,
                        updatedCase.incident_id,
                        updatedCase.case_id,
                        updatedCase.case_status,
                        {
                            description: incident?.description || "",
                            dateTime: incident?.date_time_of_incident || "",
                            category: updatedCase.category_of_offence,
                            subCategory: updatedCase.sub_category_of_offence,
                            level: updatedCase.level_of_offence,
                            verdict: updatedCase.verdict
                        },
                        data.attachments || []
                    );
                }
                break;
            }

            case "submit_appeal": {
                // Only the reported individual can submit appeal
                const caseData = await getCaseById(session.accessToken, id);
                if (!caseData || caseData.reported_individual_id?.toLowerCase() !== session.user.email.toLowerCase()) {
                    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
                }
                const data = appealSchema.parse(body.data);
                updatedCase = await submitAppeal(
                    session.accessToken,
                    id,
                    data,
                    session.user.email
                );

                if (updatedCase && updatedCase.incident_id) {
                    // 1. Confirm to reporter
                    await sendAppealConfirmationEmail(
                        session.user.email,
                        updatedCase.incident_id,
                        updatedCase.case_id,
                        data.appealReason,
                        data.appealAttachments || []
                    );

                    // 2. Notify authorized users (approvers/investigators)
                    const authorizedUsers = await getAllAuthorizedUsers(session.accessToken);
                    const recipients = authorizedUsers
                        .filter(u => ["investigator", "approver", "admin"].includes(u.role.toLowerCase()))
                        .map(u => u.email);

                    if (recipients.length > 0) {
                        await sendAppealNotificationEmail(
                            recipients,
                            updatedCase.incident_id,
                            session.user.email,
                            updatedCase.case_id,
                            data.appealReason,
                            data.appealAttachments || []
                        );
                    }
                }
                break;
            }

            case "resolve_appeal": {
                if (!["approver", "admin"].includes(role)) {
                    return NextResponse.json({ error: "Forbidden - not an approver" }, { status: 403 });
                }
                const data = resolveAppealSchema.parse(body.data);
                updatedCase = await resolveAppeal(
                    session.accessToken,
                    id,
                    data as {
                        reviewComments: string;
                        finalVerdict: "Uphold Original" | "Overturn to Not Guilty" | "Modify Level";
                        newLevelOfOffence?: string;
                        newCategoryOfOffence?: string;
                        newSubCategoryOfOffence?: string;
                        punishment?: string;
                    },
                    session.user.email
                );




                // Check for closure
                const allFinalizedAfterAppeal = await areAllCasesFinalized(session.accessToken, updatedCase?.incident_id || "");
                if (allFinalizedAfterAppeal && updatedCase?.incident_id) {
                    await updateIncident(session.accessToken, updatedCase.incident_id, { status: "Closed" }, "system");
                }

                // Send Email Notification (Final Decision)
                if (updatedCase && updatedCase.reported_individual_id && updatedCase.incident_id) {
                    const incident = await getIncidentById(session.accessToken, updatedCase.incident_id);
                    await sendStatusUpdateEmail(
                        updatedCase.reported_individual_id,
                        updatedCase.incident_id,
                        updatedCase.case_id,
                        updatedCase.case_status,
                        {
                            description: incident?.description || "",
                            dateTime: incident?.date_time_of_incident || "",
                            category: updatedCase.category_of_offence,
                            subCategory: updatedCase.sub_category_of_offence,
                            level: updatedCase.level_of_offence,
                            verdict: updatedCase.verdict
                        }
                    );
                }
                break;
            }

            case "request_more_investigation": {
                if (!["approver", "admin"].includes(role)) {
                    return NextResponse.json({ error: "Forbidden - not an approver" }, { status: 403 });
                }

                // 1. Get current case data to find who worked on it
                const currentCase = await getCaseById(session.accessToken, id);

                updatedCase = await updateCase(
                    session.accessToken,
                    id,
                    { case_status: "Pending Investigation" },
                    session.user.email
                );

                // 2. Alert the modification to the investigator
                if (currentCase && currentCase.last_updated_by && currentCase.incident_id) {
                    // Assuming last_updated_by was the investigator who submitted it
                    await sendReinvestigationNotificationEmail(
                        currentCase.last_updated_by,
                        currentCase.incident_id,
                        currentCase.case_id,
                        session.user.email
                    );
                }
                break;
            }

            case "save_draft": {
                if (!["investigator", "campus manager", "admin"].includes(role)) {
                    return NextResponse.json({ error: "Forbidden - not an investigator" }, { status: 403 });
                }
                // Save draft without changing status
                updatedCase = await updateCase(
                    session.accessToken,
                    id,
                    {
                        category_of_offence: body.data.categoryOfOffence,
                        sub_category_of_offence: body.data.subCategoryOfOffence,
                        level_of_offence: body.data.levelOfOffence,
                        case_comments: body.data.caseComments,
                        investigator_attachments: JSON.stringify(body.data.attachments || []),
                    },
                    session.user.email
                );
                break;
            }

            case "edit_investigation": {
                if (!["approver", "admin"].includes(role)) {
                    return NextResponse.json({ error: "Forbidden - not an approver" }, { status: 403 });
                }

                updatedCase = await updateCase(
                    session.accessToken,
                    id,
                    {
                        category_of_offence: body.data.categoryOfOffence,
                        sub_category_of_offence: body.data.subCategoryOfOffence,
                        level_of_offence: body.data.levelOfOffence,
                        campus: body.data.campus,
                        squad: body.data.squad,
                        case_comments: body.data.caseComments,
                    },
                    session.user.email
                );
                break;
            }

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        if (!updatedCase) {
            return NextResponse.json({ error: "Case not found or update failed" }, { status: 404 });
        }

        return NextResponse.json({ case: updatedCase });
    } catch (error) {
        console.error("Error updating case:", error);
        const message = error instanceof Error ? error.message : "Failed to update case";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
