import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';



export default async function getTaskCountForLead(leadId) {
    const client = b24.instance;

    const response = await client.callMethod('tasks.task.list', { 
        filter: { 
            'UF_CRM_TASK': `L_${leadId}`
        }
    });

    if(!response){
        console.error(`No response received from Bitrix24 API for lead ID ${leadId} for counting tasks.`);
    }

    if(response._data.error){
        console.error(`Error response from Bitrix24 API for lead ID ${leadId} for counting tasks:`, response._data);
    }

    console.log("successfully retrieved task count for lead:", leadId, "Count:", response?._data?.result?.tasks?.length || 0);

    return response?._data?.result?.tasks?.length || 0;
}

