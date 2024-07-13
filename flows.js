// Enable the popup to notify the user if something went wrong
const ENABLE_ERROR_PROMPT = true



// The current flow ID
var current_id = 0;

// Loads the permissions
const LoadPermissions = new Promise(async (resolve, reject) => {
    var permissions = {
        management: null,
        tabs: null,
        tabHide: null,
        notifications: null,
    }
    for (let permission of Object.keys(permissions))
    {
        permissions[permission] = await browser.permissions.contains({permissions: [permission]}) ? 1 : 0
    }
    resolve(permissions);
})

var unsaved_changes = false;

function EnableSave()
{
    unsaved_changes = true;
    document.getElementById("save").disabled = false;
    document.getElementById("save-icon").innerText = "save";
    document.getElementById("save-text").innerText = "Save";
}

/** Creates a dialog
 * 
 * @param {string} title The popup's title
 * @param {string} body The popup's body
 * @param {Array} additional_buttons An array containing additional buttons, in the form of {title: "<title>", link: "<URL>", function: () => {}, close: <ClosePopup?>}
 */
function CreatePopup(title, body, buttons=[{title: "Close"}])
{
    // Creates a blurred background
    let blur_bg = document.createElement("div");
    blur_bg.classList.add("blur-bg");
    document.body.appendChild(blur_bg);

    // Creates the dialog element
    let dialog = document.createElement("dialog");
    dialog.classList.add("popup")

    // Creates the title element
    let title_element = document.createElement("h2");
    title_element.innerText = title;
    dialog.appendChild(title_element);

    // Creates the body element
    let body_element = document.createElement("p")
    body_element.innerText = body;
    dialog.appendChild(body_element);

    // The row of buttons
    let button_row = document.createElement("div");
    button_row.classList.add("popup-button-row")

    // Creates each button
    for (let button of buttons)
    {
        // Creates the button element
        let button_element = document.createElement("button");
        button_element.innerText = button.title;

        // Handles clicking the button
        button_element.onclick = (e) => {

            // Execute the button's function if it exists
            if (button.function !== undefined)
            {
                button.function(dialog, blur_bg);
            }

            // Opens the link if it exists
            if (button.link !== undefined)
            {
                let link = document.createElement("a");
                link.href = button.link;
                link.target = "_blank";
                link.click();
                link.remove();
            }

            // Closes the dialog unless we have been specifically told not to
            if (button.close !== false)
            {
                blur_bg.remove();
                dialog.remove();
            }
            
        }

        // Adds the button to the button row
        button_row.appendChild(button_element);
        
    }

    
    // Adds the button row to the dialog
    dialog.appendChild(button_row);

    // Makes the dialog visible
    dialog.open = true;
    document.body.appendChild(dialog);
}






class Flow
{
    constructor(name, conditions, actions, this_id=null, entry_id=0)
    {
        if (this_id == null)
        {
            this.id = current_id++;
            this_id = this.id;
        }
        else
        {
            this.id = this_id;
        }
        this.name = name === null ? "" : name;
        this.conditions = {}
        this.actions = {}

        this.entry_id = entry_id;


        // The conditions to be shown
        // Format: 
        /*
            "<condition>": {
                type: "<type>",
                title: "<title>",
                options: [
                    {type: "<opt_type>", title: "<title>", options: ["<multi_choice_option>"]}
                ],
                requires_permissions: ["<permission>"]
            }
        */
        this.condition_types = {
            "Button": {
                icon: "radio_button_checked",
                options: [
                    {type: "text", title: "Button Name"},
                    
                ],
                category: "Triggers"
            },
            "Time Of Day": {
                icon: "alarm",
                options: [
                    {type: "time", title: "Time"},
                    {type: "message", title: "Triggers once, when the specified time is reached."}
                ],
                category: "Triggers"
            },
            "Schedule": {
                icon: "schedule",
                options: [
                    {type: "time", title: "Start Time"},
                    {type: "time", title: "End Time"},
                    {type: "message", title: "Continuously triggers between the two specified times."},
                ],
                category: "Triggers"
            },
            "Websites": {
                icon: "globe",
                options: [
                    {type: "multi-choice", title: "Apply to:", options: ["These sites", "All sites except these"],},
                    {type: "spacer"},
                    {type: "textarea", title: "Sites", placeholder: "Enter each website on a new line, e.g. \nexample.com\nexample.net"},
                    
                ],
                requires_permissions: ["tabs"],
                category: "Specifiers",
            },
            "Tab Count": {
                icon: "tab_group",
                options: [
                    {type: "multi-choice", title: "Trigger when", options: ["Tab count is higher", "Tab count is equal", "Tab count is lower"]},
                    {type: "integer", title: "Number of tabs", min: 0},
                    
                ],
                requires_permissions: ["tabs"],
                category: "Triggers"
            },

            
        }

        // Action types
        // Takes the same format as the conditions, without the category

        this.action_types = {
            "Apply Theme": {
                icon: "palette",
                options: [
                    {type: "multi-choice", title: "Theme", options: "$THEMES"},
                    {type: "message", title: "Warning: may cause flashing lights, especially if misconfigured and there are two or more apply theme actions continually triggering."}
                ],
                requires_permissions: ["management"]
            },
            "Close Tabs": {
                icon: "cancel",
                options: [
                    {type: "message", title: "If no 'websites' condition is applied, all tabs will be closed."},
                    {type: "boolean", title: "Show confirmation?"},
                    {type: "boolean", title: "Apply to hidden tabs?"},
                    {type: "boolean", title: "Apply to active tab?"}
                ],
                requires_permissions: ["tabs"]
            },
            "Hide Tabs": {
                icon: "visibility_off",
                options: [
                    {type: "message", title: "If no 'websites' condition is applied, all tabs except the active one will be hidden."},
                    {type: "message", title: "Due to browser limitations, the active tab cannot be hidden."}
                ],
                requires_permissions: ["tabs", "tabHide"]
            },
            "Reveal Tabs": {
                icon: "visibility",
                options: [
                    {type: "message", title: "If no 'websites' condition is applied, all hidden tabs will be revealed."}
                ],
                requires_permissions: ["tabs", "tabHide"]
            },
            "Pin Tabs": {
                icon: "keep",
                options: [
                    {type: "boolean", title: "Apply to hidden tabs?"},
                    {type: "message", title: "If no 'websites' condition is applied, all open tabs will be pinned."},
                ],
                requires_permissions: ["tabs"]
            },
            "Unpin Tabs": {
                icon: "keep_off",
                options: [
                    {type: "message", title: "If no 'websites' condition is applied, all open tabs will be unpinned."},
                ],
                requires_permissions: ["tabs"]
            },
            "Send Notification": {
                icon: "notifications",
                options: [
                    {type: "text", title: "Title"},
                    {type: "textarea", title: "Body"},
                ],
                requires_permissions: ["notifications"],
            }
        }


        // Draw the flow
        this.Draw();

        if (conditions !== null)
        {
            for (let condition of Object.keys(conditions))
            {
                this.AddCondition(conditions[condition].type, conditions[condition].settings)

            }
        }

        if (actions !== null)
            {
                for (let action of Object.keys(actions))
                {
                    this.AddAction(actions[action].type, actions[action].settings)
    
                }
            }
    }

    

    Draw()
    {
        // Create the section
        var section = document.createElement("section");
        section.classList.add("flow");

        // The top section includes the title and delete button
        var top_section = document.createElement("div");
        top_section.classList.add("flow-top-area")

        // Title
        var title = document.createElement("input");
        title.type = "text";
        title.placeholder = "Enter title..."
        title.title = "The title for this flow";
        title.value = this.name;

        title.onkeyup = () => {
            this.name = title.value;
            EnableSave();
        }
        
        title.classList.add("flow-title");
        top_section.appendChild(title);

        // Delete button
        var delete_button = document.createElement("button");
        delete_button.title = "Delete this flow";
        delete_button.innerText = "delete";
        delete_button.classList.add("material-symbols-outlined");
        delete_button.classList.add("delete-flow");

        delete_button.onclick = () => {
            EnableSave();
            delete flows[this.id];
            section.remove();
        }
        
        top_section.appendChild(delete_button);

        section.appendChild(top_section);
        

        // First divider - between the top section and the conditions area
        var divider1 = document.createElement("hr");
        divider1.classList.add("divider");
        section.appendChild(divider1);

        // Area in which the conditions will be displayed
        this.conditions_area = document.createElement("span");
        this.conditions_area.classList.add("conditions");
        section.appendChild(this.conditions_area);

        // Button to create a new condition
        var new_condition_btn = document.createElement("button");
        new_condition_btn.classList.add("flow-add-item");
        new_condition_btn.innerText = "New Condition"
        section.appendChild(new_condition_btn);

        // Menu of conditions
        var new_conditions_menu_div = document.createElement("div");

        // The categories of conditions. Currently, there are two, and all condition types are sorted into one of them. They are 'Triggers', which are responsible for triggering the flow, and 'Specifiers' which narrow down what the flow applies to.
        var condition_catergories = {}

        for (let condition in this.condition_types)
        {
            if (!Object.keys(condition_catergories).includes(this.condition_types[condition].category)) 
            {
                // Sub menu containing all of one category
                let sub_menu_div = document.createElement("div");
                sub_menu_div.classList.add("item-menu");

                // The title
                let sub_menu_title = document.createElement("p");
                sub_menu_title.classList.add("sub-menu")
                sub_menu_title.innerText = this.condition_types[condition].category;

                // Add it to the conditions menu, and remember it.
                condition_catergories[this.condition_types[condition].category] = sub_menu_div;
                new_conditions_menu_div.appendChild(sub_menu_title);
                new_conditions_menu_div.appendChild(sub_menu_div);
            }
        }
        
        // Iterates through the conditions, creating a button for each.
        for (let condition in this.condition_types)
        {
            // The button includes an icon and a description
            var condition_button = document.createElement("button");
            
            var condition_button_icon = document.createElement("div");
            condition_button_icon.ariaHidden = true;
            condition_button_icon.innerText = this.condition_types[condition].icon;
            condition_button_icon.classList.add("material-symbols-outlined");
            condition_button.appendChild(condition_button_icon);

            var condition_button_text = document.createElement("div");
            condition_button_text.innerText = condition;
            condition_button.appendChild(condition_button_text);

            condition_button.classList.add("item");
            condition_catergories[this.condition_types[condition].category].appendChild(condition_button);

            // The action to take when a condition is clicked on.
            condition_button.onclick = () => {
                EnableSave();
                this.AddCondition(condition)

                new_conditions_menu_div.hidden = true;
                new_condition_btn.hidden = false;
            }
        }
        
        // Adds the menu to the section, and hides it until it is needed.
        section.appendChild(new_conditions_menu_div);
        new_conditions_menu_div.hidden = true;

        // Shows the menu when the 'new condition' button is pressed, and hides the button.
        new_condition_btn.onclick = () => {
            new_condition_btn.hidden = true;
            new_conditions_menu_div.hidden = false;
        }

        // Second divider, between the conditions and actions
        var divider1 = document.createElement("hr");
        divider1.classList.add("divider");
        section.appendChild(divider1);

        // Creates the area in which the actions will go
        this.actions_area = document.createElement("span");
        this.actions_area.classList.add("actions");
        section.appendChild(this.actions_area);

        // Creates the menu of actions
        var new_actions_menu = document.createElement("div");
        new_actions_menu.classList.add("item-menu");

        new_actions_menu.hidden = true;

        // Iterate through the actions, doing basically the same thing as for the conditions.
        for (let action in this.action_types)
        {
            var action_button = document.createElement("button");
            
            var action_button_icon = document.createElement("div");
            action_button_icon.ariaHidden = true;
            action_button_icon.innerText = this.action_types[action].icon;
            action_button_icon.classList.add("material-symbols-outlined");
            action_button.appendChild(action_button_icon);

            var action_button_text = document.createElement("div");
            action_button_text.innerText = action;
            action_button.appendChild(action_button_text);

            
            action_button.classList.add("item");
            new_actions_menu.appendChild(action_button);

            // The action to take when a condition is clicked on.
            action_button.onclick = () => {
                EnableSave();
                this.AddAction(action);
                
                new_actions_menu.hidden = true;
                new_action_btn.hidden = false;
            }
        }

        section.appendChild(new_actions_menu);

        // Creates the button that adds an action
        var new_action_btn = document.createElement("button");
        new_action_btn.classList.add("flow-add-item");
        new_action_btn.innerText = "New Action"
        section.appendChild(new_action_btn);

        new_action_btn.onclick = () => {
            new_action_btn.hidden = true;
            new_actions_menu.hidden = false;
        }
        
        // Add the flow to the flows area
        document.getElementById("flows").appendChild(section);


    }
    /** Creates an action or condition entry
     * 
     * @param {HTMLElement} parent The parent element
     * @param {*} id  The unique identifier
     * @param {string} title The title of the entry
     * @param {string} icon The Icon
     * @param {Array} settings The settings to apply
     * @param {Array} entry_list A list of entries to enter this into
     */
    CreateFlowEntry(parent, id, title, icon, settings, entry_list, required_permissions=null, settings_values={})
    {
        // Creates the div that wraps the whole entry
        let entry = document.createElement("div");
        entry.classList.add("flow-entry")

        // Checks if there are any required permissions, so that we can then ask for them.
        if (Array.isArray(required_permissions))
        {
            let permissions_not_granted = []
            let permissions_text = "";

            // Iterates through the required permissions, checking if we have each of them
            for (let permission of required_permissions)
            {
                // Checks if the permission has been granted
                if (!permissions[permission])
                {

                    // If not, add it to a list and add a message explaining what it is used for to the string
                    permissions_not_granted.push(permission);
                    switch(permission)
                    {
                        case "management": {
                            permissions_text += "The 'management' permission is required in order to list all the installed themes and change the active theme.\n"
                            break;
                        }
                        case "tabs": {
                            permissions_text += "The 'tabs' permission is required in order to view and manage tabs.\n"
                            break;
                        }
                        case "tabHide": {
                            permissions_text += "The 'hide tabs' permission is required in order to hide and show tabs.\n"
                            break;
                        }
                        case "notifications": {
                            permissions_text += "The 'notifications' permission is required to send you notifications.\n"
                        }
                    }
                }
            }
            // Show a popup if permissions are needed, for what and why.
            if (permissions_text != "") CreatePopup(`Permission required for '${title}'`, permissions_text, [
                {title: "Cancel"},
                {title: "Grant permissions", function: (dialog, blur_bg) => {
                    // When the 'Grant permissions' button is clicked, hides the buttons and display a message telling the user to look for the prompt.
                    dialog.querySelectorAll("button").forEach((element) => {
                        element.hidden = true;
                    })
                    dialog.querySelector("p").innerText += "\nYour browser will now prompt you for these permissions."

                    // Requests the permissions
                    browser.permissions.request({permissions: permissions_not_granted}).then(async (success) => {
                        if (success)
                        {
                            // Hides the dialog and shows a new one if successful
                            dialog.remove();
                            blur_bg.remove();

                            CreatePopup("Success!", "The permissions were granted successfully.");

                            for (let permission of permissions_not_granted)
                            {
                                permissions[permission] = 1;
                            }

                            // If the management permission was just granted, loads the themes
                            if (permissions_not_granted.includes("management"))
                            {
                                await LoadThemes()
                            }

                            // Creates the flow entry.
                            this.CreateFlowEntry(parent, id, title, icon, settings, entry_list, required_permissions, settings_values);
                        }
                        else
                        {
                            // If unsuccessful, removes the dialog and show a new one explaining this to the user, telling them to go to about:addons.
                            dialog.remove();
                            blur_bg.remove();

                            CreatePopup("Unable to access permissions", "The permissions were not granted. You can manage permissions any time in 'about:addons'.")
                        }
                    })
                }, close: false},
            ])

            // Don't continue with setting up the entry if permissions haven't been granted yet.
            if (permissions_not_granted.length != 0) return;
        }
        


        // Title area
        let title_area = document.createElement("div")
        title_area.classList.add("flow-entry-title-area")

        // Icon
        let symbol = document.createElement("div");
        symbol.ariaHidden = true;
        symbol.classList.add("material-symbols-outlined");
        symbol.classList.add("flow-entry-symbol");
        symbol.innerText = icon;
        title_area.appendChild(symbol)

        // Title
        let description = document.createElement("p");
        description.innerText = title;
        description.classList.add("flow-entry-title");
        title_area.appendChild(description);

        // Button to remove the condition
        let remove_btn = document.createElement("button")
        remove_btn.innerText = "delete";
        remove_btn.classList.add("flow-entry-remove-btn")
        remove_btn.classList.add("material-symbols-outlined");

        title_area.appendChild(remove_btn);

        // Adds the title area
        entry.appendChild(title_area);

        // Settings
        let settings_area = document.createElement("div");
        settings_area.classList.add("flow-entry-settings");

        // The entry into either 'this.conditions' or 'this.actions'.
        var array_entry = {
            type: title,
            option_elements: {

            }
        }

        // Creates the settings
        for (let option of settings)
        {  
            let option_value = Object.keys(settings_values).includes(option.title) ? settings_values[option.title] : option.value;

            // If just a spacer, don't bother with the rest
            if (option.type == "spacer")
            {
                let options_spacer = document.createElement("div");
                options_spacer.classList.add("options-spacer")
                settings_area.appendChild(options_spacer);
                continue;
            }

            // Creates the container for the option
            let option_container = document.createElement("div");
            option_container.classList.add("option-container");

            // The title for the option
            let option_title = document.createElement("label");
            option_title.htmlFor = `flow-${this.id}-entry-${id}-${option.title}`;

            // The value of the option
            let option_value_elem = document.createElement("input");
            
            // Changes the input based on the type
            switch(option.type)
            {
                // Text input
                case "text": {
                    if (option_value !== undefined) option_value_elem.value = option_value;
                    option_value_elem.type = "text";
                    option_value_elem.placeholder = "Enter text...";
                    break;
                }

                // Time input
                case "time": {
                    if (option_value !== undefined) option_value_elem.value = option_value
                    option_value_elem.type = "time";
                    option_value_elem.placeholder = "Enter time...";
                    break;
                }

                // Integer input
                case "integer": {
                    if (option_value !== undefined) option_value_elem.value = option_value
                    option_value_elem.type = "number";
                    option_value_elem.placeholder = "Enter a number...";
                    if (option.min !== undefined) option_value_elem.min = option.min
                    if (option.max !== undefined) option_value_elem.max = option.max
                    break;
                }

                // Changes the input to a textarea
                case "textarea": {
                    option_value_elem = document.createElement("textarea");
                    if (option_value !== undefined) option_value_elem.value = option_value
                    option_value_elem.placeholder = option.placeholder === undefined ? "Enter text..." : option.placeholder
                    break;
                }

                // Changes the input to a select
                case "multi-choice": {
                    option_value_elem = document.createElement("select");
                    var choices = []
                    var choices_values = []

                    //  If an array has been provided, use that
                    if (Array.isArray(option.options))
                    {
                        choices = option.options
                        choices_values = option.options;
                    }

                    // If a variable has been used, use that
                    else
                    {
                        if (option.options == "$THEMES")
                        {
                            choices = themes;
                            choices_values = theme_ids;
                        }
                    }
                    
                    // Defaults the selection to the first one if none specified
                    let selected = choices[0];

                    // Iterates through the potential choices, adding each one to the dropdown
                    for (let dropdown_option_id in choices)
                    {
                        let dropdown_option = choices[dropdown_option_id];
                        let dropdown_option_value = choices_values[dropdown_option_id];
                        let option_elem = document.createElement("option");
                        option_elem.innerText = dropdown_option;
                        option_value_elem.appendChild(option_elem);

                        // If this option is the selected one, select it
                        if ((dropdown_option_value !== undefined) && dropdown_option_value == option_value) 
                        {
                            option_elem.selected = true;
                            selected = dropdown_option_value;
                        }

                        // In order to return back to the previous selection after clicking 'more themes', updates the selected variable every time the selection changes
                        if (option.options == "$THEMES")
                        {
                            option_elem.addEventListener("click", () => {selected = dropdown_option_value})
                            option_elem.value = dropdown_option_value;
                        }
                    }
                    // Adds the 'more themes' button
                    if (option.options == "$THEMES")
                    {
                        
                        option_value_elem.classList.add("themes-dropdown")
                        let get_more = document.createElement("option");
                        get_more.classList.add("themes-dropdown-more")
                        get_more.innerText = "More themes";

                        // Shows the popup when clicked
                        get_more.onclick = () => {
                            CreatePopup("More themes", "This dropdown lists all of the installed themes. To get new themes, visit addons.mozilla.org.", [{title: "Close", function: () => {option_value_elem.value = selected}}, {title: "Get themes", link: "https://addons.mozilla.org/en-GB/firefox/themes/", function: () => {option_value_elem.value = selected}}])
                        }
                        option_value_elem.appendChild(get_more);
                    }
                    
                    break;
                }

                // Make the title take up the full width if a message
                case "message": {
                    option_title = document.createElement("p");
                    option_title.style.width = "100%";
                    option_title.style.textAlign = "justify";
                    break;
                }

                // Checkbox input
                case "boolean": {
                    option_value_elem.type = "checkbox";
                    option_value_elem.checked = option_value;
                    break;
                }
            }

            // Sets the ID of the input - needed for the label to focus it on click.
            option_value_elem.id = `flow-${this.id}-entry-${id}-${option.title}`;
            
            // Adds the label
            option_title.innerText = option.title;
            option_container.appendChild(option_title);

            // Remove the input if a message
            if (option.type != "message") option_container.appendChild(option_value_elem);

            settings_area.appendChild(option_container);

            if (!["message", "spacer"].includes(option.type)) array_entry.option_elements[option.title] = option_value_elem;

            // When there is a change in any input, enable the save button
            option_value_elem.addEventListener("change", () => {
                EnableSave()
            })

            option_value_elem.addEventListener("keyup", () => {
                EnableSave()
            })
        }

        // Add the entry into either 'this.conditions' or 'this.actions'
        entry_list[id] = array_entry;

        // Remove the entry on click
        remove_btn.onclick = () => {
            EnableSave();
            entry.remove();
            delete entry_list[id];
        }

        // Show the settings area if there are settings
        if (settings.length != 0) entry.appendChild(settings_area);

        

        // Add the entry to either the conditions or actions area
        parent.appendChild(entry);
    }

    // Creates a condition entry
    AddCondition(type, settings_values={})
    {
        var condition_id = this.entry_id++;
        this.CreateFlowEntry(this.conditions_area, condition_id, type, this.condition_types[type].icon, this.condition_types[type].options, this.conditions, this.condition_types[type].requires_permissions, settings_values);
    }

    // Creates an action entry
    AddAction(type, settings_values={})
    {
        var action_id = this.entry_id++;
        this.CreateFlowEntry(this.actions_area, action_id, type, this.action_types[type].icon, this.action_types[type].options, this.actions, this.action_types[type].requires_permissions, settings_values);
    }


}

// Global variables
var flows = {}
var themes = []
var theme_ids = []
var permissions = {}

// Load the themes
async function LoadThemes()
{
    var extensions = await browser.management.getAll()
    themes = [];
    for (let ext of extensions)
    {
        if (ext.type == "theme")   
        {
            themes.push(ext.name);
            theme_ids.push(ext.id);
        }
    }
}

window.addEventListener("beforeunload", (e) => {
    if (unsaved_changes) e.preventDefault();
})

window.addEventListener("load", () => {
    // Show an error message if something goes wrong.
    window.onerror = (event, source, lineno, colno, error) => {
        if (!ENABLE_ERROR_PROMPT) return;
        CreatePopup("An error occurred", `'${error}' in line ${lineno}, column ${colno} of ${source}\n\nTry reloading.`);
    }


    LoadPermissions.then(async (loaded_permissions) => {
        // After getting permissions, load themes (if we have permission)
        permissions = loaded_permissions;
        if (permissions.management)
        {
            await LoadThemes()
        }

        // Retrieve any saved data
        var saved_data = await browser.storage.local.get(["flows"]);
        if (saved_data.flows === undefined) saved_data.flows = {}
        for (let flow_id_str of Object.keys(saved_data.flows))
        {
            console.log(flow_id_str);
            let flow_id = parseInt(flow_id_str);
            
            if (flow_id >= current_id) current_id = flow_id + 1;
        }
        

        // If no flows, creates one
        if (Object.keys(saved_data.flows).length == 0) 
        {
            let f = new Flow("", null, null);
            flows[f.id] = f;
        }
        else
        {
            for (let flow_id of Object.keys(saved_data.flows))
            {
                saved_data.flows[flow_id].current_entry_id = 0

                for (let condition_id_str of Object.keys(saved_data.flows[flow_id].conditions))
                {
                    let condition_id = parseInt(condition_id_str);
                    if (condition_id >= saved_data.flows[flow_id].current_entry_id) saved_data.flows[flow_id].current_entry_id = condition_id + 1;
                }
                for (let action_id_str of Object.keys(saved_data.flows[flow_id].actions))
                {
                    let action_id = parseInt(action_id_str);
                    if (action_id >= saved_data.flows[flow_id].current_entry_id) saved_data.flows[flow_id].current_entry_id = action_id + 1;
                }
                let f = new Flow(saved_data.flows[flow_id].title, saved_data.flows[flow_id].conditions, saved_data.flows[flow_id].actions, flow_id, saved_data.flows[flow_id].current_entry_id)
                flows[flow_id] = f;

            }
        }

        // Makes the 'New' button work
        document.getElementById("new-flow").onclick = () => {
            let f = new Flow("", null, null);
            flows[f.id] = f;
        }

        // Makes the 'Save' button work
        document.getElementById("save").onclick = () => {
            document.getElementById("save").disabled = true;
            unsaved_changes = false;
            var save_data = {

            }

            // Iterates through the flows
            for (let flow of Object.keys(flows))
            {
                // Creates an object with the save data
                var flow_save_data = {
                    "conditions": {},
                    "actions": {},
                    "title": flows[flow].name,
                }

                // Iterates through the conditions
                for (let condition_id of Object.keys(flows[flow].conditions))
                {
                    flow_save_data.conditions[condition_id] = {settings: {}, type: flows[flow].conditions[condition_id].type};

                    // Iterates through the options
                    for (let setting of Object.keys(flows[flow].conditions[condition_id].option_elements))
                    {
                        let save_value = flows[flow].conditions[condition_id].option_elements[setting].type != "checkbox" ? flows[flow].conditions[condition_id].option_elements[setting].value : flows[flow].conditions[condition_id].option_elements[setting].checked;
                        flow_save_data.conditions[condition_id].settings[setting] = save_value;
                    }
                }

                // Iterates through the actions
                for (let action_id of Object.keys(flows[flow].actions))
                {
                    flow_save_data.actions[action_id] = {settings: {}, type: flows[flow].actions[action_id].type};

                    // Iterates through the options
                    for (let setting of Object.keys(flows[flow].actions[action_id].option_elements))
                    {
                        flow_save_data.actions[action_id].settings[setting] = flows[flow].actions[action_id].option_elements[setting].type != "checkbox" ? flows[flow].actions[action_id].option_elements[setting].value : flows[flow].actions[action_id].option_elements[setting].checked;
                    }
                }

                // Add the flow to the save data
                save_data[flow] = flow_save_data;
                
            }

            // Save the data
            browser.storage.local.set({
                flows: save_data,
            }).then(() => {
                // Success
                document.getElementById("save-icon").innerText = "check";
                document.getElementById("save-text").innerText = "Saved!";
            }, () => {
                // Error
                EnableSave();
                document.getElementById("save-icon").innerText = "error";
                document.getElementById("save-text").innerText = "Error saving! Click to retry.";
                
            })
            
        }
    })
})


