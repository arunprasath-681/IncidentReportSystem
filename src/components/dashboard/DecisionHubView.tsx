"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, Eye, X, Check, RotateCcw, FileText, Activity, Gavel, Pencil, Plus, History, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { type CaseStatus } from "@/lib/sheets/cases";
import { SUB_CATEGORIES } from "@/lib/constants";

const CATEGORIES = Object.keys(SUB_CATEGORIES);
const DROPDOWN_LEVELS = ["1", "2", "3", "4"];

interface Case {
    case_id: string;
    incident_id: string;
    reported_individual_id: string;
    squad: string;
    campus: string;
    case_status: string;
    verdict: string;
    category_of_offence: string;
    sub_category_of_offence: string;
    level_of_offence: string;
    punishment: string;
    case_comments: string;
    review_comments: string;
    appeal_reason: string;
    appeal_attachments?: string;
    investigator_attachments?: string;
    approver_attachments?: string;
}

interface Incident {
    incident_id: string;
    description: string;
    date_time_of_incident: string;
    reported_on: string;
    attachments: string; // JSON
    complainant_category: string;
    status: string;
}


export default function DecisionHubView() {
    const router = useRouter();
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"pending" | "verdict" | "appealed" | "final">("pending");

    // Modal state
    const [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [modalMode, setModalMode] = useState<"verdict" | "appeal" | "view" | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<"incident" | "investigation" | "resolution" | "past_cases">("investigation");
    const [incidentData, setIncidentData] = useState<Incident | null>(null);
    const [loadingIncident, setLoadingIncident] = useState(false);

    // Edit Investigation State
    const [isEditingInvestigation, setIsEditingInvestigation] = useState(false);
    const [editForm, setEditForm] = useState({
        category: "",
        subCategory: "",
        level: "",
        comments: ""
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form states
    const [verdict, setVerdict] = useState<"Guilty" | "Not Guilty" | "">("");
    const [punishment, setPunishment] = useState("");
    const [reviewComments, setReviewComments] = useState("");
    const [finalVerdict, setFinalVerdict] = useState<"Uphold Original" | "Overturn to Not Guilty" | "Modify Level" | "">("");
    const [newLevel, setNewLevel] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [newSubCategory, setNewSubCategory] = useState("");

    // File Upload State
    const [uploadedFiles, setUploadedFiles] = useState<{ file?: File; preview: string; name: string; url?: string; type: "image" | "pdf" | "doc" }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCases();
    }, []);

    async function fetchCases() {
        try {
            const res = await fetch("/api/cases");
            const data = await res.json();
            setCases(data.cases || []);
        } catch (error) {
            console.error("Error fetching cases:", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchIncident(incidentId: string) {
        setLoadingIncident(true);
        try {
            const res = await fetch(`/api/incidents/${incidentId}`);
            if (res.ok) {
                const data = await res.json();
                setIncidentData(data.incident);
            }
        } catch (error) {
            console.error("Failed to fetch incident details", error);
        } finally {
            setLoadingIncident(false);
        }
    }

    function openModal(caseData: Case, mode: "verdict" | "appeal" | "view", defaultTab: "incident" | "investigation" | "resolution" | "past_cases" = "investigation") {
        setSelectedCase(caseData);
        setModalMode(mode);
        setActiveModalTab(defaultTab);
        setError("");
        setIsEditingInvestigation(false);

        // Reset form
        setVerdict(caseData.verdict as "Guilty" | "Not Guilty" || "");
        setPunishment(caseData.punishment || "");
        setReviewComments(caseData.review_comments || "");
        setFinalVerdict("");
        setNewLevel("");
        setNewCategory(caseData.category_of_offence || "");
        setNewSubCategory(caseData.sub_category_of_offence || "");

        // Load existing approver attachments
        const existingAttachments: string[] = [];
        try {
            if (caseData.approver_attachments) {
                const parsed = JSON.parse(caseData.approver_attachments);
                if (Array.isArray(parsed)) existingAttachments.push(...parsed);
            }
        } catch (e) { console.error("Error parsing attachments", e); }

        setUploadedFiles(existingAttachments.map(url => ({
            preview: url,
            name: url.split("/").pop() || "Attachment",
            url: url,
            type: url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? "image" : "doc"
        })));

        // Fetch incident data
        setIncidentData(null);
        fetchIncident(caseData.incident_id);
    }

    // Prefill form when "Modify Level" is selected OR when recording a verdict
    useEffect(() => {
        if ((finalVerdict === "Modify Level" || modalMode === "verdict") && selectedCase) {
            setNewCategory(selectedCase.category_of_offence || "");
            setNewSubCategory(selectedCase.sub_category_of_offence || "");
            setNewLevel(selectedCase.level_of_offence || "");
        }
    }, [finalVerdict, selectedCase, modalMode]);

    function closeModal() {
        setSelectedCase(null);
        setModalMode(null);
        setError("");
        setIncidentData(null);
        setIsEditingInvestigation(false);
        setUploadedFiles([]);
    }

    function startEditingInvestigation() {
        if (!selectedCase) return;
        setEditForm({
            category: selectedCase.category_of_offence || "",
            subCategory: selectedCase.sub_category_of_offence || "",
            level: selectedCase.level_of_offence || "",
            comments: selectedCase.case_comments || ""
        });
        setIsEditingInvestigation(true);
    }

    function cancelEditingInvestigation() {
        setIsEditingInvestigation(false);
        setError("");
    }

    async function saveInvestigationChanges() {
        if (!selectedCase) return;
        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${selectedCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "edit_investigation",
                    data: {
                        categoryOfOffence: editForm.category,
                        subCategoryOfOffence: editForm.subCategory, // Sending existing or empty
                        levelOfOffence: editForm.level,
                        caseComments: editForm.comments
                    }
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update investigation");
            }

            const data = await res.json();

            // Update local state
            setCases(cases.map(c => c.case_id === selectedCase.case_id ? data.case : c));
            setSelectedCase(data.case); // Update selected case with new data
            setIsEditingInvestigation(false);

        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    // File Helpers
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
            if (file.preview && !file.url) URL.revokeObjectURL(file.preview);
            return prev.filter((_, i) => i !== index);
        });
    }

    async function uploadNewFiles(): Promise<string[]> {
        if (!selectedCase) return [];
        const existingUrls = uploadedFiles.filter(f => f.url).map(f => f.url!);
        const newFiles = uploadedFiles.filter(f => !f.url && f.file);

        if (newFiles.length === 0) return existingUrls;

        setUploading(true);
        const newUrls: string[] = [];

        try {
            const formData = new FormData();
            formData.append("incidentId", selectedCase.incident_id);
            formData.append("caseId", selectedCase.case_id);
            formData.append("folderType", "Approver_Evidence");

            for (const f of newFiles) {
                formData.append("files", f.file!);
            }

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

    async function handleRecordVerdict() {
        if (!selectedCase || !verdict) {
            setError("Please select a verdict");
            return;
        }
        if (verdict === "Guilty" && !punishment) {
            setError("Please specify a punishment");
            return;
        }

        if (!newCategory || !newSubCategory || !newLevel) {
            setError("All offense details (Category, Sub-category, Level) are mandatory.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const attachments = await uploadNewFiles();

            const res = await fetch(`/api/cases/${selectedCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "record_verdict",
                    data: {
                        verdict,
                        punishment: verdict === "Guilty" ? punishment : "",
                        attachments, // Sent to backend, which maps to approver_attachments
                        newLevelOfOffence: newLevel,
                        newCategoryOfOffence: newCategory,
                        newSubCategoryOfOffence: newSubCategory,
                    },
                }),
            });

            if (!res.ok) throw new Error("Failed to record verdict");

            closeModal();
            fetchCases();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    async function handleRequestMore() {
        if (!selectedCase) return;
        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${selectedCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request_more_investigation" }),
            });

            if (!res.ok) throw new Error("Failed to request more investigation");

            closeModal();
            fetchCases();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    async function handleResolveAppeal() {
        if (!selectedCase || !finalVerdict || !reviewComments) {
            setError("Please provide review comments and final verdict");
            return;
        }
        if (finalVerdict === "Modify Level") {
            if (!newCategory || !newSubCategory || !newLevel) {
                setError("All fields (Category, Sub-category, Level) are mandatory for modification.");
                return;
            }
        }

        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${selectedCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "resolve_appeal",
                    data: {
                        reviewComments,
                        finalVerdict,
                        newLevelOfOffence: finalVerdict === "Modify Level" ? newLevel : undefined,
                        newCategoryOfOffence: finalVerdict === "Modify Level" ? newCategory : undefined,
                        newSubCategoryOfOffence: finalVerdict === "Modify Level" ? newSubCategory : undefined,
                        punishment: punishment || undefined,
                    },
                }),
            });

            if (!res.ok) throw new Error("Failed to resolve appeal");

            closeModal();
            fetchCases();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }
    const getModalModeForCase = (c: Case) => {
        if (c.case_status === "Investigation Submitted") return "verdict";
        if (c.case_status === "Appealed") return "appeal";
        return "view";
    };

    const filterCases = (status: string) => {
        switch (status) {
            case "pending": return cases.filter((c) => c.case_status === "Investigation Submitted");
            case "verdict": return cases.filter((c) => c.case_status === "Verdict Given");
            case "appealed": return cases.filter((c) => c.case_status === "Appealed");
            case "final": return cases.filter((c) => c.case_status === "Final Decision");
            default: return cases;
        }
    };

    const displayedCases = filterCases(activeTab);
    const counts = {
        pending: loading ? "-" : cases.filter((c) => c.case_status === "Investigation Submitted").length,
        verdict: loading ? "-" : cases.filter((c) => c.case_status === "Verdict Given").length,
        appealed: loading ? "-" : cases.filter((c) => c.case_status === "Appealed").length,
        final: loading ? "-" : cases.filter((c) => c.case_status === "Final Decision").length,
    };

    const parseAttachments = (json: string | undefined) => {
        if (!json) return [];
        try {
            return JSON.parse(json) as string[];
        } catch {
            return [];
        }
    };

    return (
        <div>
            {/* Modal */}
            {selectedCase && modalMode && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", width: "90vw" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {modalMode === "verdict" && "Record Verdict"}
                                {modalMode === "appeal" && "Resolve Appeal"}
                                {modalMode === "view" && "Case Details"}
                                {" - "}{selectedCase.case_id}
                            </h3>
                            <button onClick={closeModal} className="btn btn-ghost" style={{ padding: "0.25rem" }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="tabs" style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--border)" }}>
                            <button
                                className={`tab ${activeModalTab === "incident" ? "active" : ""}`}
                                onClick={() => setActiveModalTab("incident")}
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            >
                                <FileText size={14} /> Incident Details
                            </button>
                            <button
                                className={`tab ${activeModalTab === "investigation" ? "active" : ""}`}
                                onClick={() => setActiveModalTab("investigation")}
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            >
                                <Activity size={14} /> Investigation
                            </button>
                            <button
                                className={`tab ${activeModalTab === "past_cases" ? "active" : ""}`}
                                onClick={() => setActiveModalTab("past_cases")}
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            >
                                <History size={14} /> Past Cases ({selectedCase ? cases.filter(c => c.reported_individual_id === selectedCase.reported_individual_id && c.case_id !== selectedCase.case_id).length : 0})
                            </button>
                            <button
                                className={`tab ${activeModalTab === "resolution" ? "active" : ""}`}
                                onClick={() => setActiveModalTab("resolution")}
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            >
                                <Gavel size={14} /> Verdict
                            </button>
                        </div>

                        <div className="modal-content" style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "0.5rem" }}>
                            {error && (
                                <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--destructive)", borderRadius: "var(--radius)", marginBottom: "1rem", fontSize: "0.875rem" }}>
                                    {error}
                                </div>
                            )}

                            {/* Incident Tab */}
                            {activeModalTab === "incident" && (
                                <div style={{ display: "grid", gap: "1rem" }}>
                                    {loadingIncident ? (
                                        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}><div className="spinner"></div></div>
                                    ) : incidentData ? (
                                        <>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", display: "block", marginBottom: "0.25rem" }}>Incident ID</span>
                                                    <p style={{ fontWeight: "500" }}>{incidentData.incident_id}</p>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", display: "block", marginBottom: "0.25rem" }}>Occurred On</span>
                                                    <p>{incidentData.date_time_of_incident}</p>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", display: "block", marginBottom: "0.25rem" }}>Complainant Category</span>
                                                    <p>{incidentData.complainant_category}</p>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", display: "block", marginBottom: "0.25rem" }}>Reported On</span>
                                                    <p>{incidentData.reported_on}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", display: "block", marginBottom: "0.25rem" }}>Description</span>
                                                <div style={{ padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
                                                    {incidentData.description}
                                                </div>
                                            </div>
                                            {parseAttachments(incidentData.attachments).length > 0 && (
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", display: "block", marginBottom: "0.25rem" }}>Attachments</span>
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        {parseAttachments(incidentData.attachments).map((url, i) => (
                                                            <a
                                                                key={i}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: "var(--primary)", fontSize: "0.875rem", textDecoration: "underline" }}
                                                            >
                                                                Attachment {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p style={{ color: "var(--muted-foreground)", textAlign: "center" }}>Failed to load incident details.</p>
                                    )}
                                </div>
                            )}

                            {/* Investigation Tab */}
                            {activeModalTab === "investigation" && (
                                <div style={{ display: "grid", gap: "1rem" }}>

                                    {/* Edit button removed as per requirements */}

                                    {isEditingInvestigation ? (
                                        <div className="space-y-4" style={{ padding: "1rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)" }}>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="form-group">
                                                    <label className="label">Category</label>
                                                    <select
                                                        className="input select"
                                                        value={editForm.category}
                                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value, subCategory: "" })}
                                                    >
                                                        <option value="">Select category...</option>
                                                        {CATEGORIES.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Sub-category</label>
                                                    <select
                                                        className="input select"
                                                        value={editForm.subCategory}
                                                        onChange={(e) => setEditForm({ ...editForm, subCategory: e.target.value })}
                                                        disabled={!editForm.category}
                                                    >
                                                        <option value="">Select sub-category...</option>
                                                        {(SUB_CATEGORIES[editForm.category as keyof typeof SUB_CATEGORIES] || []).map(sub => (
                                                            <option key={sub} value={sub}>{sub}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Level</label>
                                                    <select
                                                        className="input select"
                                                        value={editForm.level}
                                                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                                                    >
                                                        <option value="">Select Level...</option>
                                                        {DROPDOWN_LEVELS.map(lvl => (
                                                            <option key={lvl} value={lvl}>Level {lvl}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="label">Investigation Comments</label>
                                                <textarea
                                                    className="input textarea"
                                                    value={editForm.comments}
                                                    onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                                                    rows={4}
                                                />
                                            </div>

                                            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                                                <button onClick={cancelEditingInvestigation} className="btn btn-secondary" disabled={saving}>
                                                    Cancel
                                                </button>
                                                <button onClick={saveInvestigationChanges} className="btn btn-primary" disabled={saving}>
                                                    {saving ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)" }}>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Reported Individual</span>
                                                    <p style={{ fontWeight: "500" }}>{selectedCase.reported_individual_id}</p>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Category</span>
                                                    <p>{selectedCase.category_of_offence?.replace("Breach of ", "") || "-"}</p>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Level</span>
                                                    <p>Level {selectedCase.level_of_offence || "-"}</p>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Campus / Squad</span>
                                                    <p>{selectedCase.campus || "-"} / {selectedCase.squad || "-"}</p>
                                                </div>
                                            </div>

                                            {selectedCase.case_comments && (
                                                <div style={{ marginBottom: "1.5rem" }}>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Investigation Comments</span>
                                                    <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem", fontSize: "0.875rem" }}>{selectedCase.case_comments}</p>
                                                </div>
                                            )}

                                            {/* Investigator Attachments */}
                                            {parseAttachments(selectedCase.investigator_attachments).length > 0 && (
                                                <div style={{ marginBottom: "1.5rem" }}>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Evidence / Attachments</span>
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                                                        {parseAttachments(selectedCase.investigator_attachments).map((url, i) => (
                                                            <a
                                                                key={i}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.875rem", textDecoration: "none" }}
                                                            >
                                                                <FileText size={14} />
                                                                Evidence {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Resolution Tab */}
                            {activeModalTab === "resolution" && (
                                <div style={{ display: "grid", gap: "1rem" }}>
                                    {modalMode === "appeal" && selectedCase.appeal_reason && (
                                        <div style={{ padding: "1rem", backgroundColor: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius)", marginBottom: "1.5rem" }}>
                                            <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: "600" }}>Appeal Reason</span>
                                            <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{selectedCase.appeal_reason}</p>

                                            {parseAttachments(selectedCase.appeal_attachments).length > 0 && (
                                                <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(245, 158, 11, 0.2)", paddingTop: "1rem" }}>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: "600", display: "block", marginBottom: "0.5rem" }}>Appeal Attachments</span>
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        {parseAttachments(selectedCase.appeal_attachments).map((url, i) => (
                                                            <a
                                                                key={i}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    display: "flex", alignItems: "center", gap: "0.25rem",
                                                                    padding: "0.375rem 0.5rem", backgroundColor: "var(--primary)",
                                                                    borderRadius: "var(--radius)", fontSize: "0.80rem", textDecoration: "none",
                                                                    color: "var(--primary-foreground)"
                                                                }}
                                                            >
                                                                <FileText size={14} />
                                                                Attachment {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Verdict Form */}
                                    {modalMode === "verdict" && (
                                        <>
                                            <div className="form-group">
                                                <label className="label">Verdict <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                <select className="input select" value={verdict} onChange={(e) => setVerdict(e.target.value as "Guilty" | "Not Guilty")}>
                                                    <option value="">Select verdict...</option>
                                                    <option value="Guilty">Guilty</option>
                                                    <option value="Not Guilty">Not Guilty</option>
                                                </select>
                                            </div>

                                            {verdict === "Guilty" && (
                                                <div className="form-group">
                                                    <label className="label">Punishment <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                    <textarea className="input textarea" value={punishment} onChange={(e) => setPunishment(e.target.value)} placeholder="Specify the punishment..." />
                                                </div>
                                            )}

                                            {/* Offense Details (Editable) */}
                                            <div style={{ display: "grid", gap: "0.75rem", padding: "1rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", marginBottom: "1rem" }}>
                                                <div className="form-group">
                                                    <label className="label">Category <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                    <select
                                                        className="input select"
                                                        value={newCategory}
                                                        onChange={(e) => { setNewCategory(e.target.value); setNewSubCategory(""); }}
                                                    >
                                                        <option value="">Select category...</option>
                                                        {CATEGORIES.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Sub-category <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                    <select
                                                        className="input select"
                                                        value={newSubCategory}
                                                        onChange={(e) => setNewSubCategory(e.target.value)}
                                                        disabled={!newCategory}
                                                    >
                                                        <option value="">Select sub-category...</option>
                                                        {(SUB_CATEGORIES[newCategory as keyof typeof SUB_CATEGORIES] || []).map(sub => (
                                                            <option key={sub} value={sub}>{sub}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="label">Level of Offence <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                    <select className="input select" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
                                                        <option value="">Select level...</option>
                                                        {DROPDOWN_LEVELS.map(lvl => (
                                                            <option key={lvl} value={lvl}>Level {lvl}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* File Upload UI */}
                                            <div className="form-group">
                                                <label className="label">Attachments (Optional)</label>
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
                                            </div>

                                            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                                                <button onClick={handleRequestMore} className="btn btn-secondary" disabled={saving || uploading}>
                                                    <RotateCcw size={16} /> Request More Investigation
                                                </button>
                                                <button onClick={handleRecordVerdict} className="btn btn-primary" disabled={saving || uploading} style={{ marginLeft: "auto" }}>
                                                    {saving || uploading ? <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div> : <Check size={16} />}
                                                    Record Verdict
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {/* Appeal Resolution Form */}
                                    {modalMode === "appeal" && (
                                        <>
                                            <div className="form-group">
                                                <label className="label">Review Comments <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                <textarea className="input textarea" value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} placeholder="Document your review rationale..." />
                                            </div>

                                            <div className="form-group">
                                                <label className="label">Final Verdict <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                <select className="input select" value={finalVerdict} onChange={(e) => setFinalVerdict(e.target.value as typeof finalVerdict)}>
                                                    <option value="">Select final verdict...</option>
                                                    <option value="Uphold Original">Uphold Original Verdict</option>
                                                    <option value="Overturn to Not Guilty">Overturn to Not Guilty</option>
                                                    <option value="Modify Level">Modify Offense Details</option>
                                                </select>
                                            </div>

                                            {finalVerdict === "Modify Level" && (
                                                <div style={{ display: "grid", gap: "0.75rem", padding: "1rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)" }}>
                                                    <div className="form-group">
                                                        <label className="label">Category <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                        <select
                                                            className="input select"
                                                            value={newCategory}
                                                            onChange={(e) => { setNewCategory(e.target.value); setNewSubCategory(""); }}
                                                        >
                                                            <option value="">Select category...</option>
                                                            {CATEGORIES.map(cat => (
                                                                <option key={cat} value={cat}>{cat}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="label">Sub-category <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                        <select
                                                            className="input select"
                                                            value={newSubCategory}
                                                            onChange={(e) => setNewSubCategory(e.target.value)}
                                                            disabled={!newCategory}
                                                        >
                                                            <option value="">Select sub-category...</option>
                                                            {(SUB_CATEGORIES[newCategory as keyof typeof SUB_CATEGORIES] || []).map(sub => (
                                                                <option key={sub} value={sub}>{sub}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="label">New Level of Offence <span style={{ color: "var(--destructive)" }}>*</span></label>
                                                        <select className="input select" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
                                                            <option value="">Select level...</option>
                                                            {DROPDOWN_LEVELS.map(lvl => (
                                                                <option key={lvl} value={lvl}>Level {lvl}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {finalVerdict && finalVerdict !== "Overturn to Not Guilty" && (
                                                <div className="form-group">
                                                    <label className="label">Updated Punishment (optional)</label>
                                                    <textarea className="input textarea" value={punishment} onChange={(e) => setPunishment(e.target.value)} placeholder="Update punishment if needed..." style={{ minHeight: "80px" }} />
                                                </div>
                                            )}

                                            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", justifyContent: "flex-end" }}>
                                                <button onClick={handleResolveAppeal} className="btn btn-primary" disabled={saving}>
                                                    {saving ? "Saving..." : "Submit Resolution"}
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {/* View Mode (Read-only Resolution) */}
                                    {modalMode === "view" && (
                                        <div style={{ display: "grid", gap: "1rem" }}>
                                            <div>
                                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Verdict</span>
                                                <p><span className={`badge ${selectedCase.verdict === "Guilty" ? "badge-error" : "badge-closed"}`}>{selectedCase.verdict}</span></p>
                                            </div>
                                            {selectedCase.punishment && (
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Punishment</span>
                                                    <p>{selectedCase.punishment}</p>
                                                </div>
                                            )}
                                            {selectedCase.review_comments && (
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Review Comments</span>
                                                    <p style={{ whiteSpace: "pre-wrap" }}>{selectedCase.review_comments}</p>
                                                </div>
                                            )}
                                            {/* Show Approver Attachments in View Mode if any */}
                                            {parseAttachments(selectedCase.approver_attachments).length > 0 && (
                                                <div>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Approver Attachments</span>
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                                                        {parseAttachments(selectedCase.approver_attachments).map((url, i) => (
                                                            <a
                                                                key={i}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem", color: "var(--primary)" }}
                                                            >
                                                                <FileText size={14} /> Attachment {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* If pending and no verdict yet */}
                                    {modalMode === "view" && !selectedCase.verdict && (
                                        <div className="p-4 bg-muted rounded-md text-center">
                                            <p className="text-muted-foreground">Pending Decision</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Past Cases Tab */}
                            {activeModalTab === "past_cases" && (
                                <PastCasesList
                                    currentCaseId={selectedCase.case_id}
                                    reportedIndividualId={selectedCase.reported_individual_id}
                                    allCases={cases}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">Decision Hub</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        Review investigations and pass verdicts
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ width: "fit-content" }}>
                <button className={`tab ${activeTab === "pending" ? "active" : ""}`} onClick={() => setActiveTab("pending")}>
                    Pending Decision ({counts.pending})
                </button>
                <button className={`tab ${activeTab === "verdict" ? "active" : ""}`} onClick={() => setActiveTab("verdict")}>
                    Verdict Given ({counts.verdict})
                </button>
                <button className={`tab ${activeTab === "appealed" ? "active" : ""}`} onClick={() => setActiveTab("appealed")}>
                    Appealed ({counts.appealed})
                </button>
                <button className={`tab ${activeTab === "final" ? "active" : ""}`} onClick={() => setActiveTab("final")}>
                    Final Decision ({counts.final})
                </button>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: "300px" }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Case ID</th>
                            <th>Incident ID</th>
                            <th>Reported Individual</th>
                            <th>Category</th>
                            <th>Level</th>
                            {activeTab !== "pending" && <th>Verdict</th>}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={activeTab !== "pending" ? 7 : 6} style={{ textAlign: "center", padding: "2rem" }}>
                                    <div className="spinner" style={{ margin: "0 auto" }}></div>
                                </td>
                            </tr>
                        ) : displayedCases.length === 0 ? (
                            <tr>
                                <td colSpan={activeTab !== "pending" ? 7 : 6} style={{ padding: "2rem" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                        <Scale size={32} style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem" }} />
                                        <p style={{ fontWeight: "500" }}>No cases in this category</p>
                                        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Cases will appear here when they reach this stage.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            displayedCases.map((c) => (
                                <tr key={c.case_id}>
                                    <td style={{ fontWeight: "500" }}>{c.case_id}</td>
                                    <td>
                                        <button
                                            onClick={() => openModal(c, getModalModeForCase(c), "incident")}
                                            className="hover:underline font-medium"
                                            style={{ color: "var(--primary)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                                        >
                                            {c.incident_id}
                                        </button>
                                    </td>
                                    <td>{c.reported_individual_id}</td>
                                    <td style={{ fontSize: "0.875rem" }}>
                                        {c.category_of_offence?.replace("Breach of ", "").replace(" code of conduct", "") || "-"}
                                    </td>
                                    <td>{c.level_of_offence || "-"}</td>
                                    {activeTab !== "pending" && (
                                        <td>
                                            {c.verdict ? (
                                                <span className={`badge ${c.verdict === "Guilty" ? "badge-error" : "badge-closed"}`}>
                                                    {c.verdict}
                                                </span>
                                            ) : "-"}
                                        </td>
                                    )}
                                    <td>
                                        <button
                                            onClick={() => openModal(c, getModalModeForCase(c), "resolution")}
                                            className="btn btn-ghost"
                                            style={{ padding: "0.375rem 0.5rem" }}
                                        >
                                            {c.case_status === "Investigation Submitted" || c.case_status === "Appealed" ? <Scale size={16} /> : <Eye size={16} />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PastCasesList({ currentCaseId, reportedIndividualId, allCases }: { currentCaseId: string, reportedIndividualId: string, allCases: Case[] }) {
    const pastCases = allCases
        .filter(c => c.reported_individual_id === reportedIndividualId && c.case_id !== currentCaseId)
        .sort((a, b) => b.case_id.localeCompare(a.case_id));

    const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedCaseId(expandedCaseId === id ? null : id);
    };

    if (pastCases.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted-foreground)" }}>
                <History size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                <p>No past cases found for this individual.</p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
                Found {pastCases.length} other case{pastCases.length !== 1 ? "s" : ""} for <strong>{reportedIndividualId}</strong>
            </p>
            {pastCases.map(c => (
                <div key={c.case_id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                    <button
                        onClick={() => toggleExpand(c.case_id)}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "1rem",
                            backgroundColor: "var(--muted)",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>{c.case_id}</span>
                            <span className={`badge ${c.case_status === "Final Decision" ? "badge-closed" : "badge-open"}`} style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                                {c.case_status}
                            </span>
                        </div>
                        {expandedCaseId === c.case_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedCaseId === c.case_id && (
                        <div style={{ padding: "1.5rem", backgroundColor: "var(--card)" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                                {/* Investigation */}
                                <TimelineItem
                                    icon={<Search size={14} />}
                                    title="Investigation"
                                    isLast={false}
                                    statusColor={c.case_status !== "Pending Investigation" ? "var(--primary)" : "var(--muted)"}
                                >
                                    <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>Status: <span className="badge badge-open">{c.case_status === "Pending Investigation" ? "In Progress" : "Completed"}</span></p>
                                    {c.case_comments && (
                                        <div style={{ marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", fontSize: "0.875rem", fontStyle: "italic" }}>"{c.case_comments}"</div>
                                    )}
                                </TimelineItem>

                                {/* Verdict */}
                                {(c.verdict || c.case_status !== "Pending Investigation") && (
                                    <TimelineItem
                                        icon={<FileText size={14} />}
                                        title="Verdict"
                                        isLast={!c.appeal_reason && c.case_status !== "Appealed"}
                                        statusColor={c.verdict ? "var(--primary)" : "var(--muted)"}
                                    >
                                        {c.verdict ? (
                                            <div style={{ marginTop: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                                                <div style={{ padding: "0.75rem", backgroundColor: c.verdict === "Guilty" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                                                    <span style={{ fontWeight: "600", color: c.verdict === "Guilty" ? "var(--destructive)" : "var(--success)" }}>{c.verdict}</span>
                                                    {c.punishment && <span style={{ fontSize: "0.8rem" }}>{c.punishment}</span>}
                                                </div>
                                                <div style={{ padding: "1rem", backgroundColor: "var(--card)", fontSize: "0.875rem" }}>
                                                    <p><span style={{ color: "var(--muted-foreground)" }}>Category:</span> {c.category_of_offence}</p>
                                                    <p><span style={{ color: "var(--muted-foreground)" }}>Level:</span> {c.level_of_offence}</p>
                                                </div>
                                            </div>
                                        ) : <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Waiting for decision...</p>}
                                    </TimelineItem>
                                )}

                                {/* Appeal */}
                                {(c.appeal_reason || c.case_status === "Appealed" || c.case_status === "Final Decision") && c.appeal_reason && (
                                    <TimelineItem
                                        icon={<AlertTriangle size={14} />}
                                        title="Appeal"
                                        isLast={c.case_status !== "Final Decision"}
                                        statusColor="var(--warning)"
                                    >
                                        <div style={{ marginTop: "0.5rem", backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "var(--radius)" }}>
                                            <p style={{ fontSize: "0.875rem", fontStyle: "italic" }}>"{c.appeal_reason}"</p>
                                        </div>
                                    </TimelineItem>
                                )}

                                {/* Final Decision */}
                                {c.case_status === "Final Decision" && (
                                    <TimelineItem
                                        icon={<CheckCircle size={14} />}
                                        title="Final Decision"
                                        isLast={true}
                                        statusColor="var(--success)"
                                    >
                                        <p style={{ marginTop: "0.25rem", color: "var(--success)", fontWeight: "500" }}>Case Closed</p>
                                        {c.review_comments && <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Review: {c.review_comments}</p>}
                                    </TimelineItem>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function TimelineItem({ icon, title, date, children, isLast, statusColor }: { icon: React.ReactNode, title: string, date?: string, children: React.ReactNode, isLast: boolean, statusColor: string }) {
    return (
        <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", backgroundColor: statusColor, color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}>
                    {icon}
                </div>
                {!isLast && <div style={{ width: "2px", flexGrow: 1, backgroundColor: "var(--border)", minHeight: "2rem" }}></div>}
            </div>
            <div style={{ paddingBottom: "2rem", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "1rem" }}>{title}</h4>
                    {date && <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{date}</span>}
                </div>
                {children}
            </div>
        </div>
    );
}
