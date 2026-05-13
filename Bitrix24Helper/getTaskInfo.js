import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';

export default async function getTaskInfo(taskId) {
    const client = b24.instance;
    
    const response = await client.callMethod('tasks.task.list', { 
        filter: { ID: taskId },
        select: [
            'ID',
            'TITLE',
            'RESPONSIBLE_ID',
            'DEADLINE',
            'UF_CRM_TASK'
        ]
    });


    // console.log("getTaskInfo response:", response);


    // tasks.task.list returns an array, so get the first item
    return response
}