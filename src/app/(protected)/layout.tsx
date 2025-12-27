import { auth } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    if (!session.user.isAuthorized) {
        redirect("/not-authorized");
    }

    return (
        <div style={{ display: "flex" }}>
            <Sidebar />
            <main className="main-content" style={{ width: "-webkit-fill-available" }}>{children}</main>
        </div>
    );
}
