import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchUsers } from "@/lib/sheets/users";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json({ users: [] });
        }

        const users = await searchUsers(session.accessToken, query);

        return NextResponse.json({ users });
    } catch (error) {
        console.error("Error searching users:", error);
        return NextResponse.json(
            { error: "Failed to search users" },
            { status: 500 }
        );
    }
}
