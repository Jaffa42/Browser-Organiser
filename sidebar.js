/* (c) William Taylor 2024 */

var flows = {}

var buttons = []

async function UpdateButtons()
{
    flows = {}
    buttons = {}
    document.getElementById("buttons").innerHTML = "";
    flows = (await browser.storage.local.get(["flows"])).flows;
    if (flows !== undefined)
    {
        for (let flow_id of Object.keys(flows))
        {
            for (let condition_id of Object.keys(flows[flow_id].conditions))
            {
                if (flows[flow_id].conditions[condition_id].type == "Button")
                {
                    if (!Object.keys(buttons).includes(flows[flow_id].conditions[condition_id].settings["Button Name"]))
                    {
                        buttons[flows[flow_id].conditions[condition_id].settings["Button Name"]] = [flows[flow_id]]
                    }
                    else if (!(buttons[flows[flow_id].conditions[condition_id].settings["Button Name"]]).includes(flows[flow_id]))
                    {
                        buttons[flows[flow_id].conditions[condition_id].settings["Button Name"]].push(flows[flow_id])
                    }
                }
            }
        }
        for (let button_text of Object.keys(buttons))
        {
            let button = document.createElement("button");
            button.innerText = button_text;
            button.onclick = async () => {
                for (let flow of buttons[button_text])
                {
                    let permissions = await GetPermissions(AVAILABLE_PERMISSIONS);
                    RunFlow(flow, null, true, permissions);
                }
            }
            document.getElementById("buttons").appendChild(button);
        }
    }
    

    document.getElementById("welcome").hidden = Object.keys(buttons).length != 0;
}

window.addEventListener("load", async () => {
    await UpdateButtons();

    document.getElementById("reload-button").onclick = async () => {
        UpdateButtons()
    }

    
})