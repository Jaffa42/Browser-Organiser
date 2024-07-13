/* (c) William Taylor 2024 */

const AVAILABLE_PERMISSIONS =  ["management", "tabs", "tabHide", "notifications"]

// tabs_to_close_count is the number of tabs to close, starting with the earliest.
/**
 * 
 * @param {*} flow The flow to run
 * @param {*} tabs_to_close_count The number of tabs to close, if applicable
 * @param {*} permissions The current permissions
 * @param {*} is_first_run Whether this is the first run - if false, notifications won't run.
 */
function RunFlow(flow, tabs_to_close_count=null, is_first_run=true, permissions=[])
{
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
                if (!is_first_run) continue;
                if (!permissions.includes("notifications"))
                {
                    console.warn("Cannot run notifications action: permission denied.", permissions);
                    continue;
                }
                browser.notifications.create({
                    type: "basic",
                    title: action.settings.Title,
                    message: action.settings.Body,
                    iconUrl: browser.runtime.getURL("icon.png")
                });
                break;
            }
            case "Apply Theme": {
                if (!permissions.includes("management"))
                {
                    console.warn("Cannot run apply theme action: permission denied.", permissions);
                    continue;
                }
                browser.management.setEnabled(action.settings.Theme, true);
                break;
            }
            case "Hide Tabs": {
                if (!permissions.includes("tabHide") | !permissions.includes("tabs"))
                {
                    console.warn("Cannot run hide tabs action: permission denied.", permissions);
                    continue;
                }
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
                if (!permissions.includes("tabs"))
                {
                    console.warn("Cannot run close tabs action: permission denied.", permissions);
                    continue;
                }
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
                if (!permissions.includes("tabs") | !permissions.includes("tabHide"))
                {
                    console.warn("Cannot run reveal tabs action: permission denied.", permissions);
                    continue;
                }
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
                            if (!tab_match_found) browser.tabs.show(tab.id); 
                        }
                        
                    }
                })
                break;
            }
            case "Pin Tabs": {
                if (!permissions.includes("tabs"))
                {
                    console.warn("Cannot run pin tabs action: permission denied.");
                    continue;
                }
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
                if (!permissions.includes("tabs"))
                {
                    console.warn("Cannot run Unpin tabs action: permission denied.", permissions);
                    continue;
                }
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



async function GetPermissions(permissions_to_check)
{
    let permissions = []
    for (let permission of permissions_to_check)
    {
        let state = await browser.permissions.contains({permissions: [permission]})
        if (state) permissions.push(permission)
    }
    return permissions;
}