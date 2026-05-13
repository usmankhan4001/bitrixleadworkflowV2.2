import { b24 } from '../Bitrix24AuthUtils/Bitrix24AuthUtils.js';
import moment from 'moment-timezone'; 


const DEADLINE_DURATION_STRING = process.env.LEAD_DEADLINE_DURATION || "1 hour"; 

// --- Business Hours Configuration ---
const BUSINESS_START_HOUR = 10;
const BUSINESS_END_HOUR = 18;
const TARGET_TIMEZONE_OFFSET = 3; // UTC+3

export default async function createTask(leadId, userid) {
    const client = b24.instance;

    // console.log("deadline duration string:", DEADLINE_DURATION_STRING);

    //get the lead title using the lead id:
    const responseOfLeadGet =  await client.callMethod('crm.lead.get', {ID: leadId});

    const leadData = responseOfLeadGet._data.result;

    const leadTitle = leadData.TITLE;

    // get the user name using the user id: 
    const responseOfUserGet = await client.callMethod('user.get', {ID: userid});

    // console.log("User Get Response:", responseOfUserGet);

    const data = responseOfUserGet._data.result[0];

    const {NAME, LAST_NAME} = data;

    const title = `${NAME} ${LAST_NAME} Follow up on Lead ${leadTitle}`
    const taskDescription = 
            `Please reach out to the customer for the lead "${leadTitle}" ` +
            `and update the CRM.\n You have ${DEADLINE_DURATION_STRING} to make contact.\n`

    const [amount, unit] = DEADLINE_DURATION_STRING.split(' ');

    // --- Business Hours Logic ---
    // 1. Get Current Time in Target Zone
    const nowInTarget = moment().utc().add(TARGET_TIMEZONE_OFFSET, 'hours');

    let deadlineBase;
    const currentHour = nowInTarget.hour();

    if (currentHour < BUSINESS_START_HOUR) {
        // Before Start -> Start counting from Today 10 AM
        deadlineBase = nowInTarget.clone().hour(BUSINESS_START_HOUR).minute(0).second(0);
    } else if (currentHour >= BUSINESS_END_HOUR) {
        // After End -> Start counting from Tomorrow 10 AM
        deadlineBase = nowInTarget.clone().add(1, 'days').hour(BUSINESS_START_HOUR).minute(0).second(0);
    } else {
        // During Business Hours -> Start counting from NOW
        deadlineBase = nowInTarget.clone();
    }

    // Apply Duration
    const deadlineTime = deadlineBase.add(parseInt(amount), unit).format("YYYY-MM-DDTHH:mm:ss");

    // console.log("Calculated deadline time:", deadlineTime);

    const taskData = {
        fields: {
            TITLE: title,
            DESCRIPTION: taskDescription,
            DEADLINE: deadlineTime,
            CREATED_BY: parseInt(userid),
            RESPONSIBLE_ID: parseInt(userid), 
            UF_CRM_TASK: [`L_${leadId}`], 
            ALLOW_CHANGE_DEADLINE: 'N', 
        }
    }

    const createTaskResponse = await client.callMethod('tasks.task.add', taskData);


}
