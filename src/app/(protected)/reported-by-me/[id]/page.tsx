"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, User, Calendar, FileText, ExternalLink, File, Image } from "lucide-react";
import { format } from "date-fns";

interface Incident {
    incident_id: string;
    complainant_id: string;
    complainant_category: string;
    date_time_of_incident: string;
    reported_on: string;
    description: string;
    attachments: string;
    status: "Open" | "Closed";
    metadata_changelog: string;
}

interface Case {
    case_id: string;
    reported_individual_id: string;
    squad: string;
    campus: string;
    case_status: string;
    verdict: string;
    case_comments: string;
    punishment: string;
}

export default function IncidentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [incident, setIncident] = useState<Incident | null>(null);
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "cases">("overview");

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/incidents/${id}`);
                const data = await res.json();
                setIncident(data.incident);
                setCases(data.cases || []);
            } catch (error) {
                console.error("Error fetching incident:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [id]);

    function formatDate(dateStr: string, formatStr: string) {
        try {
            if (!dateStr) return "-";
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "-";
            return format(date, formatStr);
        } catch {
            return "-";
        }
    }

    function parseAttachments(attachmentsStr: string): string[] {
        try {
            if (!attachmentsStr) return [];
            const parsed = JSON.parse(attachmentsStr);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function getFileType(url: string): "image" | "pdf" | "doc" {
        const lower = url.toLowerCase();
        if (lower.includes("image") || lower.match(/\.(jpg|jpeg|png|gif|webp)/)) return "image";
        if (lower.includes("pdf") || lower.match(/\.pdf/)) return "pdf";
        return "doc";
    }

    if (loading) {
        return (
            <div style={{ padding: "3rem", textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
            </div>
        );
    }

    if (!incident) {
        return (
            <div style={{ padding: "3rem", textAlign: "center" }}>
                <p>Incident not found</p>
                <Link href="/reported-by-me" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                    Back to Reports
                </Link>
            </div>
        );
    }

    const metadata = JSON.parse(incident.metadata_changelog || "{}");
    const attachments = parseAttachments(incident.attachments);

    return (
        <div>
            <div style={{ marginBottom: "1.5rem" }}>
                <Link
                    href="/reported-by-me"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        color: "var(--muted-foreground)",
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        marginBottom: "0.5rem",
                    }}
                >
                    <ArrowLeft size={16} />
                    Back to Reports
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <h1 className="page-title">{incident.incident_id}</h1>
                    <span className={`badge ${incident.status === "Open" ? "badge-open" : "badge-closed"}`}>
                        {incident.status}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ width: "fit-content" }}>
                <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
                    Overview
                </button>
                <button className={`tab ${activeTab === "cases" ? "active" : ""}`} onClick={() => setActiveTab("cases")}>
                    Cases ({cases.length})
                </button>
            </div>

            {activeTab === "overview" && (
                <div className="card">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <Calendar size={16} style={{ color: "var(--muted-foreground)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                                    Date of Incident
                                </span>
                            </div>
                            <p style={{ fontWeight: "500" }}>
                                {formatDate(incident.date_time_of_incident, "MMMM d, yyyy 'at' h:mm a")}
                            </p>
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <FileText size={16} style={{ color: "var(--muted-foreground)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                                    Reported On
                                </span>
                            </div>
                            <p style={{ fontWeight: "500" }}>
                                {formatDate(incident.reported_on, "MMMM d, yyyy")}
                            </p>
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <User size={16} style={{ color: "var(--muted-foreground)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                                    Complainant Category
                                </span>
                            </div>
                            <p style={{ fontWeight: "500", textTransform: "capitalize" }}>
                                {incident.complainant_category}
                            </p>
                        </div>

                        {metadata.relayedFromCompany && (
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                                        Company
                                    </span>
                                </div>
                                <p style={{ fontWeight: "500" }}>
                                    {metadata.companyName || "Not specified"}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>
                            Description
                        </h3>
                        <p style={{ whiteSpace: "pre-wrap", color: "var(--muted-foreground)" }}>
                            {incident.description}
                        </p>
                    </div>

                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                            <h3 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>
                                Attachments ({attachments.length})
                            </h3>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                                {attachments.map((url, index) => {
                                    const fileType = getFileType(url);
                                    return (
                                        <a
                                            key={index}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                                padding: "0.625rem 0.875rem",
                                                backgroundColor: "var(--muted)",
                                                borderRadius: "var(--radius)",
                                                textDecoration: "none",
                                                color: "var(--foreground)",
                                                border: "1px solid var(--border)",
                                                transition: "background-color 0.15s",
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--border)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                                        >
                                            {fileType === "image" ? (
                                                <Image size={16} style={{ color: "var(--primary)" }} />
                                            ) : fileType === "pdf" ? (
                                                <File size={16} style={{ color: "var(--destructive)" }} />
                                            ) : (
                                                <File size={16} style={{ color: "var(--primary)" }} />
                                            )}
                                            <span style={{ fontSize: "0.8rem" }}>Attachment {index + 1}</span>
                                            <ExternalLink size={12} style={{ color: "var(--muted-foreground)" }} />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "cases" && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {cases.length === 0 ? (
                        <div className="empty-state">
                            <p>No cases found for this incident</p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Case ID</th>
                                    <th>Reported Individual</th>
                                    <th>Campus</th>
                                    <th>Squad</th>
                                    <th>Status</th>
                                    <th>Verdict</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.map((c) => (
                                    <tr key={c.case_id}>
                                        <td style={{ fontWeight: "500" }}>{c.case_id}</td>
                                        <td>{c.reported_individual_id}</td>
                                        <td>{c.campus || "-"}</td>
                                        <td>{c.squad || "-"}</td>
                                        <td>
                                            <span
                                                className={`badge ${c.case_status === "Final Decision"
                                                    ? "badge-closed"
                                                    : c.case_status === "Pending Investigation"
                                                        ? "badge-pending"
                                                        : "badge-open"
                                                    }`}
                                            >
                                                {c.case_status}
                                            </span>
                                        </td>
                                        <td>
                                            {c.verdict ? (
                                                <span className={`badge ${c.verdict === "Guilty" ? "badge-error" : "badge-closed"}`}>
                                                    {c.verdict}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
