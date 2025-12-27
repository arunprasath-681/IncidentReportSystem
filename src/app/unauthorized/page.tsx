import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function UnauthorizedPage() {
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "2rem",
            }}
        >
            <div>
                <ShieldOff
                    size={64}
                    style={{ color: "var(--destructive)", marginBottom: "1rem" }}
                />
                <h1
                    style={{
                        fontSize: "1.5rem",
                        fontWeight: "600",
                        marginBottom: "0.5rem",
                    }}
                >
                    Access Denied
                </h1>
                <p
                    style={{
                        color: "var(--muted-foreground)",
                        marginBottom: "1.5rem",
                        maxWidth: "400px",
                    }}
                >
                    You don&apos;t have permission to access this page. Please contact an
                    administrator if you believe this is an error.
                </p>
                <Link href="/" className="btn btn-primary">
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
