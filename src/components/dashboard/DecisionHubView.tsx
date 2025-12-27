"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, Eye, X, Check, RotateCcw } from "lucide-react";

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

export default function DecisionHubView() {
    const router = useRouter();
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"pending" | "verdict" | "appealed" | "final">("pending");

    // Modal state
    const [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [modalMode, setModalMode] = useState<"verdict" | "appeal" | "view" | null>(null);
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

    function openModal(caseData: Case, mode: "verdict" | "appeal" | "view") {
        setSelectedCase(caseData);
        setModalMode(mode);
        setError("");
        setVerdict(caseData.verdict as "Guilty" | "Not Guilty" || "");
        setPunishment(caseData.punishment || "");
        setReviewComments(caseData.review_comments || "");
        setFinalVerdict("");
        setNewLevel("");
    }

    function closeModal() {
        setSelectedCase(null);
        setModalMode(null);
        setError("");
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

    return (
        <div>
            {/* Modal */}
            {selectedCase && modalMode && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
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

                        {error && (
                            <div style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--destructive)", borderRadius: "var(--radius)", marginBottom: "1rem", fontSize: "0.875rem" }}>
                                {error}
                            </div>
                        )}

                        {/* Case Info */}
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
                                <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>{selectedCase.case_comments}</p>
                            </div>
                        )}

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

                        {/* View Mode */}
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

            {/* Table - Always show structure */}
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
                                        <Link href={`/investigation-hub/${c.incident_id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                                            {c.incident_id}
                                        </Link>
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
                                            onClick={() => {
                                                if (activeTab === "pending") openModal(c, "verdict");
                                                else if (activeTab === "appealed") openModal(c, "appeal");
                                                else openModal(c, "view");
                                            }}
                                            className="btn btn-ghost"
                                            style={{ padding: "0.375rem 0.5rem" }}
                                        >
                                            {activeTab === "pending" || activeTab === "appealed" ? <Scale size={16} /> : <Eye size={16} />}
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
