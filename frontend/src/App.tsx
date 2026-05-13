import { AlertTriangle, Check, Plus, RefreshCcw, Save, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

type EntityId = string | number;

type WorkflowTeam = {
    name: string;
    memberIds: EntityId[];
};

type SourceRoute = {
    sourceIds: string[];
    department: string;
};

type WorkflowConfigView = {
    teams: WorkflowTeam[];
    sourceRouting: {
        excludedSourceIds: string[];
        routes: SourceRoute[];
        defaultDepartment: string;
    };
    deadlines: {
        sales: string;
        workflowManager: string;
    };
    workflowManagerId: EntityId;
    roundRobinIndices: Record<string, number>;
};

type AdminAccess = {
    allowed: boolean;
    userId: string | null;
    isBitrixAdmin: boolean;
    isOverrideAdmin: boolean;
};

type ActiveTab = "teams" | "routing" | "sla" | "rotation";

const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: "teams", label: "Teams" },
    { id: "routing", label: "Routing" },
    { id: "sla", label: "SLA" },
    { id: "rotation", label: "Rotation" },
];

function joinList(values: EntityId[] | string[]): string {
    return values.join(", ");
}

function splitList(value: string): string[] {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseMemberIds(value: string): EntityId[] {
    return splitList(value).map((item) => (/^\d+$/.test(item) ? Number(item) : item));
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
        throw new Error(data.message || response.statusText);
    }

    return response.json() as Promise<T>;
}

export default function App() {
    const [activeTab, setActiveTab] = useState<ActiveTab>("teams");
    const [access, setAccess] = useState<AdminAccess | null>(null);
    const [config, setConfig] = useState<WorkflowConfigView | null>(null);
    const [status, setStatus] = useState<string>("Loading");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const adminAccess = await requestJson<AdminAccess>("/api/admin/me");
                setAccess(adminAccess);
                const workflowConfig = await requestJson<WorkflowConfigView>("/api/admin/workflow-config");
                setConfig(workflowConfig);
                setStatus("Ready");
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Unable to load app");
                setStatus("Blocked");
            }
        }

        void load();
    }, []);

    async function saveConfig() {
        if (!config) {
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const savedConfig = await requestJson<WorkflowConfigView>("/api/admin/workflow-config", {
                method: "PUT",
                body: JSON.stringify({
                    teams: config.teams,
                    sourceRouting: config.sourceRouting,
                    deadlines: config.deadlines,
                    workflowManagerId: config.workflowManagerId,
                }),
            });
            setConfig(savedConfig);
            setStatus("Saved");
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Unable to save config");
            setStatus("Needs attention");
        } finally {
            setSaving(false);
        }
    }

    async function resetRotation() {
        if (!config) {
            return;
        }

        const roundRobinIndices = Object.fromEntries(config.teams.map((team) => [team.name, 0]));
        const savedConfig = await requestJson<WorkflowConfigView>("/api/admin/workflow-config/indices", {
            method: "PUT",
            body: JSON.stringify({ roundRobinIndices }),
        });
        setConfig(savedConfig);
        setStatus("Rotation reset");
    }

    if (!config) {
        return (
            <main className="shell">
                <section className="empty-state">
                    <AlertTriangle aria-hidden="true" />
                    <h1>Bitrix24 Lead Workflow</h1>
                    <p>{error ?? status}</p>
                </section>
            </main>
        );
    }

    return (
        <main className="shell">
            <header className="topbar">
                <div>
                    <p className="eyebrow">Bitrix24 CRM</p>
                    <h1>Lead Workflow</h1>
                </div>
                <div className="status-row">
                    <span className="access-pill">
                        <ShieldCheck size={16} aria-hidden="true" />
                        {access?.isBitrixAdmin ? "Administrator" : "Override admin"}
                    </span>
                    <span className="status-pill">{status}</span>
                    <button className="primary-action" type="button" onClick={saveConfig} disabled={saving}>
                        <Save size={16} aria-hidden="true" />
                        Save
                    </button>
                </div>
            </header>

            {error ? <div className="notice"><AlertTriangle size={16} aria-hidden="true" />{error}</div> : null}

            <nav className="tabs" aria-label="Workflow settings">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={activeTab === tab.id ? "tab active" : "tab"}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {activeTab === "teams" ? <TeamsPanel config={config} setConfig={setConfig} /> : null}
            {activeTab === "routing" ? <RoutingPanel config={config} setConfig={setConfig} /> : null}
            {activeTab === "sla" ? <SlaPanel config={config} setConfig={setConfig} /> : null}
            {activeTab === "rotation" ? <RotationPanel config={config} setConfig={setConfig} resetRotation={resetRotation} /> : null}
        </main>
    );
}

function TeamsPanel({ config, setConfig }: { config: WorkflowConfigView; setConfig: (config: WorkflowConfigView) => void }) {
    function updateTeam(index: number, nextTeam: WorkflowTeam) {
        const teams = config.teams.map((team, teamIndex) => (teamIndex === index ? nextTeam : team));
        setConfig({ ...config, teams });
    }

    return (
        <section className="panel-grid">
            {config.teams.map((team, index) => (
                <article className="work-card" key={`${team.name}-${index}`}>
                    <div className="card-head">
                        <UsersRound size={18} aria-hidden="true" />
                        <input
                            aria-label="Team name"
                            value={team.name}
                            onChange={(event) => updateTeam(index, { ...team, name: event.target.value })}
                        />
                    </div>
                    <label>
                        User IDs
                        <textarea
                            value={joinList(team.memberIds)}
                            onChange={(event) => updateTeam(index, { ...team, memberIds: parseMemberIds(event.target.value) })}
                        />
                    </label>
                    <button
                        className="ghost-action"
                        type="button"
                        onClick={() => setConfig({ ...config, teams: config.teams.filter((_, teamIndex) => teamIndex !== index) })}
                    >
                        <Trash2 size={16} aria-hidden="true" />
                        Remove
                    </button>
                </article>
            ))}
            <button
                className="add-card"
                type="button"
                onClick={() => setConfig({
                    ...config,
                    teams: [...config.teams, { name: "New Team", memberIds: [] }],
                })}
            >
                <Plus size={18} aria-hidden="true" />
                Add Team
            </button>
        </section>
    );
}

function RoutingPanel({ config, setConfig }: { config: WorkflowConfigView; setConfig: (config: WorkflowConfigView) => void }) {
    function updateRoute(index: number, nextRoute: SourceRoute) {
        const routes = config.sourceRouting.routes.map((route, routeIndex) => (routeIndex === index ? nextRoute : route));
        setConfig({ ...config, sourceRouting: { ...config.sourceRouting, routes } });
    }

    return (
        <section className="settings-stack">
            <div className="field-row">
                <label>
                    Excluded sources
                    <input
                        value={joinList(config.sourceRouting.excludedSourceIds)}
                        onChange={(event) => setConfig({
                            ...config,
                            sourceRouting: {
                                ...config.sourceRouting,
                                excludedSourceIds: splitList(event.target.value),
                            },
                        })}
                    />
                </label>
                <label>
                    Default queue
                    <select
                        value={config.sourceRouting.defaultDepartment}
                        onChange={(event) => setConfig({
                            ...config,
                            sourceRouting: {
                                ...config.sourceRouting,
                                defaultDepartment: event.target.value,
                            },
                        })}
                    >
                        {config.teams.map((team) => <option key={team.name} value={team.name}>{team.name}</option>)}
                    </select>
                </label>
            </div>

            {config.sourceRouting.routes.map((route, index) => (
                <article className="route-row" key={`${route.department}-${index}`}>
                    <label>
                        Source IDs
                        <input
                            value={joinList(route.sourceIds)}
                            onChange={(event) => updateRoute(index, { ...route, sourceIds: splitList(event.target.value) })}
                        />
                    </label>
                    <label>
                        Queue
                        <select
                            value={route.department}
                            onChange={(event) => updateRoute(index, { ...route, department: event.target.value })}
                        >
                            {config.teams.map((team) => <option key={team.name} value={team.name}>{team.name}</option>)}
                        </select>
                    </label>
                    <button
                        className="icon-action"
                        type="button"
                        aria-label="Remove route"
                        title="Remove route"
                        onClick={() => setConfig({
                            ...config,
                            sourceRouting: {
                                ...config.sourceRouting,
                                routes: config.sourceRouting.routes.filter((_, routeIndex) => routeIndex !== index),
                            },
                        })}
                    >
                        <Trash2 size={16} aria-hidden="true" />
                    </button>
                </article>
            ))}

            <button
                className="secondary-action"
                type="button"
                onClick={() => setConfig({
                    ...config,
                    sourceRouting: {
                        ...config.sourceRouting,
                        routes: [...config.sourceRouting.routes, { sourceIds: [], department: config.sourceRouting.defaultDepartment }],
                    },
                })}
            >
                <Plus size={16} aria-hidden="true" />
                Add Route
            </button>
        </section>
    );
}

function SlaPanel({ config, setConfig }: { config: WorkflowConfigView; setConfig: (config: WorkflowConfigView) => void }) {
    return (
        <section className="settings-stack narrow">
            <label>
                Sales task deadline
                <input
                    value={config.deadlines.sales}
                    onChange={(event) => setConfig({ ...config, deadlines: { ...config.deadlines, sales: event.target.value } })}
                />
            </label>
            <label>
                Manager task deadline
                <input
                    value={config.deadlines.workflowManager}
                    onChange={(event) => setConfig({ ...config, deadlines: { ...config.deadlines, workflowManager: event.target.value } })}
                />
            </label>
            <label>
                Workflow manager user ID
                <input
                    value={String(config.workflowManagerId)}
                    onChange={(event) => setConfig({ ...config, workflowManagerId: event.target.value })}
                />
            </label>
        </section>
    );
}

function RotationPanel({
    config,
    setConfig,
    resetRotation,
}: {
    config: WorkflowConfigView;
    setConfig: (config: WorkflowConfigView) => void;
    resetRotation: () => Promise<void>;
}) {
    return (
        <section className="settings-stack narrow">
            {config.teams.map((team) => (
                <label key={team.name}>
                    {team.name}
                    <input
                        type="number"
                        min={0}
                        value={config.roundRobinIndices[team.name] ?? 0}
                        onChange={(event) => setConfig({
                            ...config,
                            roundRobinIndices: {
                                ...config.roundRobinIndices,
                                [team.name]: Number(event.target.value),
                            },
                        })}
                    />
                </label>
            ))}
            <button className="secondary-action" type="button" onClick={() => void resetRotation()}>
                <RefreshCcw size={16} aria-hidden="true" />
                Reset
            </button>
            <div className="success-strip">
                <Check size={16} aria-hidden="true" />
                {config.teams.length} active queues
            </div>
        </section>
    );
}
