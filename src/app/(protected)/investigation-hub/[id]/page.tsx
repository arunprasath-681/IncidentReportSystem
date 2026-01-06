"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, User, Calendar, FileText, Edit, Eye, X, Save, Check, Plus } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { useSession } from "next-auth/react";

interface Incident {
    incident_id: string;
    complainant_id: string;
    complainant_category: string;
    date_time_of_incident: string;
    reported_on: string;
    description: string;
    status: "Open" | "Closed";
    attachments: string;
    metadata_changelog: string;
}

interface Case {
    case_id: string;
    incident_id: string;
    reported_individual_id: string;
    squad: string;
    campus: string;
    case_status: string;
    verdict: string;
    case_comments: string;
    category_of_offence: string;
    sub_category_of_offence: string;
    level_of_offence: string;
    punishment: string;
    investigator_attachments?: string;
    approver_attachments?: string;
}

const CATEGORIES = [
    "Breach of student code of conduct",
    "Breach of internship code of conduct",
    "Breach of mentor code of conduct",
];

const SUB_CATEGORIES: Record<string, string[]> = {
    "Breach of student code of conduct": [
        "Behavioral Misconduct",
        "Property and Resource Misuse",
        "Academic Integrity Violation",
        "Substance Abuse and Prohibited Activities",
        "Safety and Security Violations",
    ],
    "Breach of internship code of conduct": [
        "Professional Conduct and Workplace Behaviour",
        "Attendance and Commitment",
        "Confidentiality and Information Security",
        "Unauthorised Use of Company Resources",
        "Legal and Ethical Violations",
    ],
    "Breach of mentor code of conduct": ["Fraternization"],
};

const LEVELS = ["1", "2", "3", "4"];

export default function InvestigationIncidentPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const { data: session } = useSession();
    const [incident, setIncident] = useState<Incident | null>(null);
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "cases" | "changelog">("overview");

    // Modal states
    const [previewCase, setPreviewCase] = useState<Case | null>(null);
    const [editingCase, setEditingCase] = useState<Case | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form states
    const [categoryOfOffence, setCategoryOfOffence] = useState("");
    const [subCategoryOfOffence, setSubCategoryOfOffence] = useState("");
    const [levelOfOffence, setLevelOfOffence] = useState("");
    const [caseComments, setCaseComments] = useState("");

    // File upload state
    const [uploadedFiles, setUploadedFiles] = useState<{ file?: File; preview: string; name: string; url?: string; type: "image" | "pdf" | "doc" }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, [id]);

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



    function openEditModal(caseData: Case) {
        setEditingCase(caseData);
        setCategoryOfOffence(caseData.category_of_offence || "");
        setSubCategoryOfOffence(caseData.sub_category_of_offence || "");
        setLevelOfOffence(caseData.level_of_offence || "");
        setCaseComments(caseData.case_comments || "");
        setError("");

        // Parse existing investigator attachments
        const existingAttachments: string[] = [];
        try {
            if (caseData.investigator_attachments) {
                const parsed = JSON.parse(caseData.investigator_attachments);
                if (Array.isArray(parsed)) existingAttachments.push(...parsed);
            }
        } catch (e) { console.error("Error parsing attachments", e); }

        setUploadedFiles(existingAttachments.map(url => ({
            preview: url,
            name: url.split("/").pop() || "Attachment",
            url: url,
            type: url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? "image" : "doc"
        })));
    }

    function closeEditModal() {
        setEditingCase(null);
        setError("");
        setUploadedFiles([]); // Clear files when closing modal
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const validFiles: typeof uploadedFiles = [];

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
                    name: file.name,
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
            if (file.preview && !file.url) URL.revokeObjectURL(file.preview); // Revoke only if local
            return prev.filter((_, i) => i !== index);
        });
    }

    async function uploadNewFiles(): Promise<string[]> {
        if (!editingCase) return [];
        const existingUrls = uploadedFiles.filter(f => f.url).map(f => f.url!);
        const newFiles = uploadedFiles.filter(f => !f.url && f.file);

        if (newFiles.length === 0) return existingUrls;

        setUploading(true);
        const newUrls: string[] = [];

        try {
            // Upload in batches or individually
            const formData = new FormData();
            formData.append("incidentId", editingCase.incident_id);
            formData.append("caseId", editingCase.case_id);
            formData.append("folderType", "Investigator_Evidence");

            for (const f of newFiles) {
                formData.append("files", f.file!);
            }

            // Only call API if we added files to formData (we did in loop, but verify logic)
            if (newFiles.length > 0) {
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                if (!res.ok) throw new Error("Failed to upload files");
                const data = await res.json();
                if (data.files) {
                    newUrls.push(...data.files.map((f: any) => f.url));
                }
            }

        } catch (e) {
            console.error(e);
            throw new Error("File upload failed");
        } finally {
            setUploading(false);
        }

        return [...existingUrls, ...newUrls];
    }

    async function saveDraft() {
        if (!editingCase) return;
        setSaving(true);
        setError("");

        try {
            const attachments = await uploadNewFiles();

            const res = await fetch(`/api/cases/${editingCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save_draft",
                    data: {
                        categoryOfOffence,
                        subCategoryOfOffence,
                        levelOfOffence,
                        caseComments,
                        attachments // Logic in backend should route this to investigator_attachments
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save draft");
            }

            fetchData();
            closeEditModal();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    async function submitForReview() {
        if (!editingCase) return;
        if (!categoryOfOffence || !subCategoryOfOffence || !levelOfOffence || !caseComments) {
            setError("Please fill in all required fields");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const attachments = await uploadNewFiles();

            const res = await fetch(`/api/cases/${editingCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "submit_investigation",
                    data: {
                        categoryOfOffence,
                        subCategoryOfOffence,
                        levelOfOffence,
                        caseComments,
                        attachments
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit investigation");
            }

            fetchData();
            closeEditModal();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
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
                <Link href="/investigation-hub" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                    Back to Investigation Hub
                </Link>
            </div>
        );
    }

    const metadata = JSON.parse(incident.metadata_changelog || "{}");
    const changelog = metadata.changelog || [];
    const availableSubCategories = SUB_CATEGORIES[categoryOfOffence] || [];

    return (
        <div>
            {/* Preview Modal */}
            {previewCase && (
                <div className="modal-overlay" onClick={() => setPreviewCase(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Case Details - {previewCase.case_id}</h3>
                            <button onClick={() => setPreviewCase(null)} className="btn btn-ghost" style={{ padding: "0.25rem" }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ display: "grid", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Reported Individual</label>
                                <p style={{ fontWeight: "500" }}>{previewCase.reported_individual_id}</p>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Category of Offence</label>
                                    <p>{previewCase.category_of_offence || "-"}</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Sub-category</label>
                                    <p>{previewCase.sub_category_of_offence || "-"}</p>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Level of Offence</label>
                                    <p>{previewCase.level_of_offence ? `Level ${previewCase.level_of_offence}` : "-"}</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Verdict</label>
                                    <p>{previewCase.verdict || "-"}</p>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Case Comments</label>
                                <p style={{ whiteSpace: "pre-wrap" }}>{previewCase.case_comments || "-"}</p>
                            </div>

                            {previewCase.punishment && (
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Punishment</label>
                                    <p>{previewCase.punishment}</p>
                                </div>
                            )}

                            {/* Attachments Preview */}
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Evidence (Investigator Attachments)</label>
                                {!previewCase.investigator_attachments ? (
                                    <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>None</p>
                                ) : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                        {(() => {
                                            try {
                                                const attachments = JSON.parse(previewCase.investigator_attachments);
                                                if (!Array.isArray(attachments) || attachments.length === 0) return <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>None</p>;
                                                return attachments.map((url: string, idx: number) => {
                                                    const fileName = url.split("/").pop() || `Attachment ${idx + 1}`;
                                                    const isImage = url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/);
                                                    return (
                                                        <a href={url} target="_blank" rel="noopener noreferrer" key={idx} style={{
                                                            display: "flex", alignItems: "center", gap: "0.5rem",
                                                            padding: "0.5rem", border: "1px solid var(--border)",
                                                            borderRadius: "var(--radius)", textDecoration: "none",
                                                            color: "var(--foreground)", fontSize: "0.875rem",
                                                            maxWidth: "100%"
                                                        }}>
                                                            {isImage ? <Eye size={14} /> : <FileText size={14} />}
                                                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>{fileName}</span>
                                                        </a>
                                                    );
                                                });
                                            } catch (e) {
                                                return <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>Error loading attachments</p>;
                                            }
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingCase && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "650px" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Case - {editingCase.case_id}</h3>
                            <button onClick={closeEditModal} className="btn btn-ghost" style={{ padding: "0.25rem" }}>
                                <X size={18} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--destructive)", borderRadius: "var(--radius)", marginBottom: "1rem", fontSize: "0.875rem" }}>
                                {error}
                            </div>
                        )}

                        {/* Case Info */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem", padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)" }}>
                            <div>
                                <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>Reported Individual</span>
                                <p style={{ fontWeight: "500", fontSize: "0.875rem" }}>{editingCase.reported_individual_id}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>Squad</span>
                                <p style={{ fontSize: "0.875rem" }}>{editingCase.squad || "-"}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>Campus</span>
                                <p style={{ fontSize: "0.875rem" }}>{editingCase.campus || "-"}</p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="form-group">
                            <label className="label">Category of Offence <span style={{ color: "var(--destructive)" }}>*</span></label>
                            <select
                                className="input select"
                                value={categoryOfOffence}
                                onChange={(e) => { setCategoryOfOffence(e.target.value); setSubCategoryOfOffence(""); }}
                            >
                                <option value="">Select category...</option>
                                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Sub-category of Offence <span style={{ color: "var(--destructive)" }}>*</span></label>
                            <select
                                className="input select"
                                value={subCategoryOfOffence}
                                onChange={(e) => setSubCategoryOfOffence(e.target.value)}
                                disabled={!categoryOfOffence}
                            >
                                <option value="">Select sub-category...</option>
                                {availableSubCategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Level of Offence <span style={{ color: "var(--destructive)" }}>*</span></label>
                            <select className="input select" value={levelOfOffence} onChange={(e) => setLevelOfOffence(e.target.value)}>
                                <option value="">Select level...</option>
                                {LEVELS.map((level) => <option key={level} value={level}>Level {level}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Case Comments <span style={{ color: "var(--destructive)" }}>*</span></label>
                            <textarea
                                className="input textarea"
                                value={caseComments}
                                onChange={(e) => setCaseComments(e.target.value)}
                                placeholder="Document your investigation findings..."
                                style={{ minHeight: "100px" }}
                            />
                        </div>

                        {/* File Upload UI */}
                        <div className="form-group">
                            <label className="label">Attachments (Evidence) <span style={{ color: "var(--muted-foreground)", fontWeight: "normal" }}>(Optional)</span></label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                {uploadedFiles.map((file, index) => (
                                    <div key={index} style={{
                                        position: "relative", width: "80px", height: "80px", border: "1px solid var(--border)",
                                        borderRadius: "var(--radius)", overflow: "hidden", display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", backgroundColor: "var(--background)"
                                    }}>
                                        {file.type === "image" ? (
                                            <img src={file.preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        ) : (
                                            <FileText size={24} style={{ color: "var(--muted-foreground)" }} />
                                        )}
                                        <button
                                            onClick={() => removeFile(index)}
                                            style={{
                                                position: "absolute", top: "2px", right: "2px",
                                                backgroundColor: "rgba(0,0,0,0.6)", color: "white",
                                                border: "none", borderRadius: "50%", width: "18px", height: "18px",
                                                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "white", fontSize: "0.6rem", padding: "2px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {file.name}
                                        </div>
                                    </div>
                                ))}

                                {uploadedFiles.length < 5 && (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            width: "80px", height: "80px", border: "1px dashed var(--border)",
                                            borderRadius: "var(--radius)", display: "flex", flexDirection: "column",
                                            alignItems: "center", justifyContent: "center", cursor: "pointer",
                                            backgroundColor: "var(--muted)", color: "var(--muted-foreground)",
                                            transition: "background-color 0.2s"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--border)"}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--muted)"}
                                    >
                                        <Plus size={24} />
                                        <span style={{ fontSize: "0.65rem", marginTop: "0.25rem" }}>Add File</span>
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: "none" }}
                                onChange={handleFileSelect}
                                multiple
                                accept="image/*,application/pdf,.doc,.docx"
                            />
                            <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>
                                Supports Images, PDF, Docs. Max 10MB per file.
                            </p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                            <button onClick={saveDraft} className="btn btn-secondary" disabled={saving || uploading}>
                                <Save size={16} /> Save Draft
                            </button>
                            <button onClick={submitForReview} className="btn btn-primary" disabled={saving || uploading}>
                                {saving || uploading ? <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div> : <Check size={16} />}
                                Submit for Review
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: "1.5rem" }}>
                <Link
                    href="/investigation-hub"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "var(--muted-foreground)", textDecoration: "none", fontSize: "0.875rem", marginBottom: "0.5rem" }}
                >
                    <ArrowLeft size={16} /> Back to Investigation Hub
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
                <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>Overview</button>
                <button className={`tab ${activeTab === "cases" ? "active" : ""}`} onClick={() => setActiveTab("cases")}>Cases ({cases.length})</button>
                <button className={`tab ${activeTab === "changelog" ? "active" : ""}`} onClick={() => setActiveTab("changelog")}>Changelog</button>
            </div>

            {activeTab === "overview" && (
                <div className="card">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <User size={16} style={{ color: "var(--muted-foreground)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Complainant</span>
                            </div>
                            <p style={{ fontWeight: "500" }}>{incident.complainant_id}</p>
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Category</span>
                            </div>
                            <p style={{ fontWeight: "500", textTransform: "capitalize" }}>{incident.complainant_category}</p>
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <Calendar size={16} style={{ color: "var(--muted-foreground)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Date of Incident</span>
                            </div>
                            <p style={{ fontWeight: "500" }}>{formatDate(incident.date_time_of_incident, "MMMM d, yyyy 'at' h:mm a")}</p>
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <FileText size={16} style={{ color: "var(--muted-foreground)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textTransform: "uppercase" }}>Reported On</span>
                            </div>
                            <p style={{ fontWeight: "500" }}>{formatDate(incident.reported_on, "MMMM d, yyyy")}</p>
                        </div>

                        {metadata.relayedFromCompany && (
                            <div style={{ gridColumn: "span 2" }}>
                                <div style={{ padding: "0.75rem", backgroundColor: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius)" }}>
                                    <p style={{ fontSize: "0.875rem", fontWeight: "500", color: "var(--warning)" }}>
                                        Relayed from Company: {metadata.companyName}
                                    </p>
                                    {metadata.companyNotes && <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>{metadata.companyNotes}</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Description</h3>
                        <p style={{ whiteSpace: "pre-wrap", color: "var(--muted-foreground)" }}>{incident.description}</p>
                    </div>

                    <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Attachments</h3>
                        {(() => {
                            try {
                                const attachments = JSON.parse(incident.attachments || "[]");
                                if (!Array.isArray(attachments) || attachments.length === 0) {
                                    return <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>No attachments found</p>;
                                }
                                return (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                        {attachments.map((url: string, i: number) => {
                                            const isImage = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
                                            const fileName = `Attachment ${i + 1}`;
                                            return (
                                                <a
                                                    key={i}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "0.5rem",
                                                        padding: "0.5rem 0.75rem",
                                                        backgroundColor: "var(--muted)",
                                                        borderRadius: "var(--radius)",
                                                        textDecoration: "none",
                                                        color: "var(--foreground)",
                                                        fontSize: "0.875rem",
                                                        border: "1px solid var(--border)"
                                                    }}
                                                >
                                                    {isImage ? <Eye size={14} /> : <FileText size={14} />}
                                                    {fileName}
                                                </a>
                                            );
                                        })}
                                    </div>
                                );
                            } catch (e) {
                                return <p style={{ color: "var(--destructive)", fontSize: "0.875rem" }}>Error loading attachments</p>;
                            }
                        })()}
                    </div>
                </div>
            )}

            {activeTab === "cases" && (
                <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: "200px" }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Case ID</th>
                                <th>Reported Individual</th>
                                <th>Squad</th>
                                <th>Campus</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                                        <p style={{ color: "var(--muted-foreground)" }}>No cases found for this incident.</p>
                                    </td>
                                </tr>
                            ) : (
                                cases.map((c) => (
                                    <tr key={c.case_id}>
                                        <td style={{ fontWeight: "500" }}>{c.case_id}</td>
                                        <td>{c.reported_individual_id}</td>
                                        <td>{c.squad || "-"}</td>
                                        <td>{c.campus || "-"}</td>
                                        <td>
                                            <span className={`badge ${c.case_status === "Final Decision" ? "badge-closed" : c.case_status === "Pending Investigation" ? "badge-pending" : "badge-open"}`}>
                                                {c.case_status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                                <button onClick={() => setPreviewCase(c)} className="btn btn-ghost" style={{ padding: "0.375rem 0.5rem" }} title="Preview">
                                                    <Eye size={16} />
                                                </button>
                                                {c.case_status === "Pending Investigation" && (
                                                    <button onClick={() => openEditModal(c)} className="btn btn-ghost" style={{ padding: "0.375rem 0.5rem" }} title="Edit">
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === "changelog" && (
                <div className="card">
                    {changelog.length === 0 ? (
                        <p style={{ color: "var(--muted-foreground)" }}>No changelog entries</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {changelog.map((entry: { action: string; by: string; at: string; changes?: string[] }, index: number) => (
                                <div key={index} style={{ padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontWeight: "500", textTransform: "capitalize" }}>{entry.action.replace(/_/g, " ")}</span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{formatDate(entry.at, "MMM d, yyyy h:mm a")}</span>
                                    </div>
                                    <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>By: {entry.by}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
