"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

interface Case {
    case_id: string;
    incident_id: string;
    reported_individual_id: string;
    squad: string;
    campus: string;
    case_status: string;
    category_of_offence: string;
    sub_category_of_offence: string;
    level_of_offence: string;
    case_comments: string;
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

export default function CaseEditPage({
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
    const [categoryOfOffence, setCategoryOfOffence] = useState("");
    const [subCategoryOfOffence, setSubCategoryOfOffence] = useState("");
    const [levelOfOffence, setLevelOfOffence] = useState("");
    const [caseComments, setCaseComments] = useState("");

    useEffect(() => {
        async function fetchCase() {
            try {
                const res = await fetch(`/api/cases/${id}`);
                const data = await res.json();
                if (data.case) {
                    setCaseData(data.case);
                    setCategoryOfOffence(data.case.category_of_offence || "");
                    setSubCategoryOfOffence(data.case.sub_category_of_offence || "");
                    setLevelOfOffence(data.case.level_of_offence || "");
                    setCaseComments(data.case.case_comments || "");
                }
            } catch (error) {
                console.error("Error fetching case:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchCase();
    }, [id]);

    async function saveDraft() {
        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save_draft",
                    data: {
                        categoryOfOffence,
                        subCategoryOfOffence,
                        levelOfOffence,
                        caseComments,
                    },
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to save draft");
            }

            alert("Draft saved successfully");
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    }

    async function submitInvestigation() {
        if (!categoryOfOffence || !subCategoryOfOffence || !levelOfOffence || !caseComments) {
            setError("Please fill in all required fields");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/cases/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "submit_investigation",
                    data: {
                        categoryOfOffence,
                        subCategoryOfOffence,
                        levelOfOffence,
                        caseComments,
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit investigation");
            }

            router.push(`/investigation-hub/${caseData?.incident_id}`);
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
                <Link href="/investigation-hub" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                    Back to Investigation Hub
                </Link>
            </div>
        );
    }

    const availableSubCategories = SUB_CATEGORIES[categoryOfOffence] || [];

    return (
        <div>
            <div style={{ marginBottom: "1.5rem" }}>
                <Link
                    href={`/investigation-hub/${caseData.incident_id}`}
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
                    Back to Incident
                </Link>
                <h1 className="page-title">Edit Case - {caseData.case_id}</h1>
                <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                    Reported Individual: {caseData.reported_individual_id}
                </p>
            </div>

            <div className="card" style={{ maxWidth: "700px" }}>
                {error && (
                    <div
                        style={{
                            padding: "0.75rem",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            color: "var(--destructive)",
                            borderRadius: "var(--radius)",
                            marginBottom: "1.25rem",
                            fontSize: "0.875rem",
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Case Info */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "1rem",
                        marginBottom: "1.5rem",
                        padding: "1rem",
                        backgroundColor: "var(--muted)",
                        borderRadius: "var(--radius)",
                    }}
                >
                    <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                            Squad
                        </span>
                        <p style={{ fontWeight: "500" }}>{caseData.squad || "-"}</p>
                    </div>
                    <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                            Campus
                        </span>
                        <p style={{ fontWeight: "500" }}>{caseData.campus || "-"}</p>
                    </div>
                </div>

                {/* Category */}
                <div className="form-group">
                    <label className="label">
                        Category of Offence <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <select
                        className="input select"
                        value={categoryOfOffence}
                        onChange={(e) => {
                            setCategoryOfOffence(e.target.value);
                            setSubCategoryOfOffence("");
                        }}
                    >
                        <option value="">Select category...</option>
                        {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Sub-category */}
                <div className="form-group">
                    <label className="label">
                        Sub-category of Offence <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <select
                        className="input select"
                        value={subCategoryOfOffence}
                        onChange={(e) => setSubCategoryOfOffence(e.target.value)}
                        disabled={!categoryOfOffence}
                    >
                        <option value="">Select sub-category...</option>
                        {availableSubCategories.map((sub) => (
                            <option key={sub} value={sub}>
                                {sub}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Level */}
                <div className="form-group">
                    <label className="label">
                        Level of Offence <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <select
                        className="input select"
                        value={levelOfOffence}
                        onChange={(e) => setLevelOfOffence(e.target.value)}
                    >
                        <option value="">Select level...</option>
                        {LEVELS.map((level) => (
                            <option key={level} value={level}>
                                Level {level}
                            </option>
                        ))}
                    </select>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        Level 1-3: No appeal allowed. Level 4: Appeal allowed for guilty verdicts.
                    </p>
                </div>

                {/* Comments */}
                <div className="form-group">
                    <label className="label">
                        Case Comments <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <textarea
                        className="input textarea"
                        value={caseComments}
                        onChange={(e) => setCaseComments(e.target.value)}
                        placeholder="Document your investigation findings..."
                    />
                </div>

                {/* Actions */}
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
                        onClick={saveDraft}
                        className="btn btn-secondary"
                        disabled={saving}
                    >
                        <Save size={18} />
                        Save Draft
                    </button>
                    <button
                        onClick={submitInvestigation}
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div>
                                Submitting...
                            </>
                        ) : (
                            "Submit for Review"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
