"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
    FileText,
    Search,
    Scale,
    Archive,
    LogOut,
    User,
    ChevronDown,
    Users,
    ShieldAlert
} from "lucide-react";

const ROLE_OPTIONS = [
    { value: "admin", label: "Admin" },
    { value: "approver", label: "Approver" },
    { value: "investigator", label: "Investigator" },
    { value: "campus manager", label: "Campus Manager" },
    { value: "student", label: "Student" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [impersonateOpen, setImpersonateOpen] = useState(false);
    const [impersonating, setImpersonating] = useState<string | null>(null);

    const role = impersonating || (session?.user?.role || "").toLowerCase();
    const isAdmin = (session?.user?.role || "").toLowerCase() === "admin";

    // Build menu items based on role
    const menuItems = [];

    // My Reported Incidents - ALL users
    menuItems.push({
        href: "/reported-by-me",
        icon: FileText,
        label: "My Reported Incidents",
    });

    // My Cases - ALL users (cases against me)
    menuItems.push({
        href: "/my-cases",
        icon: ShieldAlert,
        label: "Reported Against Me",
    });

    // Investigation Hub - investigator, campus manager, approver, admin
    if (["investigator", "campus manager", "approver", "admin"].includes(role)) {
        menuItems.push({
            href: "/investigation-hub",
            icon: Search,
            label: "Investigation Hub",
        });
    }

    // Decision Hub - approver, admin
    if (["approver", "admin"].includes(role)) {
        menuItems.push({
            href: "/decision-hub",
            icon: Scale,
            label: "Decision Hub",
        });
    }

    // Archives - investigator, campus manager, approver, admin
    if (["investigator", "campus manager", "approver", "admin"].includes(role)) {
        menuItems.push({
            href: "/archives",
            icon: Archive,
            label: "Archives",
        });
    }

    function handleImpersonate(roleValue: string) {
        setImpersonating(roleValue);
        setImpersonateOpen(false);
        localStorage.setItem("impersonating_role", roleValue);
    }

    function stopImpersonating() {
        setImpersonating(null);
        localStorage.removeItem("impersonating_role");
    }

    // Check if already impersonating on mount
    useState(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("impersonating_role");
            if (stored) {
                setImpersonating(stored);
            }
        }
    });

    const displayRole = impersonating || (session?.user?.role || "");

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-header" style={{ padding: "1.25rem 1.5rem" }}>
                <img
                    src="/LOGO_IRS.svg"
                    alt="IRS Logo"
                    style={{
                        height: "24px",
                        width: "auto"
                    }}
                />
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${isActive ? "active" : ""}`}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Admin Impersonation (Debug) */}
            {isAdmin && (
                <div style={{ padding: "0 0.75rem", marginBottom: "1rem" }}>
                    <div
                        style={{
                            backgroundColor: "rgba(245, 158, 11, 0.1)",
                            borderRadius: "var(--radius)",
                            padding: "0.75rem",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginBottom: "0.5rem",
                            }}
                        >
                            <Users size={14} style={{ color: "var(--warning)" }} />
                            <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                Debug Mode
                            </span>
                        </div>

                        {impersonating ? (
                            <div>
                                <p style={{ fontSize: "0.75rem", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                                    Viewing as: <strong style={{ textTransform: "capitalize" }}>{impersonating}</strong>
                                </p>
                                <button
                                    onClick={stopImpersonating}
                                    className="btn btn-secondary"
                                    style={{ width: "100%", padding: "0.375rem 0.5rem", fontSize: "0.75rem" }}
                                >
                                    Stop
                                </button>
                            </div>
                        ) : (
                            <div style={{ position: "relative" }}>
                                <button
                                    onClick={() => setImpersonateOpen(!impersonateOpen)}
                                    className="btn btn-secondary"
                                    style={{
                                        width: "100%",
                                        padding: "0.375rem 0.5rem",
                                        fontSize: "0.75rem",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <span>View as Role</span>
                                    <ChevronDown size={14} style={{ transform: impersonateOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                                </button>

                                {impersonateOpen && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: "100%",
                                            left: 0,
                                            right: 0,
                                            backgroundColor: "var(--card)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius)",
                                            marginBottom: "0.25rem",
                                            overflow: "hidden",
                                            zIndex: 100,
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                        }}
                                    >
                                        {ROLE_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleImpersonate(opt.value)}
                                                style={{
                                                    width: "100%",
                                                    padding: "0.625rem 0.75rem",
                                                    textAlign: "left",
                                                    background: "none",
                                                    border: "none",
                                                    borderBottom: "1px solid var(--border)",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                    color: "var(--foreground)",
                                                    transition: "background-color 0.15s",
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* User Info */}
            <div className="sidebar-footer">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem",
                        backgroundColor: "var(--muted)",
                        borderRadius: "var(--radius)",
                    }}
                >
                    {/* Profile Picture */}
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            backgroundColor: "var(--background)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            overflow: "hidden",
                            border: "2px solid var(--border)",
                        }}
                    >
                        {session?.user?.image ? (
                            <img
                                src={session.user.image}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        ) : (
                            <User size={18} />
                        )}
                    </div>

                    {/* Name and Role */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                            style={{
                                fontWeight: "500",
                                fontSize: "0.875rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                lineHeight: "1.2",
                            }}
                        >
                            {session?.user?.name || "User"}
                        </p>
                        <p
                            style={{
                                fontSize: "0.7rem",
                                color: "var(--muted-foreground)",
                                textTransform: "capitalize",
                                lineHeight: "1.3",
                                marginTop: "2px",
                            }}
                        >
                            {displayRole}
                            {impersonating && " (Debug)"}
                        </p>
                    </div>

                    {/* Sign Out Button */}
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="btn btn-ghost"
                        style={{
                            padding: "0.5rem",
                            flexShrink: 0,
                            borderRadius: "50%",
                        }}
                        title="Sign Out"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
