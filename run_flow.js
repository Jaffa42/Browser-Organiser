// tabs_to_close_count is the number of tabs to close, starting with the earliest.
function RunFlow(flow, tabs_to_close_count=null)
{
    console.log("Running", flow)

    var sites_list_include = null;
    var sites_list_exclude = null;
    for (let condition_id of Object.keys(flow.conditions))
    {
        if (flow.conditions[condition_id].type == "Websites")
        {
            if (flow.conditions[condition_id].settings['Apply to:'] == "These sites")
            {
                // Whitelist
                if (sites_list_include === null) sites_list_include = [];
                for (let site of flow.conditions[condition_id].settings.Sites.split("\n")) sites_list_include.push(site)
            }
            else if (flow.conditions[condition_id].settings['Apply to:'] == "All sites except these")
            {
                // Blacklist
                if (sites_list_exclude === null) sites_list_exclude = [];
                for (let site of flow.conditions[condition_id].settings.Sites.split("\n")) sites_list_exclude.push(site);
            }
        }
    }

    for (let action_id of Object.keys(flow.actions))
    {

        let action = flow.actions[action_id];
        switch(action.type)
        {
            
            case "Send Notification": {
                browser.notifications.create({
                    type: "basic",
                    title: action.settings.Title,
                    message: action.settings.Body,
                    iconUrl: browser.runtime.getURL("icon.png")
                });
                break;
            }
            case "Apply Theme": {
                browser.management.setEnabled(action.settings.Theme, true);
                break;
            }
            case "Hide Tabs": {
                var tabs_to_close = []
                browser.tabs.query({}).then((tabs) => {
                    for (let tab of tabs)
                    {
                        if (tab.hidden) continue;
                        // All sites
                        if (sites_list_exclude === null && sites_list_include === null) { tabs_to_close.push(tab) }
                        // Only specified sites
                        else if (sites_list_exclude === null) { for (let url of sites_list_include) if (tab.url.includes(url)) tabs_to_close.push(tab) }
                        // All sites except ones specified
                        else { 
                            let tab_match_found = false;
                            for (let url of sites_list_exclude) 
                            {
                                if ((tab.url.includes(url))) tab_match_found = true;
                            }
                            if (!tab_match_found) tabs_to_close.push(tab);
                        }
                        
                    }

                    if (tabs_to_close.length == 0) 
                    {
                        return;
                    }

                    if (tabs_to_close_count !== null)
                    {
                        tabs_to_close = tabs_to_close.sort((tabA, tabB) => {return tabA.lastAccessed - tabB.lastAccessed});
                        let index = 0;
                        for (let tab of tabs_to_close)
                        {
                            if (index >= tabs_to_close_count) break;

                            browser.tabs.hide(tab.id);

                            index += 1;
                        }
                    }
                    else
                    {
                        for (let tab of tabs_to_close)
                        {
                            browser.tabs.hide(tab.id);
                        }
                    }
                    
                })
                break;
            }
            case "Close Tabs": {
                var tabs_to_close = []
                browser.tabs.query({}).then((tabs) => {
                    for (let tab of tabs)
                    {
                        if (!action.settings["Apply to hidden tabs?"] && tab.hidden) continue;
                        if (!action.settings["Apply to active tab?"] && tab.active) continue;
                        // All sites
                        if (sites_list_exclude === null && sites_list_include === null) { tabs_to_close.push(tab) }
                        // Only specified sites
                        else if (sites_list_exclude === null) { for (let url of sites_list_include) if (tab.url.includes(url)) tabs_to_close.push(tab) }
                        // All sites except ones specified
                        else { 
                            let tab_match_found = false;
                            for (let url of sites_list_exclude) 
                            {
                                if ((tab.url.includes(url))) tab_match_found = true;
                            }
                            if (!tab_match_found) tabs_to_close.push(tab);
                        }
                        
                    }

                    if (tabs_to_close.length == 0) 
                    {
                        return;
                    }

                    
                    var close_tabs = true
                    if (action.settings["Show confirmation?"])
                    {
                        close_tabs = confirm(`The flow '${flow.title}' wants to close ${tabs_to_close.length} ${tabs_to_close.length == 1 ? "tab" : "tabs"}. Continue?`)
                    }
                    if (!close_tabs) 
                    {
                        return;
                    }

                    if (tabs.length == tabs_to_close.length) tabs.create({active: true, url: "about:netwab"})


                    if (tabs_to_close_count !== null)
                    {
                        tabs_to_close = tabs_to_close.sort((tabA, tabB) => {return tabA.lastAccessed - tabB.lastAccessed});
                        let index = 0;
                        for (let tab of tabs_to_close)
                        {
                            if (index >= tabs_to_close_count) break;

                            browser.tabs.remove(tab.id);

                            index += 1;
                        }
                    }
                    else
                    {
                        for (let tab of tabs_to_close)
                        {
                            browser.tabs.remove(tab.id);
                        }
                    }
                    
                })
                break;
            }
            case "Reveal Tabs": {
                browser.tabs.query({}).then((tabs) => {
                    for (let tab of tabs)
                    {
                        // All sites
                        if (sites_list_exclude === null && sites_list_include === null) {browser.tabs.show(tab.id) }
                        // Only specified sites
                        else if (sites_list_exclude === null) { for (let url of sites_list_include) if (tab.url.includes(url)) browser.tabs.show(tab.id) }
                        // All sites except ones specified
                        else { 
                            let tab_match_found = false;
                            for (let url of sites_list_exclude) 
                            {
                                if ((tab.url.includes(url))) tab_match_found = true;
                            }
                            if (!tab_match_found) browser.tabs.hide(tab.id); 
                        }
                        
                    }
                })
                break;
            }
            case "Pin Tabs": {
                browser.tabs.query({}).then((tabs) => {
                    for (let tab of tabs)
                    {
                        if (!action.settings["Apply to hidden tabs?"] && tab.hidden) continue;
                        // All sites
                        if (sites_list_exclude === null && sites_list_include === null) { browser.tabs.update(tab.id, {pinned: true}) }
                        // Only specified sites
                        else if (sites_list_exclude === null) { for (let url of sites_list_include) if (tab.url.includes(url)) browser.tabs.update(tab.id, {pinned: true}) }
                        // All sites except ones specified
                        else { 
                            let tab_match_found = false;
                            for (let url of sites_list_exclude) 
                            {
                                if ((tab.url.includes(url))) tab_match_found = true;
                            }
                            if (!tab_match_found) browser.tabs.update(tab.id, {pinned: true});
                        }
                        
                    }
                })
                break;
            }

            case "Unpin Tabs": {
                browser.tabs.query({}).then((tabs) => {
                    for (let tab of tabs)
                    {
                        if (!action.settings["Apply to hidden tabs?"] && tab.hidden) continue;
                        // All sites
                        if (sites_list_exclude === null && sites_list_include === null) { browser.tabs.update(tab.id, {pinned: false}) }
                        // Only specified sites
                        else if (sites_list_exclude === null) { for (let url of sites_list_include) if (tab.url.includes(url)) browser.tabs.update(tab.id, {pinned: false}) }
                        // All sites except ones specified
                        else { 
                            let tab_match_found = false;
                            for (let url of sites_list_exclude) 
                            {
                                if ((tab.url.includes(url))) tab_match_found = true;
                            }
                            if (!tab_match_found) browser.tabs.update(tab.id, {pinned: false});
                        }
                        
                    }
                })
                break;
            }
        }
        
    }
}


