import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserRoleWithToken } from "@/lib/sheets/users";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !session.accessToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const roleInfo = await getUserRoleWithToken(
            session.accessToken,
            session.user.email
        );

        return NextResponse.json({
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
            ...roleInfo,
        });
    } catch (error) {
        console.error("Error fetching user info:", error);
        return NextResponse.json(
            { error: "Failed to fetch user info" },
            { status: 500 }
        );
    }
}
