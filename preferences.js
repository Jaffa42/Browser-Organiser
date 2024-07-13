window.addEventListener("load", async () => {
    let flows = (await browser.storage.local.get(["flows"])).flows;
    if (flows !== undefined)
    {
        if (Object.keys(flows).length == 0) document.getElementById("flows-title").innerText = `You have no flows`;
        else if (Object.keys(flows).length == 1) document.getElementById("flows-title").innerText = `You have ${Object.keys(flows).length} flow`;
        else document.getElementById("flows-title").innerText = `You have ${Object.keys(flows).length} flows`;
        
        

        let buttons = [];
        for (let flow_id of Object.keys(flows))
        {
            console.log(flows[flow_id])
            for (let condition_id of Object.keys(flows[flow_id].conditions))
            {
                if (flows[flow_id].conditions[condition_id].type == "Button")
                {
                    if (!buttons.includes(flows[flow_id].conditions[condition_id].settings["Button Name"]))
                    {
                        buttons.push(flows[flow_id].conditions[condition_id].settings["Button Name"])
                    }
                }
            }
        }
        console.log(buttons)

        document.getElementById("your-buttons-title").hidden = buttons.length == 0
        if (buttons.length == 0) 
        {
            document.getElementById("buttons-title").innerText = `You have no buttons.`
        }
        else if (buttons.length == 1) document.getElementById("buttons-title").innerText = `You have 1 button`
        else document.getElementById("buttons-title").innerText = `You have ${buttons.length} buttons`

        for (let button_name of buttons)
        {
            let btn = document.createElement("button");
            btn.classList.add("btn-spaced")
            btn.disabled = true;
            btn.innerText = button_name;
            document.getElementById("buttons-area").appendChild(btn);
        }
    }
    
})