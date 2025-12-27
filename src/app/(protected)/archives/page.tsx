"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Archive, Search, Eye } from "lucide-react";
import { formatDate } from "@/lib/date-utils";

interface Incident {
    incident_id: string;
    complainant_id: string;
    date_time_of_incident: string;
    reported_on: string;
    status: "Open" | "Closed";
}

export default function ArchivesPage() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

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



    const filteredIncidents = incidents.filter((i) =>
        searchQuery
            ? i.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.complainant_id.toLowerCase().includes(searchQuery.toLowerCase())
            : true
    );

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

            {/* Table - Always show structure */}
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
                            <tr>
                                <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                                    <div className="spinner" style={{ margin: "0 auto" }}></div>
                                </td>
                            </tr>
                        ) : filteredIncidents.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                                    <Archive size={32} style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem" }} />
                                    <p style={{ fontWeight: "500" }}>No archived incidents</p>
                                    <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                                        {searchQuery ? "No incidents match your search." : "Closed incidents will appear here."}
                                    </p>
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
                                        <Link href={`/investigation-hub/${incident.incident_id}`} className="btn btn-ghost" style={{ padding: "0.375rem 0.5rem" }}>
                                            <Eye size={16} />
                                        </Link>
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
