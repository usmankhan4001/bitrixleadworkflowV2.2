import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';

export default async function updateResponsiblePerson(leadId, newResponsibleId) {
    try {
        const client = b24.instance;

        const response = await client.callMethod('crm.lead.update', {
            id: leadId,
            fields: {
                ASSIGNED_BY_ID: newResponsibleId
            }
        });

        const data = response?._data;

        if (!data) {
            throw new Error('No response data received from Bitrix24 API.');
        }

        if (data.error) {
            console.error(`Error updating lead ${leadId} responsible person to ${newResponsibleId}:`, data);
            throw new Error(`Failed to update lead responsible person: ${data.error_description}`);
        }

        // success
        console.log(`Successfully updated lead ${leadId} responsible person to ${newResponsibleId}.`);
        return data.result;

    } catch (err) {
        console.error(`Exception in updateResponsiblePerson for lead ${leadId}:`, err.message);
        throw err;
    }
}
