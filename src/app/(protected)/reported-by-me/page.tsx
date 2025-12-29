"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, FileText, Clock, CheckCircle, X, Upload, File, Search, ExternalLink, Eye, Calendar, User } from "lucide-react";
import { formatDate } from "@/lib/date-utils";

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
    punishment: string;
}

interface UploadedFile {
    file: File;
    preview: string;
    type: "image" | "pdf" | "doc";
}

interface UserResult {
    email: string;
    name: string;
    type: "student" | "staff";
    campus_code?: string;
    squad_number?: string;
    status?: string;
}

interface SelectedUser {
    email: string;
    name: string;
    campus_code?: string;
    squad_number?: string;
    status?: string;
}

export default function ReportedByMePage() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "Open" | "Closed">("all");

    // Create Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // View Modal states
    const [viewIncident, setViewIncident] = useState<Incident | null>(null);
    const [viewCases, setViewCases] = useState<Case[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Form states
    const [dateTimeOfIncident, setDateTimeOfIncident] = useState("");
    const [description, setDescription] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    // Search dropdown states
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchIncidents();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function fetchIncidents() {
        try {
            const res = await fetch("/api/incidents?complainantOnly=true");
            const data = await res.json();
            setIncidents(data.incidents || []);
        } catch (error) {
            console.error("Error fetching incidents:", error);
        } finally {
            setLoading(false);
        }
    }

    async function openViewModal(incident: Incident) {
        setViewIncident(incident);
        setLoadingDetails(true);
        try {
            const res = await fetch(`/api/incidents/${incident.incident_id}`);
            const data = await res.json();
            // Update incident with full data including attachments
            if (data.incident) {
                setViewIncident(data.incident);
            }
            setViewCases(data.cases || []);
        } catch (error) {
            console.error("Error fetching details:", error);
        } finally {
            setLoadingDetails(false);
        }
    }

    function closeViewModal() {
        setViewIncident(null);
        setViewCases([]);
    }

    async function searchUsers(query: string) {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`/api/users/lookup?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            const users = data.users || [];

            // Deduplicate users based on email
            const uniqueUsers = users.filter((user: UserResult, index: number, self: UserResult[]) =>
                index === self.findIndex((u) => u.email === user.email)
            );

            setSearchResults(uniqueUsers);
        } catch (error) {
            console.error("Error searching users:", error);
        } finally {
            setSearching(false);
        }
    }

    function handleSearchChange(value: string) {
        setSearchQuery(value);
        setShowDropdown(true);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => searchUsers(value), 300);
    }

    function selectUser(user: UserResult) {
        if (selectedUsers.some((u) => u.email === user.email)) {
            setError("This user is already added");
            return;
        }
        setSelectedUsers((prev) => [...prev, { email: user.email, name: user.name, campus_code: user.campus_code, squad_number: user.squad_number, status: user.status }]);
        setSearchQuery("");
        setSearchResults([]);
        setShowDropdown(false);
        setError("");
    }

    function removeUser(email: string) {
        setSelectedUsers((prev) => prev.filter((u) => u.email !== email));
    }

    const filteredIncidents = incidents.filter((i) => filter === "all" ? true : i.status === filter);
    const openCount = loading ? "-" : incidents.filter((i) => i.status === "Open").length;
    const closedCount = loading ? "-" : incidents.filter((i) => i.status === "Closed").length;



    function parseAttachments(str: string): string[] {
        try {
            if (!str) return [];
            const parsed = JSON.parse(str);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    function openCreateModal() {
        setShowCreateModal(true);
        setError("");
        setDateTimeOfIncident("");
        setDescription("");
        setSelectedUsers([]);
        setUploadedFiles([]);
        setSearchQuery("");
        setSearchResults([]);
    }

    function closeCreateModal() {
        setShowCreateModal(false);
        setError("");
        uploadedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
        setUploadedFiles([]);
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || []);
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        const maxSize = 10 * 1024 * 1024;
        if (uploadedFiles.length + files.length > 5) { setError("Maximum 5 files allowed"); return; }
        const validFiles: UploadedFile[] = [];
        for (const file of files) {
            if (!allowedTypes.includes(file.type)) { setError(`Invalid file type: ${file.name}`); continue; }
            if (file.size > maxSize) { setError(`File too large: ${file.name}`); continue; }
            let fileType: "image" | "pdf" | "doc" = "doc";
            if (file.type.startsWith("image/")) fileType = "image";
            else if (file.type === "application/pdf") fileType = "pdf";
            validFiles.push({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "", type: fileType });
        }
        setUploadedFiles((prev) => [...prev, ...validFiles]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function removeFile(index: number) {
        setUploadedFiles((prev) => {
            const file = prev[index];
            if (file.preview) URL.revokeObjectURL(file.preview);
            return prev.filter((_, i) => i !== index);
        });
    }

    async function handleSubmit() {
        if (!dateTimeOfIncident) { setError("Please select the date and time of incident"); return; }
        if (!description.trim()) { setError("Please provide a description of the incident"); return; }
        if (selectedUsers.length === 0) { setError("Please add at least one reported individual"); return; }

        setSaving(true);
        setError("");

        try {
            const incidentDate = new Date(dateTimeOfIncident);
            const formattedDate = `${String(incidentDate.getDate()).padStart(2, "0")}/${String(incidentDate.getMonth() + 1).padStart(2, "0")}/${incidentDate.getFullYear()} ${String(incidentDate.getHours()).padStart(2, "0")}:${String(incidentDate.getMinutes()).padStart(2, "0")}:${String(incidentDate.getSeconds()).padStart(2, "0")}`;

            // 1. Create Incident first (without attachments)
            const createRes = await fetch("/api/incidents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dateTimeOfIncident: formattedDate,
                    description,
                    reportedIndividuals: selectedUsers.map((u) => u.email),
                    attachments: [], // Empty initially
                }),
            });

            if (!createRes.ok) { const data = await createRes.json(); throw new Error(data.error || "Failed to submit incident"); }
            const createData = await createRes.json();
            const incidentId = createData.incident.incident_id;

            // 2. Upload Files (if any) using the Incident ID
            if (uploadedFiles.length > 0) {
                const formData = new FormData();
                uploadedFiles.forEach((f) => formData.append("files", f.file));
                formData.append("incidentId", incidentId); // Critical: Pass Incident ID

                const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
                if (!uploadRes.ok) { const d = await uploadRes.json(); throw new Error(d.error || "Failed to upload files"); }
                const uploadData = await uploadRes.json();
                const attachmentUrls = uploadData.files.map((f: { url: string }) => f.url);

                // 3. Update Incident with attachment URLs
                if (attachmentUrls.length > 0) {
                    await fetch(`/api/incidents/${incidentId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            attachments: attachmentUrls
                        })
                    });
                }
            }

            closeCreateModal();
            fetchIncidents();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    const maxDateTime = new Date().toISOString().slice(0, 16);

    return (
        <div>
            {/* View Incident Modal */}
            {viewIncident && (
                <div className="modal-overlay" onClick={closeViewModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px", maxHeight: "85vh", overflowY: "auto" }}>
                        <div className="modal-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <h3 className="modal-title">{viewIncident.incident_id}</h3>
                                <span className={`badge ${viewIncident.status === "Open" ? "badge-open" : "badge-closed"}`}>{viewIncident.status}</span>
                            </div>
                            <button onClick={closeViewModal} className="btn btn-ghost" style={{ padding: "0.25rem" }}><X size={18} /></button>
                        </div>

                        {/* Overview */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                                    <Calendar size={14} style={{ color: "var(--muted-foreground)" }} />
                                    <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Date of Incident</span>
                                </div>
                                <p style={{ fontWeight: "500", fontSize: "0.875rem" }}>{formatDate(viewIncident.date_time_of_incident, "MMM d, yyyy 'at' h:mm a")}</p>
                            </div>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                                    <FileText size={14} style={{ color: "var(--muted-foreground)" }} />
                                    <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Reported On</span>
                                </div>
                                <p style={{ fontWeight: "500", fontSize: "0.875rem" }}>{formatDate(viewIncident.reported_on, "MMM d, yyyy h:mm a")}</p>
                            </div>
                        </div>

                        {/* Description */}
                        <div style={{ marginBottom: "1rem" }}>
                            <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Description</span>
                            <p style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--muted-foreground)" }}>{viewIncident.description}</p>
                        </div>

                        {/* Attachments */}
                        {(() => {
                            const attachments = parseAttachments(viewIncident.attachments);
                            return attachments.length > 0 && (
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Attachments ({attachments.length})</span>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                                        {attachments.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.625rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", fontSize: "0.75rem", textDecoration: "none", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                                                <ExternalLink size={12} /> View {i + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Cases */}
                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                            <h4 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Cases ({loadingDetails ? "..." : viewCases.length})</h4>
                            {loadingDetails ? (
                                <div style={{ padding: "1rem", textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto", width: "1.5rem", height: "1.5rem" }}></div></div>
                            ) : viewCases.length === 0 ? (
                                <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>No cases found</p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {viewCases.map((c) => (
                                        <div key={c.case_id} style={{ padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                <span style={{ fontWeight: "500", fontSize: "0.875rem" }}>{c.case_id}</span>
                                                <span className={`badge ${c.case_status === "Final Decision" ? "badge-closed" : c.case_status === "Pending Investigation" ? "badge-pending" : "badge-open"}`} style={{ fontSize: "0.65rem" }}>{c.case_status}</span>
                                            </div>
                                            <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{c.reported_individual_id}</p>
                                            {c.verdict && (
                                                <div style={{ marginTop: "0.375rem" }}>
                                                    <span className={`badge ${c.verdict === "Guilty" ? "badge-error" : "badge-closed"}`} style={{ fontSize: "0.65rem" }}>{c.verdict}</span>
                                                    {c.punishment && <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", marginLeft: "0.5rem" }}>{c.punishment}</span>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={closeCreateModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "650px" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Report New Incident</h3>
                            <button onClick={closeCreateModal} className="btn btn-ghost" style={{ padding: "0.25rem" }}><X size={18} /></button>
                        </div>

                        {error && (
                            <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--destructive)", borderRadius: "var(--radius)", marginBottom: "1rem", fontSize: "0.875rem" }}>{error}</div>
                        )}

                        <div className="form-group">
                            <label className="label">Date & Time of Incident <span style={{ color: "var(--destructive)" }}>*</span></label>
                            <input type="datetime-local" className="input" value={dateTimeOfIncident} onChange={(e) => setDateTimeOfIncident(e.target.value)} max={maxDateTime} style={{ colorScheme: "dark" }} />
                        </div>

                        <div className="form-group">
                            <label className="label">Description <span style={{ color: "var(--destructive)" }}>*</span></label>
                            <textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident in detail..." style={{ minHeight: "100px" }} />
                        </div>

                        <div className="form-group">
                            <label className="label">Reported Individual(s) <span style={{ color: "var(--destructive)" }}>*</span></label>
                            {selectedUsers.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    {selectedUsers.map((user) => (
                                        <div key={user.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                                            <div>
                                                <p style={{ fontWeight: "500", fontSize: "0.8rem" }}>{user.email}</p>
                                                <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>{user.campus_code || "-"}/{user.squad_number || "-"}</p>
                                            </div>
                                            <button type="button" onClick={() => removeUser(user.email)} className="btn btn-ghost" style={{ padding: "0.25rem", color: "var(--destructive)" }}><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ position: "relative" }} ref={dropdownRef}>
                                <div style={{ position: "relative" }}>
                                    <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
                                    <input type="text" className="input" value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)} placeholder="Search by name or email..." style={{ paddingLeft: "2rem", fontSize: "0.875rem" }} />
                                    {searching && <div className="spinner" style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", width: "0.875rem", height: "0.875rem" }}></div>}
                                </div>

                                {showDropdown && searchResults.length > 0 && (
                                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginTop: "0.25rem", maxHeight: "200px", overflowY: "auto", zIndex: 100, boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
                                        {searchResults.map((user) => (
                                            <button key={user.email} type="button" onClick={() => selectUser(user)} style={{ width: "100%", padding: "0.625rem 0.75rem", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                                                <p style={{ fontWeight: "500", fontSize: "0.8rem", color: "var(--foreground)" }}>{user.email}</p>
                                                <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>{user.campus_code || "-"}/{user.squad_number || "-"}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="label">Attachments (Optional)</label>
                            <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: "1rem", textAlign: "center", cursor: "pointer" }}>
                                <Upload size={18} style={{ color: "var(--muted-foreground)" }} />
                                <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Click to upload • Max 10MB • Max 5 files</p>
                            </div>
                            <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx" onChange={handleFileSelect} style={{ display: "none" }} />
                            {uploadedFiles.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                                    {uploadedFiles.map((file, index) => (
                                        <div key={index} style={{ position: "relative", width: "60px", height: "60px", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
                                            {file.type === "image" && file.preview ? <img src={file.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><File size={18} /></div>}
                                            <button type="button" onClick={() => removeFile(index)} style={{ position: "absolute", top: "2px", right: "2px", width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={8} color="white" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                            <button onClick={closeCreateModal} className="btn btn-secondary" disabled={saving}>Cancel</button>
                            <button onClick={handleSubmit} className="btn btn-primary" disabled={saving}>
                                {saving ? <><div className="spinner" style={{ width: "1rem", height: "1rem" }}></div>Submitting...</> : <><FileText size={16} />Submit Report</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">My Reported Incidents</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>View and manage your incident reports</p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary"><Plus size={18} />Report New Incident</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className="card"><div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><FileText size={24} style={{ color: "var(--primary)" }} /><div><p style={{ fontSize: "1.5rem", fontWeight: "600" }}>{loading ? "-" : incidents.length}</p><p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Total Reports</p></div></div></div>
                <div className="card"><div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><Clock size={24} style={{ color: "var(--warning)" }} /><div><p style={{ fontSize: "1.5rem", fontWeight: "600" }}>{openCount}</p><p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Open</p></div></div></div>
                <div className="card"><div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><CheckCircle size={24} style={{ color: "var(--success)" }} /><div><p style={{ fontSize: "1.5rem", fontWeight: "600" }}>{closedCount}</p><p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Closed</p></div></div></div>
            </div>

            <div className="tabs" style={{ width: "fit-content" }}>
                <button className={`tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All ({loading ? "-" : incidents.length})</button>
                <button className={`tab ${filter === "Open" ? "active" : ""}`} onClick={() => setFilter("Open")}>Open ({openCount})</button>
                <button className={`tab ${filter === "Closed" ? "active" : ""}`} onClick={() => setFilter("Closed")}>Closed ({closedCount})</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: "250px" }}>
                <table className="table">
                    <thead>
                        <tr><th>Incident ID</th><th>Date of Incident</th><th>Reported On</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}><div className="spinner" style={{ margin: "0 auto" }}></div></td></tr>
                        ) : filteredIncidents.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}><FileText size={32} style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem" }} /><p style={{ fontWeight: "500" }}>No reports found</p></td></tr>
                        ) : (
                            filteredIncidents.map((incident) => (
                                <tr key={incident.incident_id}>
                                    <td><span style={{ fontWeight: "500" }}>{incident.incident_id}</span></td>
                                    <td>{formatDate(incident.date_time_of_incident, "MMM d, yyyy h:mm a")}</td>
                                    <td>{formatDate(incident.reported_on, "MMM d, yyyy h:mm a")}</td>
                                    <td><span className={`badge ${incident.status === "Open" ? "badge-open" : "badge-closed"}`}>{incident.status}</span></td>
                                    <td><button onClick={() => openViewModal(incident)} className="btn btn-ghost" style={{ padding: "0.375rem 0.5rem" }}><Eye size={16} /></button></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
