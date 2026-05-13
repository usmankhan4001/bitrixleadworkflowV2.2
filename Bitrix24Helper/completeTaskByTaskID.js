import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';

export default async function completeTaskByTaskID(taskId) {
    const client = b24.instance;

    try {
        const response = await client.callMethod('tasks.task.complete', {
            taskId: taskId
        })}
           
    catch (err) {
        console.error(`Error completing task ${taskId}:`, err);
    }

}
