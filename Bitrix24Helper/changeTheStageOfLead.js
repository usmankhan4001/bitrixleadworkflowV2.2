import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';

export default async function changeTheStageOfLead(leadId, newStageId){

    const client = b24.instance;

    const response = await client.callMethod('crm.lead.update', {id: leadId, fields: {STATUS_ID: newStageId} })


    if(response._data.result){
        console.log(`Lead ${leadId} stage changed to ${newStageId} successfully.`);
    }

    if(response._data.error){
        console.error(`Error changing stage of lead ${leadId}:`, response._data.error_description);
    }

}