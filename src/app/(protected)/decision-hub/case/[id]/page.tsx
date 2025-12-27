"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";

interface Case {
    case_id: string;
    incident_id: string;
    reported_individual_id: string;
    squad: string;
    campus: string;
    case_status: string;
    verdict: string;
    case_comments: string;
    review_comments: string;
    category_of_offence: string;
    sub_category_of_offence: string;
    level_of_offence: string;
    punishment: string;
    appeal_reason: string;
}

export default function JudgementCasePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const [caseData, setCaseData] = useState<Case | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Form states
    const [verdict, setVerdict] = useState<"Guilty" | "Not Guilty" | "">("");
    const [punishment, setPunishment] = useState("");
    const [reviewComments, setReviewComments] = useState("");
    const [finalVerdict, setFinalVerdict] = useState<
        "Uphold Original" | "Overturn to Not Guilty" | "Modify Level" | ""
    >("");
    const [newLevelOfOffence, setNewLevelOfOffence] = useState("");

    useEffect(() => {
        async function fetchCase() {
            try {
                const res = await fetch(`/api/cases/${id}`);
                const data = await res.json();
                if (data.case) {
                    setCaseData(data.case);
                    setVerdict(data.case.verdict || "");
                    setPunishment(data.case.punishment || "");
                    setReviewComments(data.case.review_comments || "");
                }
            } catch (error) {
                console.error("Error fetching case:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchCase();
    }, [id]);

    async function requestMoreInvestigation() {
        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "request_more_investigation",
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to request more investigation");
            }

            router.push("/judgement-hub");
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    async function recordVerdict() {
        if (!verdict) {
            setError("Please select a verdict");
            return;
        }

        if (verdict === "Guilty" && !punishment) {
            setError("Please specify a punishment for guilty verdict");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "record_verdict",
                    data: {
                        verdict,
                        punishment: verdict === "Guilty" ? punishment : "",
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to record verdict");
            }

            router.push("/judgement-hub");
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    async function resolveAppeal() {
        if (!finalVerdict || !reviewComments) {
            setError("Please provide review comments and final verdict");
            return;
        }

        if (finalVerdict === "Modify Level" && !newLevelOfOffence) {
            setError("Please specify the new level of offence");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "resolve_appeal",
                    data: {
                        reviewComments,
                        finalVerdict,
                        newLevelOfOffence: finalVerdict === "Modify Level" ? newLevelOfOffence : undefined,
                        punishment: punishment || undefined,
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to resolve appeal");
            }

            router.push("/judgement-hub");
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

    if (!caseData) {
        return (
            <div style={{ padding: "3rem", textAlign: "center" }}>
                <p>Case not found</p>
                <Link href="/judgement-hub" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                    Back to Judgement Hub
                </Link>
            </div>
        );
    }

    const isAppealed = caseData.case_status === "Appealed";
    const isPendingJudgement = caseData.case_status === "Investigation Submitted";
    const isReadOnly = !isPendingJudgement && !isAppealed;

    return (
        <div>
            <div style={{ marginBottom: "1.5rem" }}>
                <Link
                    href="/judgement-hub"
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
                    Back to Judgement Hub
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <h1 className="page-title">{caseData.case_id}</h1>
                    <span
                        className={`badge ${caseData.case_status === "Final Decision"
                                ? "badge-closed"
                                : caseData.case_status === "Appealed"
                                    ? "badge-pending"
                                    : "badge-open"
                            }`}
                    >
                        {caseData.case_status}
                    </span>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                {/* Investigation Details (Read-only) */}
                <div className="card">
                    <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem" }}>
                        Investigation Details
                    </h3>

                    <div style={{ display: "grid", gap: "1rem" }}>
                        <div>
                            <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                Reported Individual
                            </label>
                            <p style={{ fontWeight: "500" }}>{caseData.reported_individual_id}</p>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                    Category
                                </label>
                                <p>{caseData.category_of_offence?.replace("Breach of ", "") || "-"}</p>
                            </div>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                    Sub-category
                                </label>
                                <p>{caseData.sub_category_of_offence || "-"}</p>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                    Level of Offence
                                </label>
                                <p>Level {caseData.level_of_offence || "-"}</p>
                            </div>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                    Campus / Squad
                                </label>
                                <p>{caseData.campus || "-"} / {caseData.squad || "-"}</p>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                Investigation Comments
                            </label>
                            <p style={{ whiteSpace: "pre-wrap" }}>{caseData.case_comments || "-"}</p>
                        </div>

                        {isAppealed && caseData.appeal_reason && (
                            <div
                                style={{
                                    padding: "1rem",
                                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                                    borderRadius: "var(--radius)",
                                    marginTop: "0.5rem",
                                }}
                            >
                                <label style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: "600" }}>
                                    Appeal Reason
                                </label>
                                <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                                    {caseData.appeal_reason}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Judgement Form */}
                <div className="card">
                    <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem" }}>
                        {isAppealed ? "Appeal Resolution" : isReadOnly ? "Verdict" : "Pass Judgement"}
                    </h3>

                    {error && (
                        <div
                            style={{
                                padding: "0.75rem",
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                color: "var(--destructive)",
                                borderRadius: "var(--radius)",
                                marginBottom: "1rem",
                                fontSize: "0.875rem",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {isPendingJudgement && (
                        <>
                            <div className="form-group">
                                <label className="label">
                                    Verdict <span style={{ color: "var(--destructive)" }}>*</span>
                                </label>
                                <select
                                    className="input select"
                                    value={verdict}
                                    onChange={(e) => setVerdict(e.target.value as "Guilty" | "Not Guilty")}
                                >
                                    <option value="">Select verdict...</option>
                                    <option value="Guilty">Guilty</option>
                                    <option value="Not Guilty">Not Guilty</option>
                                </select>
                            </div>

                            {verdict === "Guilty" && (
                                <div className="form-group">
                                    <label className="label">
                                        Punishment <span style={{ color: "var(--destructive)" }}>*</span>
                                    </label>
                                    <textarea
                                        className="input textarea"
                                        value={punishment}
                                        onChange={(e) => setPunishment(e.target.value)}
                                        placeholder="Specify the punishment..."
                                    />
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    gap: "0.75rem",
                                    marginTop: "1.5rem",
                                    paddingTop: "1.5rem",
                                    borderTop: "1px solid var(--border)",
                                }}
                            >
                                <button
                                    onClick={requestMoreInvestigation}
                                    className="btn btn-secondary"
                                    disabled={saving}
                                >
                                    <RotateCcw size={16} />
                                    Request More Investigation
                                </button>
                                <button
                                    onClick={recordVerdict}
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div>
                                    ) : (
                                        <Check size={16} />
                                    )}
                                    Record Verdict
                                </button>
                            </div>
                        </>
                    )}

                    {isAppealed && (
                        <>
                            <div className="form-group">
                                <label className="label">
                                    Review Comments <span style={{ color: "var(--destructive)" }}>*</span>
                                </label>
                                <textarea
                                    className="input textarea"
                                    value={reviewComments}
                                    onChange={(e) => setReviewComments(e.target.value)}
                                    placeholder="Document your review rationale..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">
                                    Final Verdict <span style={{ color: "var(--destructive)" }}>*</span>
                                </label>
                                <select
                                    className="input select"
                                    value={finalVerdict}
                                    onChange={(e) =>
                                        setFinalVerdict(
                                            e.target.value as "Uphold Original" | "Overturn to Not Guilty" | "Modify Level"
                                        )
                                    }
                                >
                                    <option value="">Select final verdict...</option>
                                    <option value="Uphold Original">Uphold Original Verdict</option>
                                    <option value="Overturn to Not Guilty">Overturn to Not Guilty</option>
                                    <option value="Modify Level">Modify Level of Offence</option>
                                </select>
                            </div>

                            {finalVerdict === "Modify Level" && (
                                <div className="form-group">
                                    <label className="label">New Level of Offence</label>
                                    <select
                                        className="input select"
                                        value={newLevelOfOffence}
                                        onChange={(e) => setNewLevelOfOffence(e.target.value)}
                                    >
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
                                    <textarea
                                        className="input textarea"
                                        value={punishment}
                                        onChange={(e) => setPunishment(e.target.value)}
                                        placeholder="Update punishment if needed..."
                                        style={{ minHeight: "80px" }}
                                    />
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    gap: "0.75rem",
                                    justifyContent: "flex-end",
                                    marginTop: "1.5rem",
                                    paddingTop: "1.5rem",
                                    borderTop: "1px solid var(--border)",
                                }}
                            >
                                <button
                                    onClick={resolveAppeal}
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div>
                                    ) : (
                                        <Check size={16} />
                                    )}
                                    Resolve Appeal
                                </button>
                            </div>
                        </>
                    )}

                    {isReadOnly && (
                        <div style={{ display: "grid", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                    Verdict
                                </label>
                                <p>
                                    <span
                                        className={`badge ${caseData.verdict === "Guilty" ? "badge-error" : "badge-closed"
                                            }`}
                                    >
                                        {caseData.verdict}
                                    </span>
                                </p>
                            </div>
                            {caseData.punishment && (
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                        Punishment
                                    </label>
                                    <p>{caseData.punishment}</p>
                                </div>
                            )}
                            {caseData.review_comments && (
                                <div>
                                    <label style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                                        Review Comments
                                    </label>
                                    <p style={{ whiteSpace: "pre-wrap" }}>{caseData.review_comments}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
