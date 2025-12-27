import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DecisionHubView from "@/components/dashboard/DecisionHubView";
import InvestigationHubView from "@/components/dashboard/InvestigationHubView";
import MyCasesView from "@/components/dashboard/MyCasesView";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = (session.user.role || "").toLowerCase();

    // Render based on role
    if (role === "admin" || role === "approver") {
        return <DecisionHubView />;
    }

    if (role === "investigator" || role === "campus manager") {
        return <InvestigationHubView />;
    }

    if (role === "student") {
        return <MyCasesView />;
    }

    // Fallback View
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Welcome, {session.user.name}</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        Select a module from the sidebar to get started
                    </p>
                </div>
            </div>

            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                <p>You have logged in successfully.</p>
                <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginTop: "0.5rem" }}>
                    Your role is: <strong>{role || "User"}</strong>
                </p>
            </div>
        </div>
    );
}
