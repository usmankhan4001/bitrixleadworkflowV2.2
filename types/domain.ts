export type EntityId = string | number;

export type WorkflowStateRecord<TValue> = Record<string, TValue>;

export type WorkflowAssignmentDepartment = "Sales Executives" | "Telly Sales";

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
