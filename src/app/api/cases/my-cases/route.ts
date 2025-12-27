import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCases } from "@/lib/sheets/cases";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const cases = await getCases(session.accessToken, {
            reportedIndividualEmail: session.user.email
        });

        return NextResponse.json({ cases });
    } catch (error) {
        console.error("Error fetching my cases:", error);
        return NextResponse.json({ error: "Failed to fetch cases" }, { status: 500 });
    }
}
