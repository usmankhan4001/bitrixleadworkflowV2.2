export type EntityId = string | number;

export type WorkflowStateRecord<TValue> = Record<string, TValue>;

export type WorkflowAssignmentDepartment = string;

export type WorkflowTeam = {
    name: WorkflowAssignmentDepartment;
    memberIds: EntityId[];
};

export type SourceRoute = {
    sourceIds: string[];
    department: WorkflowAssignmentDepartment;
};

export type WorkflowDeadlines = {
    sales: string;
    workflowManager: string;
};

export type WorkflowConfig = {
    teams: WorkflowTeam[];
    sourceRouting: {
        excludedSourceIds: string[];
        routes: SourceRoute[];
        defaultDepartment: WorkflowAssignmentDepartment;
    };
    deadlines: WorkflowDeadlines;
    workflowManagerId: EntityId;
};

export type WorkflowConfigView = WorkflowConfig & {
    roundRobinIndices: WorkflowStateRecord<number>;
};

export type LeadAddWebhookBody = {
    data?: {
        FIELDS?: {
            ID?: EntityId;
        };
    };
};

export type LeadChangeWebhookBody = LeadAddWebhookBody;

export type TaskCommentWebhookBody = {
    data?: {
        FIELDS_AFTER?: {
            ID?: EntityId;
            TASK_ID?: EntityId;
        };
    };
};

export type LeadRoutingDecision =
    | { kind: "skip" }
    | {
        kind: "assign";
        department: WorkflowAssignmentDepartment;
    };

export type OverdueEscalationDecision =
    | {
        kind: "reassign-sales";
        assignedUserId: EntityId;
    }
    | {
        kind: "workflow-manager";
        assignedUserId: EntityId;
    };
