import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllAuthorizedUsers } from "@/lib/sheets/users";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only admins can get the list of authorized users
        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const users = await getAllAuthorizedUsers(session.accessToken);

        return NextResponse.json({ users });
    } catch (error) {
        console.error("Error fetching authorized users:", error);
        return NextResponse.json(
            { error: "Failed to fetch authorized users" },
            { status: 500 }
        );
    }
}
