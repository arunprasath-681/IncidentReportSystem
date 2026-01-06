"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Archive, Search, Eye, X, AlertCircle, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { type Case } from "@/lib/sheets/cases";

interface Incident {
    incident_id: string;
    description: string;
    complainant_id: string;
    date_time_of_incident: string;
    reported_on: string;
    attachments: string;
    status: "Open" | "Closed";
}

export default function ArchivesPage() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal State
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
    const [modalData, setModalData] = useState<{ incident: Incident, cases: Case[] } | null>(null);
    const [loadingModal, setLoadingModal] = useState(false);
    const [activeCaseTab, setActiveCaseTab] = useState<string>("");

    useEffect(() => {
        fetchIncidents();
    }, []);

    async function fetchIncidents() {
        try {
            const res = await fetch("/api/incidents?status=Closed");
            const data = await res.json();
            setIncidents(data.incidents || []);
        } catch (error) {
            console.error("Error fetching incidents:", error);
        } finally {
            setLoading(false);
        }
    }

    async function openIncidentModal(id: string) {
        setSelectedIncidentId(id);
        setLoadingModal(true);
        try {
            const res = await fetch(`/api/incidents/${id}`);
            if (res.ok) {
                const data = await res.json();
                setModalData(data);
                if (data.cases && data.cases.length > 0) {
                    setActiveCaseTab(data.cases[0].case_id);
                }
            }
        } catch (error) {
            console.error("Error fetching incident details:", error);
        } finally {
            setLoadingModal(false);
        }
    }

    function closeModal() {
        setSelectedIncidentId(null);
        setModalData(null);
    }

    const filteredIncidents = incidents.filter((i) =>
        searchQuery
            ? i.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.complainant_id.toLowerCase().includes(searchQuery.toLowerCase())
            : true
    );

    function getIncidentAttachments(json: string | undefined): string[] {
        if (!json) return [];
        try {
            const parsed = JSON.parse(json);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    const activeCase = modalData?.cases.find(c => c.case_id === activeCaseTab);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Archives</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        View all closed incidents and their resolutions
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
                        placeholder="Search archived incidents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <Archive size={24} style={{ color: "var(--success)" }} />
                    <div>
                        <p style={{ fontSize: "1.5rem", fontWeight: "600" }}>{loading ? "-" : incidents.length}</p>
                        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Total Archived Incidents</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: "300px" }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Incident ID</th>
                            <th>Complainant</th>
                            <th>Date of Incident</th>
                            <th>Reported On</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}><div className="spinner" style={{ margin: "0 auto" }}></div></td></tr>
                        ) : filteredIncidents.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: "2rem" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                        <Archive size={32} style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem" }} />
                                        <p style={{ fontWeight: "500" }}>No archived incidents</p>
                                        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>{searchQuery ? "No incidents match your search." : "Closed incidents will appear here."}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredIncidents.map((incident) => (
                                <tr key={incident.incident_id}>
                                    <td style={{ fontWeight: "500" }}>{incident.incident_id}</td>
                                    <td>{incident.complainant_id}</td>
                                    <td>{formatDate(incident.date_time_of_incident, "MMM d, yyyy")}</td>
                                    <td>{formatDate(incident.reported_on, "MMM d, yyyy h:mm a")}</td>
                                    <td><span className="badge badge-closed">Closed</span></td>
                                    <td>
                                        <button onClick={() => openIncidentModal(incident.incident_id)} className="btn btn-ghost" style={{ padding: "0.375rem 0.5rem" }}>
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {selectedIncidentId && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "800px", width: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Archived Incident Details</h3>
                            <button onClick={closeModal} className="btn btn-ghost" style={{ padding: "0.25rem" }}><X size={18} /></button>
                        </div>

                        <div className="modal-content" style={{ overflowY: "auto", padding: "1.5rem" }}>
                            {loadingModal ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}><div className="spinner"></div></div>
                            ) : modalData ? (
                                <>
                                    {/* Incident Details Header */}
                                    <div style={{ marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid var(--border)" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                            <div>
                                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Incident ID</span>
                                                <p style={{ fontWeight: "600", fontSize: "1.125rem" }}>{modalData.incident.incident_id}</p>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Incident Date</span>
                                                <p>{formatDate(modalData.incident.date_time_of_incident, "MMM d, yyyy h:mm a")}</p>
                                            </div>
                                        </div>
                                        <div style={{ backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "var(--radius)" }}>
                                            <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>{modalData.incident.description}</p>
                                        </div>
                                        {/* Incident Attachments */}
                                        {getIncidentAttachments(modalData.incident.attachments).length > 0 && (
                                            <div style={{ marginTop: "1rem" }}>
                                                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", fontWeight: "600" }}>ATTACHMENTS</span>
                                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                                                    {getIncidentAttachments(modalData.incident.attachments).map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.5rem", backgroundColor: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.75rem", textDecoration: "none", color: "var(--foreground)" }}>
                                                            <FileText size={12} /> Evidence {i + 1}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Case Tabs */}
                                    <div style={{ marginBottom: "1.5rem" }}>
                                        <h4 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem", color: "var(--muted-foreground)" }}>ASSOCIATED CASES</h4>
                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
                                            {modalData.cases.map(c => (
                                                <button
                                                    key={c.case_id}
                                                    onClick={() => setActiveCaseTab(c.case_id)}
                                                    style={{
                                                        padding: "0.5rem 1rem",
                                                        border: "1px solid transparent",
                                                        borderBottom: activeCaseTab === c.case_id ? "2px solid var(--primary)" : "none",
                                                        backgroundColor: activeCaseTab === c.case_id ? "var(--muted)" : "transparent",
                                                        color: activeCaseTab === c.case_id ? "var(--foreground)" : "var(--muted-foreground)",
                                                        cursor: "pointer",
                                                        fontWeight: "500",
                                                        fontSize: "0.875rem",
                                                        borderTopLeftRadius: "var(--radius)",
                                                        borderTopRightRadius: "var(--radius)"
                                                    }}
                                                >
                                                    {c.case_id}
                                                </button>
                                            ))}
                                            {modalData.cases.length === 0 && <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", padding: "0.5rem" }}>No cases found for this incident.</p>}
                                        </div>
                                    </div>

                                    {/* Timeline for Active Case */}
                                    {activeCase && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                                            {/* Report (Duplicate of incident basically, but part of timeline visual) */}
                                            <TimelineItem
                                                icon={<AlertCircle size={14} />}
                                                title="Incident Reported"
                                                date={modalData.incident.reported_on}
                                                isLast={false}
                                                statusColor="var(--primary)"
                                            >
                                                <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>Case created for {activeCase.reported_individual_id}</p>
                                            </TimelineItem>

                                            {/* Investigation */}
                                            <TimelineItem
                                                icon={<Search size={14} />}
                                                title="Investigation"
                                                isLast={false}
                                                statusColor={activeCase.case_status !== "Pending Investigation" ? "var(--primary)" : "var(--muted)"}
                                            >
                                                <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>Status: <span className="badge badge-open">{activeCase.case_status === "Pending Investigation" ? "In Progress" : "Completed"}</span></p>
                                                {activeCase.investigated_by && <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Investigated by: {activeCase.investigated_by}</p>}
                                                {activeCase.case_comments && (
                                                    <div style={{ marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "var(--muted)", borderRadius: "var(--radius)", fontSize: "0.875rem", fontStyle: "italic" }}>"{activeCase.case_comments}"</div>
                                                )}
                                                {getIncidentAttachments(activeCase.investigator_attachments).length > 0 && (
                                                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                                                        {getIncidentAttachments(activeCase.investigator_attachments).map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}>Evidence {i + 1}</a>
                                                        ))}
                                                    </div>
                                                )}
                                            </TimelineItem>

                                            {/* Verdict */}
                                            {(activeCase.verdict || activeCase.case_status !== "Pending Investigation") && (
                                                <TimelineItem
                                                    icon={<FileText size={14} />}
                                                    title="Verdict"
                                                    isLast={!activeCase.appeal_reason && activeCase.case_status !== "Appealed"}
                                                    statusColor={activeCase.verdict ? "var(--primary)" : "var(--muted)"}
                                                >
                                                    {activeCase.verdict ? (
                                                        <>
                                                            {activeCase.verdict_by && <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>Verdict by: {activeCase.verdict_by}</p>}
                                                            <div style={{ marginTop: "0.5rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                                                                <div style={{ padding: "0.75rem", backgroundColor: activeCase.verdict === "Guilty" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                                                                    <span style={{ fontWeight: "600", color: activeCase.verdict === "Guilty" ? "var(--error)" : "var(--success)" }}>{activeCase.verdict}</span>
                                                                    {activeCase.punishment && <span style={{ fontSize: "0.8rem" }}>{activeCase.punishment}</span>}
                                                                </div>
                                                                <div style={{ padding: "1rem", backgroundColor: "var(--card)", fontSize: "0.875rem" }}>
                                                                    <p><span style={{ color: "var(--muted-foreground)" }}>Category:</span> {activeCase.category_of_offence}</p>
                                                                    <p><span style={{ color: "var(--muted-foreground)" }}>Level:</span> {activeCase.level_of_offence}</p>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Waiting for decision...</p>}
                                                </TimelineItem>
                                            )}

                                            {/* Appeal */}
                                            {(activeCase.appeal_reason || activeCase.case_status === "Appealed" || activeCase.case_status === "Final Decision") && activeCase.appeal_reason && (
                                                <TimelineItem
                                                    icon={<AlertTriangle size={14} />}
                                                    title="Appeal"
                                                    isLast={activeCase.case_status !== "Final Decision"}
                                                    statusColor="var(--warning)"
                                                >
                                                    <div style={{ marginTop: "0.5rem", backgroundColor: "var(--muted)", padding: "1rem", borderRadius: "var(--radius)" }}>
                                                        <p style={{ fontSize: "0.875rem", fontStyle: "italic" }}>"{activeCase.appeal_reason}"</p>
                                                        {getIncidentAttachments(activeCase.appeal_attachments).length > 0 && (
                                                            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                                                                {getIncidentAttachments(activeCase.appeal_attachments).map((url, i) => (
                                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}>Attachment {i + 1}</a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TimelineItem>
                                            )}

                                            {/* Final Decision */}
                                            {activeCase.case_status === "Final Decision" && (
                                                <TimelineItem
                                                    icon={<CheckCircle size={14} />}
                                                    title="Final Decision"
                                                    isLast={true}
                                                    statusColor="var(--success)"
                                                >
                                                    <p style={{ marginTop: "0.25rem", color: "var(--success)", fontWeight: "500" }}>Case Closed</p>
                                                    {activeCase.appeal_resolved_by && <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Resolved by: {activeCase.appeal_resolved_by}</p>}
                                                    {activeCase.review_comments && <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Review: {activeCase.review_comments}</p>}
                                                </TimelineItem>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
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
                    {date && <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{formatDate(date, "MMM d, yyyy")}</span>}
                </div>
                {children}
            </div>
        </div>
    );
}
