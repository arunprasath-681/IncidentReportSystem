"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/date-utils";

interface Incident {
    incident_id: string;
    complainant_id: string;
    date_time_of_incident: string;
    reported_on: string;
    status: "Open" | "Closed";
}

export default function InvestigationHubView() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "Open" | "Closed">("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchIncidents();
    }, []);

    async function fetchIncidents() {
        try {
            const res = await fetch("/api/incidents");
            const data = await res.json();
            setIncidents(data.incidents || []);
        } catch (error) {
            console.error("Error fetching incidents:", error);
        } finally {
            setLoading(false);
        }
    }

    const filteredIncidents = incidents
        .filter((i) => (filter === "all" ? true : i.status === filter))
        .filter((i) =>
            searchQuery
                ? i.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.complainant_id.toLowerCase().includes(searchQuery.toLowerCase())
                : true
        );

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Investigation Hub</h1>
                    <p style={{ color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
                        View and investigate all reported incidents
                    </p>
                </div>
            </div>

            {/* Search and Filters */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
                    <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
                    <input
                        type="text"
                        className="input"
                        style={{ paddingLeft: "2.25rem" }}
                        placeholder="Search by ID or complainant..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="tabs" style={{ width: "fit-content", marginBottom: 0 }}>
                    <button className={`tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                    <button className={`tab ${filter === "Open" ? "active" : ""}`} onClick={() => setFilter("Open")}>Open</button>
                    <button className={`tab ${filter === "Closed" ? "active" : ""}`} onClick={() => setFilter("Closed")}>Closed</button>
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
                                <td colSpan={6} style={{ padding: "2rem" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                        <Search size={32} style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem" }} />
                                        <p style={{ fontWeight: "500" }}>No incidents found</p>
                                        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                                            {searchQuery ? "Try adjusting your search query." : "No incidents match your filters."}
                                        </p>
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
                                    <td>
                                        <span className={`badge ${incident.status === "Open" ? "badge-open" : "badge-closed"}`}>
                                            {incident.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <Link href={`/investigation-hub/${incident.incident_id}`} className="btn btn-ghost" style={{ padding: "0.375rem 0.5rem" }} title="View">
                                                <ArrowRight size={16} />
                                            </Link>
                                        </div>
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
