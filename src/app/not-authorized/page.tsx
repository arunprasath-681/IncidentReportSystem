"use client";

import Link from "next/link";

export default function NotAuthorizedPage() {
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--background)",
                padding: "1rem",
            }}
        >
            <div
                style={{
                    textAlign: "center",
                    maxWidth: "400px",
                }}
            >
                <div
                    style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.5rem",
                    }}
                >
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--destructive)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>

                <h1
                    style={{
                        fontSize: "1.5rem",
                        fontWeight: "600",
                        marginBottom: "0.75rem",
                        color: "var(--foreground)",
                    }}
                >
                    Access Not Authorized
                </h1>

                <p
                    style={{
                        color: "var(--muted-foreground)",
                        marginBottom: "1.5rem",
                        lineHeight: "1.6",
                    }}
                >
                    Your account is not authorized to access this system. Please contact your administrator to request access.
                </p>

                <div
                    style={{
                        padding: "1rem",
                        backgroundColor: "var(--muted)",
                        borderRadius: "var(--radius)",
                        marginBottom: "1.5rem",
                        fontSize: "0.875rem",
                    }}
                >
                    <p style={{ fontWeight: "500", marginBottom: "0.5rem" }}>
                        Need Help?
                    </p>
                    <p style={{ color: "var(--muted-foreground)" }}>
                        Contact your Campus Manager or the IRS Admin team to be added to the system.
                    </p>
                </div>

                <Link
                    href="/login"
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                >
                    Back to Login
                </Link>
            </div>
        </div>
    );
}
