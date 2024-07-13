var has_management_permission = null;
var has_tabs_permission = null;
var has_tabs_hide_permission = null;
var has_notifications_permission = null;
// Evaluates conditions before running
// If ANY of the triggers match, the flow will run with the relevant specifiers.

// If the tab count trigger causes the flow to run, then:
//  - If it triggers when the count is ABOVE a number, and the flow results in tabs being removed (closed/hidden), the relevant number will be closed/hidden until the condition no longer matches
//  - Otherwise, the flow will run as soon as the threshold is crossed, and won't re-run until the conditions no longer match.

// If the schedule condition is used, then the flow will run every cycle, UNLESS the notifications action is sued. In order to avoid spamming the user, this will only run ONCE.
async function EvaluateFlow(id, flow)
{
    for (let condition_id of Object.keys(flow.conditions))
    {
        switch (flow.conditions[condition_id].type)
        {
            case "Tab Count": {
                // Check if we have permission to use the API
                if (!has_tabs_permission)
                {
                    console.warn(`Cannot evaluate tab count condition ${id}/${condition_id} as the tabs permission has not been granted.`); 
                    continue;
                }

                // Checks teh current number of tabs, and the user specified number
                let count = (await browser.tabs.query({hidden: false})).length;
                let threshold = flow.conditions[condition_id].settings["Number of tabs"];

                let should_trigger = false;

                // Different conditions
                switch (flow.conditions[condition_id].settings["Trigger when"])
                {
                    case "Tab count is lower": {
                        if (count < threshold) should_trigger = true;
                        break;
                    }
                    case "Tab count is equal": {
                        if (count == threshold) should_trigger = true;
                        break;
                    }
                    case "Tab count is higher": {
                        if (count > threshold) should_trigger = true;
                        break;
                    }
                    default: {
                        console.warn(`Unknown option '${flow.conditions[condition_id].settings["Trigger when"]}'`)
                    }
                }

                // If the relevant conditions have been matched, and this is the first time we've checked since the conditions have been matched, run the flow.
                if (should_trigger)
                {
                    if (states[`${id}/${condition_id}`] !== true)
                    {
                        if (flow.conditions[condition_id].settings["Trigger when"] == "Tab count is higher")
                        {
                            RunFlow(flow, tabs_to_close_count=count-threshold);
                        }
                        else
                        {
                            RunFlow(flow);
                        }
                        
                    }
                }

                // Otherwise, store that the conditions haven't been matched. This is important so that we now that when the conditions then do match, it will be for the first time.
                else
                {
                    states[`${id}/${condition_id}`] = false;
                }
                break;
            }

            case "Time Of Day": {
                // Gets the specified time
                let h = parseInt(flow.conditions[condition_id].settings["Time"].split(":")[0]);
                let m = parseInt(flow.conditions[condition_id].settings["Time"].split(":")[1]);

                // Gets the current time
                let now = new Date()

                // Checks if the current time is the specified time
                if (h == now.getHours() && m == now.getMinutes())
                {
                    // Checks if it has been run since becomming the specified time 
                    if (states[`${id}/${condition_id}`] !== true)
                    {
                        // If not, records that it now has & runs.
                        states[`${id}/${condition_id}`] = true;
                        RunFlow(flow);
                    }
                }
                else
                {
                    // Otherwise, records that it has not run.
                    states[`${id}/${condition_id}`] = false;
                }
            }

            case "Schedule": {
                // Gets the specified time
                let h1 = parseInt(flow.conditions[condition_id].settings["Start Time"].split(":")[0]);
                let h2 = parseInt(flow.conditions[condition_id].settings["End Time"].split(":")[0]);
                let m1 = parseInt(flow.conditions[condition_id].settings["Start Time"].split(":")[1]);
                let m2 = parseInt(flow.conditions[condition_id].settings["End Time"].split(":")[1]);

                // Gets the current time
                let now = new Date()

                // Checks if the start time has passed
                let is_after_first_time = false;
                if (now.getHours() > h1) is_after_first_time = true;
                else if (now.getHours() == h1 && now.getMinutes() >= m1) is_after_first_time = true;

                // Checks if we are before the end time
                let is_before_second_time = false;
                if (now.getHours() < h2) is_before_second_time = true;
                else if (now.getHours() == h2 && now.getMinutes() <= m2) is_before_second_time = true;

                // Checks if both conditions match and, if so, runs the flow
                // Flow runs continuously until they no longer match, unlike with the Time Of Day.
                RunFlow(flow);

                
            }
        }
    }

}

// Open the sidebar when the icon is clicked.
browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open();
})

// Global variables :)
var states = {}
var flows = {}

// Main function - asynchronious because dealing with JS Promises is annoying.
async function Main()
{
    // Main loop
    setInterval(async () => {
        // Checks some permissions, in case anything has changed
        has_management_permission = await browser.permissions.contains({permissions: ["management"]})
        has_tabs_permission = await browser.permissions.contains({permissions: ["tabs"]})
        has_tabs_hide_permission = await browser.permissions.contains({permissions: ["tabHide"]})
        has_notifications_permission = await browser.permissions.contains({permissions: ["notifications"]})

        // Gets the flows - has to be run each time in case the user has changed something
        flows = (await browser.storage.local.get(["flows"])).flows;
        
        //  Check if any data was retrieved.
        if (flows === undefined) return;

        // Iterates through them, evaluating them.
        for (let flow_id of Object.keys(flows))
        {
            EvaluateFlow(flow_id, flows[flow_id])
        }
    }, 1000);


}

Main();