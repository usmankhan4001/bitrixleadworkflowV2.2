import type { Request, Response } from "express";

import getCommentText from "../Bitrix24Helper/getCommentText.js";
import getDepartmentByUserId, { type DepartmentName } from "../Constants/SalesTeam.js";
import { addUserToCompleted, getFirstCompletedUser } from "../Bitrix24Helper/handlePersonsWithCompletedTask.js";
import createTask from "../Bitrix24Helper/createTaskForSalesPerson.js";
import getTaskInfo from "../Bitrix24Helper/getTaskInfo.js";
import getTaskCountForLead from "../Bitrix24Helper/getTaskCountForLead.js";
import updateResponsiblePerson from "../Bitrix24Helper/updateResponsiblePerson.js";
import createTaskForWorkflowManager from "../Bitrix24Helper/createTaskForWorkflowManager.js";
import { setResponsible } from "../Bitrix24Helper/handleOldValueOfResponsiblePerson.js";
import changeTheStageOfLead from "../Bitrix24Helper/changeTheStageOfLead.js";

type TaskCommentWebhookBody = {
    data?: {
        FIELDS_AFTER?: {
            ID?: string | number;
            TASK_ID?: string | number;
        };
    };
};

type TaskDetails = {
    deadline?: string;
    responsibleId?: string | number;
    title?: string;
    ufCrmTask?: string | string[];
};

function extractCrmEntityId(relatedEntity: string | string[]): string | null {
    const rawValue = Array.isArray(relatedEntity) ? relatedEntity[0] : relatedEntity;
    const crmEntityId = String(rawValue).split("_")[1];
    return crmEntityId || null;
}

export default async function taskCommentAddController(
    req: Request<unknown, unknown, TaskCommentWebhookBody>,
    res: Response
): Promise<Response> {
    console.log("--- TaskCommentAddController Initiated ---");

    const workflowManager = process.env.WORKFLOW_MANAGER || "1";
    const commentId = req.body?.data?.FIELDS_AFTER?.ID;
    const taskId = req.body?.data?.FIELDS_AFTER?.TASK_ID;

    if (!commentId || !taskId) {
        return res.status(200).send({ message: "Missing task comment payload. No action taken." });
    }

    console.log(`Webhook received for Task ID: ${taskId}, Comment ID: ${commentId}`);

    try {
        console.log(`Fetching task info for TASK_ID: ${taskId}`);
        const taskRelatedInfo = await getTaskInfo(taskId) as unknown as { _data?: { result?: { tasks?: TaskDetails[] } } };
        const taskDetails = taskRelatedInfo?._data?.result?.tasks?.[0];

        if (!taskDetails) {
            console.error(`ERROR: Could not retrieve task details for TASK_ID: ${taskId}`);
            return res.status(200).send({ message: "Could not retrieve task details." });
        }

        console.log("Retrieved Task Details:", taskDetails);
        console.log(`Task Deadline: ${taskDetails.deadline}`);

        const responsibleId = taskDetails.responsibleId;
        const taskTitle = taskDetails.title || "";
        const relatedEntity = taskDetails.ufCrmTask;

        if (!responsibleId) {
            return res.status(200).send({ message: "Task responsible user is missing. No action taken." });
        }

        const department = getDepartmentByUserId(responsibleId);
        console.log(`Responsible User's Department (for assignment index management): ${department}`);

        const commentText = String(await getCommentText(Number(taskId), Number(commentId)));
        console.log("Retrieved comment text:", commentText);

        if (!relatedEntity) {
            console.log(`No action needed for NON-CRM related task ${taskId}. Exiting.`);
            return res.status(200).send({ message: "No action needed for NON-CRM related tasks." });
        }

        const crmEntityId = extractCrmEntityId(relatedEntity);
        if (!crmEntityId) {
            return res.status(200).send({ message: "Could not resolve CRM entity from task." });
        }

        console.log(`Task ${taskId} is CRM-related. Entity: ${relatedEntity}`);

        if (commentText === "Task closed." && taskTitle.includes("Follow up on Lead")) {
            if (department) {
                console.log(`Comment indicates task ${taskId} is closed. Adding user ${responsibleId} to completed list for department: ${department}`);
                await addUserToCompleted(department, responsibleId);
            }

            await changeTheStageOfLead(crmEntityId, "IN_PROCESS");
        } else if (commentText.includes("Task is overdue.")) {
            console.warn(`Comment indicates task ${taskId} is overdue. Initiating reassignment.`);

            const taskCountForLead = await getTaskCountForLead(crmEntityId) as number;
            const userWithCompletedTask = department
                ? await getFirstCompletedUser(department as DepartmentName)
                : null;

            if (userWithCompletedTask && taskCountForLead < 2) {
                console.log(`Found next available user for assignment in ${department}: ${userWithCompletedTask}.`);

                await updateResponsiblePerson(crmEntityId, userWithCompletedTask);
                await createTask(crmEntityId, userWithCompletedTask);
                await setResponsible(crmEntityId, userWithCompletedTask);
            } else {
                await updateResponsiblePerson(crmEntityId, workflowManager);
                await createTaskForWorkflowManager(crmEntityId, workflowManager);
                await setResponsible(crmEntityId, workflowManager);

                console.log(`No available users in ${department} for reassignment or lead has 2+ tasks. Lead ${crmEntityId} reassigned to Workflow Manager ${workflowManager} for manual handling.`);
            }
        } else {
            console.log(`Comment text "${commentText}" is not 'Task closed.' or 'Task is overdue.'. No further action taken.`);
        }
    } catch (error) {
        console.error(`FATAL ERROR in TaskCommentAddController for TASK_ID ${taskId}:`, error);
        return res.status(200).send({ message: "Task comment received, but processing failed." });
    }

    console.log(`--- TaskCommentAddController Finished for TASK_ID ${taskId}. Sending 200 OK. ---`);
    return res.status(200).send({ message: "Task comment received." });
}
