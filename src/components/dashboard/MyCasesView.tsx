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

        const eligible = (isSCOC && level === 4) || (isICOC && level === 3);
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

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {loading ? (
                    <div className="spinner" style={{ margin: "2rem auto" }}></div>
                ) : filteredCases.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                        <p style={{ color: "var(--muted-foreground)" }}>No cases found.</p>
                    </div>
                ) : (
                    filteredCases.map(c => {
                        const incident = incidents[c.incident_id];
                        const appealStatus = canAppeal(c);

                        return (
                            <div key={c.case_id} className="card">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                                    <div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                            <div style={{ fontSize: "0.875rem" }}>
                                                <span style={{ fontWeight: "600", color: "var(--foreground)" }}>Case ID: </span>
                                                <span style={{ fontFamily: "monospace" }}>{c.case_id}</span>
                                            </div>
                                            <div style={{ fontSize: "0.875rem" }}>
                                                <span style={{ fontWeight: "600", color: "var(--foreground)" }}>Incident ID: </span>
                                                <span style={{ fontFamily: "monospace" }}>{c.incident_id}</span>
                                            </div>
                                        </div>
                                        {incident && (
                                            <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>{incident.description}</p>
                                        )}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.5rem" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <Clock size={14} /> Reported On: {incident ? formatDate(incident.reported_on, "MMM d, yyyy") : "-"}
                                            </span>
                                            {incident && incident.date_time_of_incident && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <AlertCircle size={14} /> Incident Date: {formatDate(incident.date_time_of_incident, "MMM d, yyyy HH:mm")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right", minWidth: "150px" }}>
                                        <span className={`badge ${c.case_status === "Final Decision" || c.case_status === "Closed" ? "badge-closed" :
                                            c.case_status === "Verdict Given" ? "badge-warning" :
                                                "badge-open"
                                            }`}
                                            style={c.case_status === "Appealed" ? { backgroundColor: "#8b5cf6", color: "white" } : {}}
                                        >
                                            {c.case_status === "Pending Investigation" ? "Investigation in Progress" :
                                                c.case_status === "Investigation Submitted" ? "Review Pending" :
                                                    c.case_status}
                                        </span>

                                        {(c.case_status === "Verdict Given" || c.case_status === "Final Decision" || c.case_status === "Appealed") && (
                                            <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", fontWeight: "500" }}>
                                                Verdict: <span style={{
                                                    color: c.verdict === "Guilty" ? "var(--error)" :
                                                        c.verdict === "Not Guilty" ? "var(--success)" : "inherit"
                                                }}>{c.verdict}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.875rem" }}>
                                        <span style={{ color: "var(--muted-foreground)" }}>Category: </span>
                                        {c.category_of_offence || "-"}
                                    </div>

                                    {c.case_status === "Verdict Given" && (
                                        appealStatus.allowed ? (
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => {
                                                    setSelectedCase(c);
                                                    setAppealReason("");
                                                    setUploadedFiles([]);
                                                    setShowAppealModal(true);
                                                }}
                                            >
                                                Appeal Verdict
                                            </button>
                                        ) : (
                                            <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", maxWidth: "200px", textAlign: "right" }}>
                                                Appeal not available: {appealStatus.reason}
                                            </div>
                                        )
                                    )}
                                    {c.case_status === "Appealed" && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--warning)" }}>
                                            <Clock size={16} /> Appeal Under Review
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Appeal Modal */}
            {
                showAppealModal && selectedCase && (
                    <div style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
                    }}>
                        <div style={{ backgroundColor: "var(--background)", borderRadius: "var(--radius)", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Submit Appeal</h2>
                                <button onClick={() => setShowAppealModal(false)}><X size={20} /></button>
                            </div>

                            <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", fontSize: "0.875rem" }}>
                                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Case Details</h3>
                                <p style={{ marginBottom: "0.25rem" }}><strong>Incident Description:</strong> {incidents[selectedCase.incident_id]?.description || "N/A"}</p>
                                <p style={{ marginBottom: "0.25rem" }}><strong>Case ID:</strong> {selectedCase.case_id}</p>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                                    <p><strong>Verdict:</strong> {selectedCase.verdict}</p>
                                    <p><strong>Level:</strong> {selectedCase.level_of_offence}</p>
                                    <p><strong>Category:</strong> {selectedCase.category_of_offence}</p>
                                    <p><strong>Sub-Category:</strong> {selectedCase.sub_category_of_offence}</p>
                                </div>
                                {selectedCase.case_comments && (
                                    <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                                        <p><strong>Investigator Comments:</strong></p>
                                        <p style={{ fontStyle: "italic", color: "var(--muted-foreground)" }}>{selectedCase.case_comments}</p>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="label">Appeal Description <span style={{ color: "var(--error)" }}>*</span></label>
                                <textarea
                                    className="input"
                                    style={{ minHeight: "150px", resize: "vertical" }}
                                    value={appealReason}
                                    onChange={(e) => setAppealReason(e.target.value)}
                                    placeholder="Explain why you are appealing this verdict..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">Attachments (Optional)</label>
                                <div
                                    style={{
                                        border: "2px dashed var(--border)",
                                        borderRadius: "var(--radius)",
                                        padding: "1.5rem",
                                        textAlign: "center",
                                        cursor: "pointer",
                                        backgroundColor: "var(--muted)"
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={24} style={{ margin: "0 auto 0.5rem", color: "var(--muted-foreground)" }} />
                                    <p style={{ fontSize: "0.875rem" }}>Click to upload evidence</p>
                                    <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Max 5 files, 10MB each</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: "none" }}
                                        multiple
                                        accept="image/*,application/pdf,.doc,.docx"
                                        onChange={handleFileSelect}
                                    />
                                </div>

                                {uploadedFiles.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
                                        {uploadedFiles.map((file, i) => (
                                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                                                    {file.type === "image" ? <Eye size={16} /> : <FileText size={16} />}
                                                    <span style={{ fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.file.name}</span>
                                                </div>
                                                <button onClick={() => removeFile(i)} style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
                                <button className="btn btn-ghost" onClick={() => setShowAppealModal(false)}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={submitAppeal}
                                    disabled={appealing || uploading}
                                >
                                    {appealing || uploading ? "Submitting..." : "Submit Appeal"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
