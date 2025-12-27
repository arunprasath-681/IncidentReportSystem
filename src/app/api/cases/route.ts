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

        const role = (session.user.role || "").toLowerCase();
        if (!["admin", "approver", "investigator", "campus manager"].includes(role)) {
            // Students can't list all cases.
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const cases = await getCases(session.accessToken);

        return NextResponse.json({ cases });
    } catch (error) {
        console.error("Error fetching cases:", error);
        return NextResponse.json({ error: "Failed to fetch cases" }, { status: 500 });
    }
}
