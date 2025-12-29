"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, Eye, X, Check, RotateCcw, FileText, Activity, Gavel, Pencil } from "lucide-react";
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
    const [activeModalTab, setActiveModalTab] = useState<"incident" | "investigation" | "resolution">("investigation");
    const [incidentData, setIncidentData] = useState<Incident | null>(null);
    const [loadingIncident, setLoadingIncident] = useState(false);

    // Edit Investigation State
    const [isEditingInvestigation, setIsEditingInvestigation] = useState(false);
    const [editForm, setEditForm] = useState({
        category: "",
        subCategory: "", // Not shown in UI usually but needed for API often if schema requires it, but schema was partial? No, schema was not verified. API uses partial if I coded it that way? Checked API code: it uses body.data.categoryOfOffence etc. I should make sure to send subCategory if needed.
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

    function openModal(caseData: Case, mode: "verdict" | "appeal" | "view", defaultTab: "incident" | "investigation" | "resolution" = "investigation") {
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

        // Fetch incident data
        setIncidentData(null);
        fetchIncident(caseData.incident_id);
    }

    function closeModal() {
        setSelectedCase(null);
        setModalMode(null);
        setError("");
        setIncidentData(null);
        setIsEditingInvestigation(false);
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

    async function handleRecordVerdict() {
        if (!selectedCase || !verdict) {
            setError("Please select a verdict");
            return;
        }
        if (verdict === "Guilty" && !punishment) {
            setError("Please specify a punishment");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${selectedCase.case_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "record_verdict",
                    data: { verdict, punishment: verdict === "Guilty" ? punishment : "" },
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
        if (finalVerdict === "Modify Level" && !newLevel) {
            setError("Please specify the new level");
            return;
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

    const parseAttachments = (json: string) => {
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

                                    {!isEditingInvestigation && (
                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                            <button
                                                onClick={startEditingInvestigation}
                                                className="btn btn-ghost"
                                                style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)" }}
                                            >
                                                <Pencil size={14} /> Edit Investigation
                                            </button>
                                        </div>
                                    )}

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

                                            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                                                <button onClick={handleRequestMore} className="btn btn-secondary" disabled={saving}>
                                                    <RotateCcw size={16} /> Request More Investigation
                                                </button>
                                                <button onClick={handleRecordVerdict} className="btn btn-primary" disabled={saving} style={{ marginLeft: "auto" }}>
                                                    {saving ? <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div> : <Check size={16} />}
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
                                                    <option value="Modify Level">Modify Level of Offence</option>
                                                </select>
                                            </div>

                                            {finalVerdict === "Modify Level" && (
                                                <div className="form-group">
                                                    <label className="label">New Level of Offence</label>
                                                    <select className="input select" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
                                                        <option value="">Select level...</option>
                                                        <option value="1">Level 1</option>
                                                        <option value="2">Level 2</option>
                                                        <option value="3">Level 3</option>
                                                        <option value="4">Level 4</option>
                                                    </select>
                                                </div>
                                            )}

                                            {finalVerdict && finalVerdict !== "Overturn to Not Guilty" && (
                                                <div className="form-group">
                                                    <label className="label">Updated Punishment (optional)</label>
                                                    <textarea className="input textarea" value={punishment} onChange={(e) => setPunishment(e.target.value)} placeholder="Update punishment if needed..." style={{ minHeight: "80px" }} />
                                                </div>
                                            )}

                                            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                                                <button onClick={handleResolveAppeal} className="btn btn-primary" disabled={saving}>
                                                    {saving ? <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div> : <Check size={16} />}
                                                    Resolve Appeal
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
                                <td colSpan={activeTab !== "pending" ? 7 : 6} style={{ textAlign: "center", padding: "2rem" }}>
                                    <Scale size={32} style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem" }} />
                                    <p style={{ fontWeight: "500" }}>No cases in this category</p>
                                    <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Cases will appear here when they reach this stage.</p>
                                </td>
                            </tr>
                        ) : (
                            displayedCases.map((c) => (
                                <tr key={c.case_id}>
                                    <td style={{ fontWeight: "500" }}>{c.case_id}</td>
                                    <td>
                                        <button
                                            onClick={() => openModal(c, getModalModeForCase(c), "incident")}
                                            className="text-primary hover:underline font-medium"
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
