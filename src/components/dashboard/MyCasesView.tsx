"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, AlertCircle, FileText, ChevronRight, Upload, X, Clock, Eye, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate, parseDate } from "@/lib/date-utils";

interface Incident {
    incident_id: string;
    description: string;
    date_time_of_incident: string;
    location?: string;
    reported_on: string;
}

interface Case {
    case_id: string;
    incident_id: string;
    case_status: string;
    verdict: string;
    level_of_offence: string;
    category_of_offence: string;
    sub_category_of_offence: string;
    punishment: string;
    case_comments: string;
    last_updated_at: string;
    metadata_changelog?: string; // JSON string
    appeal_reason?: string;
    appeal_attachments?: string; // JSON array string
    appeal_submitted_at?: string;
    review_comments?: string;
}

interface UploadedFile {
    file: File;
    preview: string;
    type: "image" | "pdf" | "doc";
    url?: string; // Once uploaded
}

export default function MyCasesView() {
    const [cases, setCases] = useState<Case[]>([]);
    const [incidents, setIncidents] = useState<Record<string, Incident>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal state
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [appealing, setAppealing] = useState(false);
    const [showAppealForm, setShowAppealForm] = useState(false);

    // Form state
    const [appealReason, setAppealReason] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchMyCases();
    }, []);

    async function fetchMyCases() {
        try {
            const res = await fetch("/api/cases/my-cases");
            const data = await res.json();
            const myCases: Case[] = data.cases || [];

            setCases(myCases);

            // Fetch incidents for these cases
            if (myCases.length > 0) {
                const incidentIds = Array.from(new Set(myCases.map(c => c.incident_id)));
                await fetchIncidents(incidentIds);
            }
        } catch (error) {
            console.error("Error fetching my cases:", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchIncidents(ids: string[]) {
        try {
            const res = await fetch("/api/incidents"); // optimize later
            const data = await res.json();
            const map: Record<string, Incident> = {};
            (data.incidents || []).forEach((inc: Incident) => {
                if (ids.includes(inc.incident_id)) {
                    map[inc.incident_id] = inc;
                }
            });
            setIncidents(map);
        } catch (e) {
            console.error(e);
        }
    }

    function canAppeal(c: Case): { allowed: boolean; reason?: string } {
        if (c.case_status !== "Verdict Given") return { allowed: false, reason: "Status is not Verdict Given" };
        if (c.verdict !== "Guilty") return { allowed: false, reason: "Verdict is not Guilty" };

        const level = parseInt(c.level_of_offence) || 0;
        const isSCOC = c.category_of_offence === "Breach of student code of conduct";
        const isICOC = c.category_of_offence === "Breach of internship code of conduct";

        const eligible = (isSCOC && level >= 4) || (isICOC && level >= 3);
        if (!eligible) return { allowed: false, reason: "Level of offence not eligible for appeal" };

        // Check 7 day window
        if (!c.last_updated_at) return { allowed: false, reason: "No verdict date" };

        try {
            const verdictDate = parseDate(c.last_updated_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - verdictDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 7) return { allowed: false, reason: "Appeal period has expired (7 days)" };
        } catch (e) {
            return { allowed: false, reason: "Invalid date" };
        }

        return { allowed: true };
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const validFiles: UploadedFile[] = [];

            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    alert(`File ${file.name} is too large (max 10MB)`);
                    continue;
                }
                if (uploadedFiles.length + validFiles.length >= 5) {
                    alert("Maximum 5 files allowed");
                    break;
                }

                let fileType: "image" | "pdf" | "doc" = "doc";
                if (file.type.startsWith("image/")) fileType = "image";
                else if (file.type === "application/pdf") fileType = "pdf";

                validFiles.push({
                    file,
                    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
                    type: fileType
                });
            }
            setUploadedFiles(prev => [...prev, ...validFiles]);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    function removeFile(index: number) {
        setUploadedFiles(prev => {
            const file = prev[index];
            if (file.preview) URL.revokeObjectURL(file.preview);
            return prev.filter((_, i) => i !== index);
        });
    }

    async function submitAppeal() {
        if (!selectedCase) return;
        if (!appealReason.trim()) {
            alert("Appeal description is required");
            return;
        }

        setAppealing(true);
        try {
            // Upload files first
            const attachmentUrls: string[] = [];
            if (uploadedFiles.length > 0) {
                setUploading(true);
                for (const f of uploadedFiles) {
                    const formData = new FormData();
                    formData.append("file", f.file);
                    const res = await fetch("/api/upload", { method: "POST", body: formData });
                    const data = await res.json();
                    if (data.url) attachmentUrls.push(data.url);
                }
                setUploading(false);
            }

            const res = await fetch(`/api/cases/${selectedCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "submit_appeal",
                    data: {
                        appealReason,
                        appealAttachments: attachmentUrls
                    }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to submit appeal");
            }

            // Success
            fetchMyCases(); // Refresh
            alert("Appeal submitted successfully");
            setShowDetailModal(false);
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Failed to submit appeal");
        } finally {
            setAppealing(false);
            setUploading(false);
        }
    }

    const filteredCases = cases.filter(c =>
        c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.incident_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    function getBadgeClass(status: string) {
        switch (status) {
            case "Final Decision":
            case "Closed":
                return "badge-closed";
            case "Verdict Given":
                return "badge-warning";
            case "Appealed":
                return "badge-purple"; // Custom class needed or style override
            default:
                return "badge-open";
        }
    }

    // Helper to parse appeal attachments
    function getAppealAttachments(c: Case): string[] {
        try {
            return c.appeal_attachments ? JSON.parse(c.appeal_attachments) : [];
        } catch {
            return [];
        }
    }

    interface TimelineEvent {
        title: string;
        date: string;
        content?: React.ReactNode;
        icon: React.ElementType;
        color: string;
    }

    function getTimelineEvents(c: Case, incident?: Incident): TimelineEvent[] {
        const events: TimelineEvent[] = [];

        // 1. Incident Reported
        if (incident) {
            events.push({
                title: "Incident Reported",
                date: formatDate(incident.reported_on, "MMM d, yyyy h:mm a"),
                content: (
                    <div style={{ backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "8px", marginTop: "0.5rem" }}>
                        <p style={{ fontWeight: "500", marginBottom: "0.5rem" }}>{incident.description}</p>
                        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem", color: "var(--secondary-foreground)" }}>
                            <span><strong>ID:</strong> {c.incident_id}</span>
                            <span><strong>Location:</strong> {incident.location || "N/A"}</span>
                        </div>
                    </div>
                ),
                icon: AlertCircle,
                color: "var(--foreground)"
            });
        }

        // 2. Parse Changelog
        try {
            const metadata = c.metadata_changelog ? JSON.parse(c.metadata_changelog) : {};
            const changelog = metadata.changelog || [];

            changelog.forEach((entry: any) => {
                const dateStr = formatDate(entry.at, "MMM d, yyyy h:mm a");

                if (entry.action === "created") {
                    // Skip, handled by Incident Reported usually, or separate Case Created event
                    // events.push({ title: "Case Created", date: dateStr, description: "Case file opened.", icon: FileText, color: "var(--blue)" });
                } else if (entry.action.startsWith("status_changed_to_")) {
                    const status = entry.action.replace("status_changed_to_", "").replace(/_/g, " ");

                    if (status === "Investigation Submitted") {
                        events.push({
                            title: "Investigation Submitted",
                            date: dateStr,
                            description: "Investigation findings submitted for review.",
                            icon: Clock,
                            color: "var(--orange)"
                        });
                    } else if (status === "Verdict Given") {
                        events.push({
                            title: "Verdict Recorded",
                            date: dateStr,
                            description: `Verdict: ${c.verdict}`,
                            icon: CheckCircle,
                            color: c.verdict === "Guilty" ? "var(--error)" : "var(--success)"
                        });
                    } else if (status === "Appealed") {
                        events.push({
                            title: "Appeal Submitted",
                            date: dateStr,
                            description: "Appeal filed by reported individual.",
                            icon: AlertTriangle,
                            color: "var(--purple)"
                        });
                    } else if (status === "Final Decision") {
                        events.push({
                            title: "Final Decision",
                            date: dateStr,
                            description: "Final decision reached by review board.",
                            icon: CheckCircle,
                            color: "var(--foreground)"
                        });
                    }
                }
            });
        } catch (e) {
            console.error("Error parsing changelog", e);
        }

        // Sort by date if needed, but changelog is usually chronological
        return events;
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Cases</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        Overview of cases reported against you
                    </p>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ position: "relative", maxWidth: "400px" }}>
                    <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
                    <input
                        type="text"
                        className="input"
                        style={{ paddingLeft: "2.25rem" }}
                        placeholder="Search by Case ID or Incident ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Table Layout */}
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: "600" }}>Case ID</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: "600" }}>Incident</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: "600" }}>Date</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: "600" }}>Category</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: "600" }}>Status</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: "2rem", textAlign: "center" }}>
                                        <div className="spinner" style={{ margin: "0 auto" }}></div>
                                    </td>
                                </tr>
                            ) : filteredCases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--muted-foreground)" }}>
                                        No cases found.
                                    </td>
                                </tr>
                            ) : (
                                filteredCases.map((c) => {
                                    const incident = incidents[c.incident_id];
                                    return (
                                        <tr key={c.case_id} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace" }}>{c.case_id}</td>
                                            <td style={{ padding: "0.75rem 1rem" }}>
                                                <div style={{ fontWeight: "500" }}>{incident?.description || "Unknown"}</div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{c.incident_id}</div>
                                            </td>
                                            <td style={{ padding: "0.75rem 1rem" }}>
                                                {incident ? formatDate(incident.date_time_of_incident, "MMM d, yyyy") : "-"}
                                            </td>
                                            <td style={{ padding: "0.75rem 1rem" }}>
                                                <div style={{ maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.category_of_offence}>
                                                    {c.category_of_offence || "-"}
                                                </div>
                                            </td>
                                            <td style={{ padding: "0.75rem 1rem" }}>
                                                <span className={`badge ${getBadgeClass(c.case_status)}`} style={c.case_status === "Appealed" ? { backgroundColor: "#8b5cf6", color: "white" } : {}}>
                                                    {c.case_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCase(c);
                                                        setAppealReason("");
                                                        setUploadedFiles([]);
                                                        setShowAppealForm(false);
                                                        setShowDetailModal(true);
                                                    }}
                                                    className="btn-icon"
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Case Details Modal */}
            {showDetailModal && selectedCase && (() => {
                const incident = incidents[selectedCase.incident_id];
                const appealStatus = canAppeal(selectedCase);
                const isAppealable = appealStatus.allowed && !showAppealForm && selectedCase.case_status === "Verdict Given";
                const hasAppealed = selectedCase.case_status === "Appealed" || (selectedCase.case_status === "Final Decision" && selectedCase.appeal_reason);

                return (
                    <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px", borderRadius: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
                                <div>
                                    <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Case Details</h2>
                                    <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                                        {selectedCase.case_id} • {formatDate(selectedCase.last_updated_at, "MMM d, yyyy")}
                                    </div>
                                </div>
                                <button onClick={() => setShowDetailModal(false)} className="btn-icon"><X size={20} /></button>
                            </div>

                            <div style={{ maxHeight: "calc(80vh - 100px)", overflowY: "auto", paddingRight: "0.5rem" }}>
                                {/* Incident Info */}
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--muted-foreground)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Incident Information</h3>
                                    <div style={{ backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "8px" }}>
                                        <p style={{ fontWeight: "500", marginBottom: "0.5rem" }}>{incident?.description}</p>
                                        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem", color: "var(--secondary-foreground)" }}>
                                            <span><strong>ID:</strong> {selectedCase.incident_id}</span>
                                            <span><strong>Date:</strong> {incident ? formatDate(incident.date_time_of_incident, "PP p") : "Unknown"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Investigation Findings */}
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--muted-foreground)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Investigation Findings</h3>
                                    <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Category</div>
                                                <div style={{ fontWeight: "500" }}>{selectedCase.category_of_offence || "-"}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Sub-Category</div>
                                                <div style={{ fontWeight: "500" }}>{selectedCase.sub_category_of_offence || "-"}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Level</div>
                                                <div style={{ fontWeight: "500" }}>{selectedCase.level_of_offence || "-"}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Verdict</div>
                                                <div style={{ fontWeight: "600", color: selectedCase.verdict === "Guilty" ? "var(--error)" : "var(--success)" }}>
                                                    {selectedCase.verdict || "Pending"}
                                                </div>
                                            </div>
                                        </div>

                                        {selectedCase.punishment && (
                                            <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "6px", marginBottom: "1rem" }}>
                                                <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--error)", marginBottom: "0.25rem" }}>PUNISHMENT / SANCTION</div>
                                                <div style={{ color: "var(--foreground)" }}>{selectedCase.punishment}</div>
                                            </div>
                                        )}

                                        {selectedCase.case_comments && (
                                            <div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "0.25rem" }}>Investigator/Approver Comments</div>
                                                <p style={{ fontStyle: "italic", fontSize: "0.9rem" }}>"{selectedCase.case_comments}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Appeal Section */}
                                {hasAppealed && (
                                    <div style={{ marginBottom: "1.5rem" }}>
                                        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--muted-foreground)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Appeal Details</h3>
                                        <div style={{ border: "1px solid var(--purple-light, #e9d5ff)", borderRadius: "8px", padding: "1rem", backgroundColor: "var(--purple-bg, #f3e8ff)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", color: "#6b21a8" }}>
                                                <FileText size={16} /> <span style={{ fontWeight: "600" }}>Your Appeal</span>
                                            </div>
                                            <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", color: "#3b0764", marginBottom: "1rem" }}>{selectedCase.appeal_reason}</p>

                                            {/* Appeal Attachments */}
                                            {getAppealAttachments(selectedCase).length > 0 && (
                                                <div style={{ marginBottom: "1rem" }}>
                                                    <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#6b21a8", marginBottom: "0.25rem" }}>Attachments</div>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                                        {getAppealAttachments(selectedCase).map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="badge" style={{ backgroundColor: "white", border: "1px solid #d8b4fe", color: "#6b21a8", display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}>
                                                                <FileText size={12} /> Attachment {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Reviewer Response */}
                                            {selectedCase.review_comments && (
                                                <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(139, 92, 246, 0.2)", paddingTop: "1rem" }}>
                                                    <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#6b21a8", marginBottom: "0.25rem" }}>Review Board Decision</div>
                                                    <p style={{ fontSize: "0.95rem", color: "#3b0764" }}>{selectedCase.review_comments}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Case Timeline */}
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--muted-foreground)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Case History</h3>
                                    <div style={{ position: "relative", paddingLeft: "1rem" }}>
                                        {/* Vertical Line */}
                                        <div style={{ position: "absolute", left: "1.45rem", top: "0.5rem", bottom: "0.5rem", width: "2px", backgroundColor: "var(--border)" }}></div>

                                        {(() => {
                                            const timeline = getTimelineEvents(selectedCase, incident);
                                            return timeline.map((event, index) => (
                                                <div key={index} style={{ position: "relative", display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
                                                    <div style={{
                                                        width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--background)", border: `2px solid ${event.color}`,
                                                        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, flexShrink: 0
                                                    }}>
                                                        <event.icon size={16} color={event.color} />
                                                    </div>
                                                    <div style={{ paddingTop: "0.25rem" }}>
                                                        <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>{event.title}</div>
                                                        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "0.25rem" }}>{event.date}</div>
                                                        <div style={{ fontSize: "0.875rem" }}>{event.description}</div>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                {/* Call to Action: Appeal */}
                                {isAppealable && !hasAppealed && (
                                    <div style={{ marginTop: "1rem" }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ width: "100%", display: "flex", justifyContent: "center", gap: "0.5rem" }}
                                            onClick={() => setShowAppealForm(true)}
                                        >
                                            <AlertTriangle size={18} /> I want to appeal this verdict
                                        </button>
                                    </div>
                                )}

                                {/* Appeal Form */}
                                {showAppealForm && (
                                    <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                            <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>Submit Appeal</h3>
                                            <button onClick={() => setShowAppealForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
                                        </div>

                                        <div className="form-group">
                                            <label className="label">Reason for Appeal <span style={{ color: "var(--error)" }}>*</span></label>
                                            <textarea
                                                className="input"
                                                style={{ minHeight: "120px" }}
                                                placeholder="Please provide a detailed explanation..."
                                                value={appealReason}
                                                onChange={(e) => setAppealReason(e.target.value)}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="label">Supporting Documents</label>
                                            <div
                                                style={{
                                                    border: "1px dashed var(--border)",
                                                    borderRadius: "var(--radius)",
                                                    padding: "1rem",
                                                    textAlign: "center",
                                                    cursor: "pointer",
                                                    backgroundColor: "var(--background)"
                                                }}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <Upload size={20} style={{ margin: "0 auto 0.5rem", color: "var(--muted-foreground)" }} />
                                                <p style={{ fontSize: "0.875rem" }}>Click to upload files</p>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    style={{ display: "none" }}
                                                    multiple
                                                    accept="image/*,application/pdf,.doc,.docx"
                                                    onChange={handleFileSelect}
                                                />
                                            </div>
                                            {/* File List */}
                                            {uploadedFiles.length > 0 && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                                                    {uploadedFiles.map((file, i) => (
                                                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.875rem", padding: "0.25rem 0.5rem", backgroundColor: "var(--muted)", borderRadius: "4px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                                                                <FileText size={14} />
                                                                <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "200px" }}>{file.file.name}</span>
                                                            </div>
                                                            <button onClick={() => removeFile(i)} className="btn-icon"><X size={14} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ marginTop: "1rem" }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: "100%" }}
                                                onClick={submitAppeal}
                                                disabled={appealing || uploading}
                                            >
                                                {appealing || uploading ? "Submitting..." : "Submit Appeal"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
