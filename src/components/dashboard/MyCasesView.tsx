"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, AlertCircle, FileText, ChevronRight, Upload, X, Clock, Eye, AlertTriangle, CheckCircle } from "lucide-react";
import { formatDate, parseDate } from "@/lib/date-utils";

interface Incident {
    incident_id: string;
    description: string;
    date_time_of_incident: string;
    reported_on: string;
    attachments: string; // JSON string of URLs
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
    appeal_reason?: string;
    appeal_submitted_at?: string;
    appeal_attachments?: string; // JSON string
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
    const [showAppealModal, setShowAppealModal] = useState(false);
    const [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [appealing, setAppealing] = useState(false);

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
                    formData.append("files", f.file); // Fixed key to match API
                    formData.append("incidentId", selectedCase.incident_id);
                    formData.append("caseId", selectedCase.case_id);
                    formData.append("folderType", "Appealed");

                    const res = await fetch("/api/upload", { method: "POST", body: formData });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || "Failed to upload file");
                    }
                    const data = await res.json();
                    if (data.files && data.files.length > 0) {
                        attachmentUrls.push(data.files[0].url);
                    }
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
            setShowAppealModal(false);
            fetchMyCases(); // Refresh
            alert("Appeal submitted successfully");
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

    // Modal helpers
    function openModal(c: Case) {
        setSelectedCase(c);
        setShowAppealModal(true);
        // If appeal is allowed/active, we might want to default to that view, 
        // but the requirement is a timeline. We will render the timeline.
    }

    function getIncidentAttachments(incidentId: string): string[] {
        try {
            const inc = incidents[incidentId];
            if (inc && inc.attachments) {
                const parsed = JSON.parse(inc.attachments);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {
            // ignore error
        }
        return [];
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Cases</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        View details and status of cases reported against you
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

            {/* Modern Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: "300px" }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Case ID</th>
                            <th>Incident Date</th>
                            <th>Status</th>
                            <th>Verdict</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", padding: "3rem" }}><div className="spinner" style={{ margin: "0 auto" }}></div></td></tr>
                        ) : filteredCases.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--muted-foreground)" }}>No cases found.</td></tr>
                        ) : (
                            filteredCases.map(c => {
                                const incident = incidents[c.incident_id];
                                const appealStatus = canAppeal(c);
                                return (
                                    <tr key={c.case_id}>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <span style={{ fontWeight: "500" }}>{c.case_id}</span>
                                                <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>Incident: {c.incident_id}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {incident ? formatDate(incident.date_time_of_incident, "MMM d, yyyy") : "-"}
                                        </td>
                                        <td>
                                            <span className={`badge ${c.case_status === "Final Decision" || c.case_status === "Closed" ? "badge-closed" :
                                                c.case_status === "Verdict Given" ? "badge-warning" :
                                                    c.case_status === "Appealed" ? "badge-pending" :
                                                        "badge-open"
                                                }`}
                                            >
                                                {c.case_status === "Pending Investigation" ? "Investigation" :
                                                    c.case_status === "Investigation Submitted" ? "Reviewing" :
                                                        c.case_status}
                                            </span>
                                        </td>
                                        <td>
                                            {c.verdict ? (
                                                <span style={{
                                                    fontWeight: "500",
                                                    color: c.verdict === "Guilty" ? "var(--error)" : c.verdict === "Not Guilty" ? "var(--success)" : "inherit"
                                                }}>
                                                    {c.verdict}
                                                </span>
                                            ) : "-"}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                                                {c.case_status === "Verdict Given" && appealStatus.allowed && (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem", height: "auto" }}
                                                        onClick={(e) => { e.stopPropagation(); openModal(c); }}
                                                    >
                                                        Appeal
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-ghost"
                                                    style={{ padding: "0.5rem" }}
                                                    onClick={() => openModal(c)}
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detailed Timeline Modal */}
            {showAppealModal && selectedCase && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
                }} onClick={() => setShowAppealModal(false)}>
                    <div style={{
                        backgroundColor: "var(--background)", borderRadius: "var(--radius)", border: "1px solid var(--border)",
                        width: "100%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto",
                        padding: "0"
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontWeight: "600", fontSize: "1.125rem" }}>Case Timeline</h3>
                            <button onClick={() => setShowAppealModal(false)} className="btn btn-ghost" style={{ padding: "0.25rem" }}><X size={20} /></button>
                        </div>

                        <div style={{ padding: "1.5rem" }}>
                            {/* Timeline Container */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

                                {/* Step 1: Incident */}
                                <div style={{ display: "flex", gap: "1rem" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", backgroundColor: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}><AlertCircle size={14} /></div>
                                        <div style={{ width: "2px", flexGrow: 1, backgroundColor: "var(--border)", minHeight: "2rem" }}></div>
                                    </div>
                                    <div style={{ paddingBottom: "2rem", width: "100%" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "1rem" }}>Incident Reported</h4>
                                        <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
                                            {incidents[selectedCase.incident_id]?.reported_on ? formatDate(incidents[selectedCase.incident_id].reported_on, "MMM d, yyyy h:mm a") : "-"}
                                        </p>
                                        <div style={{ backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                                            {/* ID Display */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                                <div>
                                                    <span style={{ fontWeight: "600" }}>Incident ID:</span> {selectedCase.incident_id}
                                                </div>
                                                <div>
                                                    <span style={{ fontWeight: "600" }}>Case ID:</span> {selectedCase.case_id}
                                                </div>
                                            </div>

                                            <p style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{incidents[selectedCase.incident_id]?.description}</p>
                                            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                                                Incident Date: {incidents[selectedCase.incident_id]?.date_time_of_incident ? formatDate(incidents[selectedCase.incident_id].date_time_of_incident, "MMM d, yyyy h:mm a") : "-"}
                                            </div>

                                            {/* Attachments */}
                                            {getIncidentAttachments(selectedCase.incident_id).length > 0 && (
                                                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                                                    <p style={{ fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--muted-foreground)" }}>ATTACHMENTS</p>
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        {getIncidentAttachments(selectedCase.incident_id).map((url, i) => (
                                                            <a
                                                                key={i}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    fontSize: "0.75rem",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "0.375rem",
                                                                    padding: "0.375rem 0.625rem",
                                                                    backgroundColor: "var(--background)",
                                                                    border: "1px solid var(--border)",
                                                                    borderRadius: "var(--radius)",
                                                                    textDecoration: "none",
                                                                    color: "var(--foreground)"
                                                                }}
                                                            >
                                                                <FileText size={12} /> Evidence {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Investigation */}
                                <div style={{ display: "flex", gap: "1rem" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", backgroundColor: selectedCase.case_status !== "Pending Investigation" ? "var(--primary)" : "var(--muted)", color: selectedCase.case_status !== "Pending Investigation" ? "white" : "var(--muted-foreground)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}><Search size={14} /></div>
                                        <div style={{ width: "2px", flexGrow: 1, backgroundColor: "var(--border)", minHeight: "2rem" }}></div>
                                    </div>
                                    <div style={{ paddingBottom: "2rem", width: "100%" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "1rem" }}>Investigation</h4>
                                        <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
                                            Status: <span className="badge badge-open">{selectedCase.case_status === "Pending Investigation" ? "In Progress" : "Completed"}</span>
                                        </p>
                                        {selectedCase.case_comments && (
                                            <div style={{ marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", fontSize: "0.875rem", fontStyle: "italic" }}>
                                                "{selectedCase.case_comments}"
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Step 3: Verdict */}
                                {(selectedCase.verdict || selectedCase.case_status !== "Pending Investigation") && (
                                    <div style={{ display: "flex", gap: "1rem" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", backgroundColor: selectedCase.verdict ? "var(--primary)" : "var(--muted)", color: selectedCase.verdict ? "white" : "var(--muted-foreground)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}><FileText size={14} /></div>
                                            <div style={{ width: "2px", flexGrow: 1, backgroundColor: "var(--border)", minHeight: "2rem" }}></div>
                                        </div>
                                        <div style={{ paddingBottom: "2rem", width: "100%" }}>
                                            <h4 style={{ fontWeight: "600", fontSize: "1rem" }}>Verdict</h4>
                                            {selectedCase.verdict ? (
                                                <div style={{ marginTop: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                                                    <div style={{ padding: "0.75rem", backgroundColor: selectedCase.verdict === "Guilty" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ fontWeight: "600", color: selectedCase.verdict === "Guilty" ? "var(--error)" : "var(--success)" }}>{selectedCase.verdict}</span>
                                                        {selectedCase.punishment && <span style={{ fontSize: "0.8rem" }}>{selectedCase.punishment}</span>}
                                                    </div>
                                                    <div style={{ padding: "1rem", backgroundColor: "var(--card)", fontSize: "0.875rem" }}>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                                            <div><span style={{ color: "var(--muted-foreground)" }}>Category:</span> {selectedCase.category_of_offence}</div>
                                                            <div><span style={{ color: "var(--muted-foreground)" }}>Level:</span> {selectedCase.level_of_offence}</div>
                                                            {selectedCase.sub_category_of_offence && <div style={{ gridColumn: "span 2" }}><span style={{ color: "var(--muted-foreground)" }}>Details:</span> {selectedCase.sub_category_of_offence}</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Waiting for decision...</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Appeal (Form or Display) */}
                                {(canAppeal(selectedCase).allowed || selectedCase.case_status === "Appealed" || selectedCase.appeal_reason) && (
                                    <div style={{ display: "flex", gap: "1rem" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", backgroundColor: (selectedCase.case_status === "Appealed" || appealing) ? "var(--warning)" : "var(--muted)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}><AlertTriangle size={14} /></div>
                                            <div style={{ width: "2px", flexGrow: 1, backgroundColor: "var(--border)", minHeight: "2rem" }}></div>
                                        </div>
                                        <div style={{ paddingBottom: "2rem", width: "100%" }}>
                                            <h4 style={{ fontWeight: "600", fontSize: "1rem" }}>Appeal</h4>

                                            {/* Logic: Show Form if allowed allowed, Show Content if appealed */}
                                            {selectedCase.case_status === "Verdict Given" && canAppeal(selectedCase).allowed ? (
                                                <div style={{ marginTop: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
                                                    <h5 style={{ fontWeight: "500", marginBottom: "1rem" }}>Submit your appeal</h5>
                                                    <div className="form-group">
                                                        <label className="label">Reason for Appeal</label>
                                                        <textarea
                                                            className="input"
                                                            value={appealReason}
                                                            onChange={e => setAppealReason(e.target.value)}
                                                            placeholder="Why do you disagree with the verdict?"
                                                            style={{ minHeight: "100px" }}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="label">Attachments</label>
                                                        <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: "1rem", textAlign: "center", cursor: "pointer", backgroundColor: "var(--muted)" }}>
                                                            <Upload size={20} style={{ margin: "0 auto", color: "var(--muted-foreground)" }} />
                                                            <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>Upload evidence</p>
                                                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple style={{ display: "none" }} />
                                                        </div>
                                                        {uploadedFiles.length > 0 && (
                                                            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                                {uploadedFiles.map((f, i) => (
                                                                    <div key={i} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                        {f.file.name} <button onClick={() => removeFile(i)}><X size={12} /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                                                        <button className="btn btn-primary" onClick={submitAppeal} disabled={appealing || uploading}>
                                                            {appealing ? "Submitting..." : "Submit Appeal"}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : selectedCase.appeal_reason ? (
                                                <div style={{ marginTop: "0.5rem", backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "var(--radius)" }}>
                                                    <p style={{ fontSize: "0.875rem", fontStyle: "italic" }}>"{selectedCase.appeal_reason}"</p>
                                                    {/* Attachments */}
                                                    {selectedCase.appeal_attachments && (() => {
                                                        try {
                                                            const attachments = JSON.parse(selectedCase.appeal_attachments) as string[];
                                                            if (attachments.length > 0) {
                                                                return (
                                                                    <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: "0.75rem" }}>
                                                                        <p style={{ fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--muted-foreground)" }}>APPEAL ATTACHMENTS</p>
                                                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                                            {attachments.map((url, i) => (
                                                                                <a
                                                                                    key={i}
                                                                                    href={url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    style={{
                                                                                        fontSize: "0.75rem",
                                                                                        display: "flex",
                                                                                        alignItems: "center",
                                                                                        gap: "0.375rem",
                                                                                        padding: "0.375rem 0.625rem",
                                                                                        backgroundColor: "var(--background)",
                                                                                        border: "1px solid var(--border)",
                                                                                        borderRadius: "var(--radius)",
                                                                                        textDecoration: "none",
                                                                                        color: "var(--foreground)"
                                                                                    }}
                                                                                >
                                                                                    <FileText size={12} /> Attachment {i + 1}
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        } catch (e) {
                                                            return null;
                                                        }
                                                        return null;
                                                    })()}
                                                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                                        Submitted on: {selectedCase.appeal_submitted_at ? formatDate(selectedCase.appeal_submitted_at, "MMM d, yyyy h:mm a") : "Recently"}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>No appeal submitted.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Step 5: Final Decision (Placeholder) */}
                                <div style={{ display: "flex", gap: "1rem" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", backgroundColor: selectedCase.case_status === "Final Decision" ? "var(--success)" : "var(--muted)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}><CheckCircle size={14} /></div>
                                        {/* Last item so no line */}
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: "600", fontSize: "1rem" }}>Final Decision</h4>
                                        {selectedCase.case_status === "Final Decision" ? (
                                            <p style={{ marginTop: "0.25rem", color: "var(--success)", fontWeight: "500" }}>Case Closed</p>
                                        ) : (
                                            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Pending final review</p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
