import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';

export default async function getTaskIdOfTheWFManager(leadId) {
    const client = b24.instance;

    try {
        // Get all tasks associated with the lead
        const response = await client.callMethod('tasks.task.list', {
            filter: { 'UF_CRM_TASK': `L_${leadId}` }, // Bitrix uses L_{LEAD_ID} in UF_CRM_TASK
            select: [
                'ID',
                'TITLE',
                'RESPONSIBLE_ID',
                'DEADLINE',
                'UF_CRM_TASK'
            ]
        });

        if (!response || !response._data || !response._data.result || !response._data.result.tasks) {
            console.log(`No tasks found for lead ${leadId}`);
            return [];
        }

        // Filter tasks whose title includes "Look into the Lead"
        const filteredTaskIds = response._data.result.tasks
            .filter(task => task.title && task.title.includes("Look into the Lead"))
            .map(task => task.id);

        return filteredTaskIds;

    } catch (err) {
        console.error(`Error fetching tasks for lead ${leadId}:`, err);
        return [];
    }
}
