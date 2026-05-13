import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';

export default async function getMoreLeadData(leadId) {
    const client = b24.instance;

    const leaddata = await client.callMethod('crm.lead.get', { ID: leadId });

    // console.log("Fetched additional lead data:", leaddata._data.result);

    return leaddata._data.result;

}
