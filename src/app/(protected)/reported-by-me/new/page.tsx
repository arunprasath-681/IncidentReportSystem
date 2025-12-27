"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Search } from "lucide-react";
import Link from "next/link";

interface UserResult {
    email: string;
    name: string;
    type: "student" | "staff";
}

interface ReportedIndividual {
    email: string;
    name?: string;
}

export default function NewIncidentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Form state
    const [dateTimeOfIncident, setDateTimeOfIncident] = useState("");
    const [description, setDescription] = useState("");
    const [reportedIndividuals, setReportedIndividuals] = useState<
        ReportedIndividual[]
    >([]);
    const [relayedFromCompany, setRelayedFromCompany] = useState(false);
    const [companyName, setCompanyName] = useState("");
    const [companyNotes, setCompanyNotes] = useState("");

    // User search
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [searching, setSearching] = useState(false);

    const searchUsers = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await fetch(`/api/users/lookup?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data.users || []);
        } catch (err) {
            console.error("Error searching users:", err);
        } finally {
            setSearching(false);
        }
    }, []);


    useEffect(() => {
        const debounce = setTimeout(() => {
            searchUsers(searchQuery);
        }, 300);

        return () => clearTimeout(debounce);
    }, [searchQuery, searchUsers]);

    function addReportedIndividual(user: UserResult) {
        if (!reportedIndividuals.find((r) => r.email === user.email)) {
            setReportedIndividuals([
                ...reportedIndividuals,
                { email: user.email, name: user.name },
            ]);
        }
        setSearchQuery("");
        setSearchResults([]);
    }

    function removeReportedIndividual(email: string) {
        setReportedIndividuals(reportedIndividuals.filter((r) => r.email !== email));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        // Validation
        if (!dateTimeOfIncident) {
            setError("Please select the date and time of incident");
            return;
        }

        if (new Date(dateTimeOfIncident) > new Date()) {
            setError("Date of incident cannot be in the future");
            return;
        }

        if (!description || description.length < 10) {
            setError("Please provide a detailed description (at least 10 characters)");
            return;
        }

        if (reportedIndividuals.length === 0) {
            setError("Please add at least one reported individual");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/incidents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dateTimeOfIncident,
                    description,
                    reportedIndividuals: reportedIndividuals.map((r) => ({
                        email: r.email,
                    })),
                    relayedFromCompany,
                    companyName: relayedFromCompany ? companyName : undefined,
                    companyNotes: relayedFromCompany ? companyNotes : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create incident");
            }

            router.push("/reported-by-me");
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div style={{ marginBottom: "1.5rem" }}>
                <Link
                    href="/reported-by-me"
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
                    Back to Reports
                </Link>
                <h1 className="page-title">Report New Incident</h1>
                <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                    Submit details about a code of conduct breach
                </p>
            </div>

            <form onSubmit={handleSubmit}>
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

                    {/* Date and Time */}
                    <div className="form-group">
                        <label className="label">
                            Date and Time of Incident <span style={{ color: "var(--destructive)" }}>*</span>
                        </label>
                        <input
                            type="datetime-local"
                            className="input"
                            value={dateTimeOfIncident}
                            onChange={(e) => setDateTimeOfIncident(e.target.value)}
                            max={new Date().toISOString().slice(0, 16)}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="form-group">
                        <label className="label">
                            Description <span style={{ color: "var(--destructive)" }}>*</span>
                        </label>
                        <textarea
                            className="input textarea"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Provide a detailed description of the incident..."
                            required
                        />
                        <p
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--muted-foreground)",
                                marginTop: "0.25rem",
                            }}
                        >
                            Be specific about what happened, when, and who was involved.
                        </p>
                    </div>

                    {/* Reported Individuals */}
                    <div className="form-group">
                        <label className="label">
                            Reported Individuals <span style={{ color: "var(--destructive)" }}>*</span>
                        </label>

                        {/* Search */}
                        <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                            <Search
                                size={16}
                                style={{
                                    position: "absolute",
                                    left: "0.75rem",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--muted-foreground)",
                                }}
                            />
                            <input
                                type="text"
                                className="input"
                                style={{ paddingLeft: "2.25rem" }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or email..."
                            />

                            {/* Search Results */}
                            {(searchResults.length > 0 || searching) && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: 0,
                                        right: 0,
                                        backgroundColor: "var(--card)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "var(--radius)",
                                        marginTop: "0.25rem",
                                        maxHeight: "200px",
                                        overflow: "auto",
                                        zIndex: 10,
                                    }}
                                >
                                    {searching ? (
                                        <div style={{ padding: "1rem", textAlign: "center" }}>
                                            <div className="spinner" style={{ margin: "0 auto" }}></div>
                                        </div>
                                    ) : (
                                        searchResults.map((user) => (
                                            <button
                                                key={user.email}
                                                type="button"
                                                onClick={() => addReportedIndividual(user)}
                                                style={{
                                                    width: "100%",
                                                    padding: "0.75rem",
                                                    textAlign: "left",
                                                    border: "none",
                                                    background: "none",
                                                    cursor: "pointer",
                                                    borderBottom: "1px solid var(--border)",
                                                }}
                                                onMouseEnter={(e) =>
                                                    (e.currentTarget.style.backgroundColor = "var(--muted)")
                                                }
                                                onMouseLeave={(e) =>
                                                    (e.currentTarget.style.backgroundColor = "transparent")
                                                }
                                            >
                                                <div style={{ fontWeight: "500" }}>{user.name}</div>
                                                <div
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        color: "var(--muted-foreground)",
                                                    }}
                                                >
                                                    {user.email} • {user.type}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Individuals */}
                        {reportedIndividuals.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                {reportedIndividuals.map((individual) => (
                                    <div
                                        key={individual.email}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            padding: "0.375rem 0.75rem",
                                            backgroundColor: "var(--secondary)",
                                            borderRadius: "var(--radius)",
                                            fontSize: "0.875rem",
                                        }}
                                    >
                                        <span>{individual.name || individual.email}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeReportedIndividual(individual.email)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                padding: 0,
                                                display: "flex",
                                            }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Company Relay */}
                    <div className="form-group">
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={relayedFromCompany}
                                onChange={(e) => setRelayedFromCompany(e.target.checked)}
                            />
                            <span className="label" style={{ margin: 0 }}>
                                Relayed from Company
                            </span>
                        </label>
                        <p
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--muted-foreground)",
                                marginTop: "0.25rem",
                            }}
                        >
                            Check this if the incident was reported by an internship company.
                        </p>
                    </div>

                    {relayedFromCompany && (
                        <>
                            <div className="form-group">
                                <label className="label">Company Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Enter company name"
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Additional Notes</label>
                                <textarea
                                    className="input textarea"
                                    value={companyNotes}
                                    onChange={(e) => setCompanyNotes(e.target.value)}
                                    placeholder="Any additional notes from the company..."
                                    style={{ minHeight: "80px" }}
                                />
                            </div>
                        </>
                    )}

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
                        <Link href="/reported-by-me" className="btn btn-secondary">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: "1rem", height: "1rem" }}></div>
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Plus size={18} />
                                    Submit Report
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
