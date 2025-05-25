---
description: Learn more about the available commands the application provides.
icon: square-terminal
---

# App Commands

## Legend, Keys, and Definitions

### Command Parameters

* **\<parameter-name-and-type>:** Parameters surrounded by angle brackets (`<>`) are required to execute a slash command.
* **\[parameter-name-and-type]:** Parameters surrounded by square brackets (`[]`) are optional when executing a slash command.

### Command Permissions

Commands are marked with a colored or uncolored asterisk (\*) to indicate the required permission(s) for execution. Here's a quick overview:

* Uncolored asterisk (\*): Command is executable by anybody who has access to it.
* <mark style="color:blue;">Blue asterisk (\*):</mark> Command is executable by server [**staff**](app-commands.md#permissions-explained) members.
* <mark style="color:green;">Green asterisk (\*):</mark> Command is executable by server [**management**](app-commands.md#permissions-explained) members.
* <mark style="color:red;">Red asterisk (\*):</mark> Command is executable by server [**administrative**](app-commands.md#permissions-explained) members.
* <mark style="color:yellow;">Yellow asterisk (\*):</mark> Command is executable by members with specific roles or permissions. Further details will be provided in the command description later on the page.

### Permissions Explained

<details>

<summary><strong>Server Staff Members </strong><mark style="color:blue;"><strong>(*)</strong></mark></summary>

Members considered part of the management staff, either by having the `Server Manage` permission via an assigned server role, or by having any role specifically set for management in the application's configuration.

</details>

<details>

<summary><strong>Server Management Members </strong><mark style="color:green;"><strong>(*)</strong></mark></summary>

Members considered part of the management staff, either by having the `Manage Server` permission via an assigned server role or by having any role specifically set for management in the application's configuration.

</details>

<details>

<summary><strong>Server Administrative Members </strong><mark style="color:red;"><strong>(*)</strong></mark></summary>

Members who have server administrative permissions by holding the [`Administrator`](https://support.discord.com/hc/en-us/articles/214836687-Role-Management-101) permission via an assigned server role or as being the server owner.

</details>

### Permissions Override

The **Administrator** permission takes precedence over all other permissions, such as **Management** or **Staff**. Any member with the **Administrator** permission is automatically considered part of management, and by extension, they are also considered staff members. The hierarchy of permissions is structured as follows:

1. Members with the **Administrator** permission.
2. Members with **Management**-level permissions.
3. Members with **Staff**-level permissions.
4. Members without any designated staff or management permissions, either through roles or application-specific settings. They are able to execute regular non-staff commands if they have access to them.

***

## Slash Commands

Below is a categorized list of all commands available through the LAPD Central application, divided into sections for organization and more readability. The 'Ephemeral' field under each command title indicates whether the command's response is ephemeral (private) or non-ephemeral (public) within the server channel for _normal_ responses.

### Informative Commands

* **About (\*)**\
  **Command:** `/about` \
  **Ephemeral:** No\
  **Description:** Provides quick information about the application.
* **Help (\*)**\
  **Command:** `/help` \
  **Ephemeral:** No\
  **Description:** Provides a redirect to the documentation page of LAPD Central to learn more about it.
* **Ping (\*)**\
  **Command:** `/ping` \
  **Ephemeral:** Yes\
  **Description:** Provides the current latency (ping) for both the application and websocket.
* **Police Code (\*)**\
  **Command:** `/police-code <code:Text> [private:Boolean]` \
  **Ephemeral:** Optional\
  **Description:** Provides details and information about a police radio code if possible. This includes usage contexts and examples.
* **Weather (\*)**\
  **Command:** `/weather [units: "metric" or "imperial"] [private:Boolean]` \
  **Ephemeral:** Optional\
  **Description:** Provides weather information for the city of Los Angeles at the time of execution, sourcing data from [OpenWeather](https://openweathermap.org/).
* **MDT Lookup&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/mdt lookup <name:Text>` \
  **Ephemeral:** No\
  **Description:** Provides recent violations or arrests to the target person by their Roblox username. TODO: provide warrant status, recently owned vehicle, and last known location.
* **MDT Incident Search&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/mdt search incident <incident-num:Number>` \
  **Ephemeral:** Yes\
  **Description:** Returns the incident report information formatted and organized in an embed. This command is used in-case wanted to avoid going through a bunch of records in the log channel and get the details straight forward.
* **MDT Citation Search&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/mdt search citation <citation-num:Number>` \
  **Ephemeral:** Yes\
  **Description:** Returns information regarding a logged notice to appear citation in the database just by its number, date, or other details.
* **MDT Arrest Search&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/mdt search arrest <booking-num:Number>` \
  **Ephemeral:** Yes\
  **Description:** Returns information regarding a logged arrest in the database just by the booking number.
* **Officer Activity&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/activity for <officer:User> [since:DateTime] [private:Boolean]` \
  **Ephemeral:** Optional\
  **Description:** Provides activity information for a certain officer (server member), detailing their total shift time, arrests, citations, and reported incidents. The `since` parameter is optional and can be used to specify the timeframe for the activity data requested.
* **Activity Report&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/activity report <since:DateTimeText> [time-requirement:Time] [shit-type:Text] [include-nicknames:Boolean] [private:Boolean]` \
  **Ephemeral:** Optional\
  **Description:** Provides an online-accessible Google Spreadsheet file that details each officer's total shift time, arrests made, arrests assisted, citations issued, quota completion status, and other relevant information.



***

### Shift Management Module

* **Duty Manage&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/duty manage [type:Text]` \
  **Ephemeral:** No\
  **Description:** Command to manage own shift with an optional parameter for specifying the shift type to manage. If no shift type is provided, the command will default to the server's preset type, or if unavailable, the `Default` shift type will be used.
* **Duty Active&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/duty active [type:Text]` \
  **Ephemeral:** Data-based\
  **Description:** Displays all personnel whose shifts are presently active, including their current duration on duty.
* **Duty Void&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/duty void` \
  **Ephemeral:** Yes\
  **Description:** Voids and deletes the currently active shift for the one who is executing the command. It would log a shift void execution and will not delete any logs for that shift but only delete it from database records.
* **Duty Leaderboard&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/duty leaderboard [type:Text]` \
  **Ephemeral:** No\
  **Description:** Lists all staff members who have shift time for exact shif type or for all shift types with their time in descending order. Members who are considered staff but do not have shift time are disregarded from the list.
* **Duty End All&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/duty end-all [type:Text]` \
  **Ephemeral:** No\
  **Description:** Forcefully end all currently active shifts, under specific shift type if needed.
* **Duty Import&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/duty import <leaderboard-file:Attachment> [shift-type:Text]` \
  **Ephemeral:** Yes\
  **Description:** Forcefully end all currently active shifts, under specific shift type if needed.
* **Duty Admin&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/duty admin <member:User> [type:Text]` \
  **Ephemeral:** No (with exceptions to certain features/prompts)\
  **Description:** Command to manage and administer the duty shift of somebody else. This includes ending a shift on behalf of the target member, deleting a certain shift record, listing all shift records, and other options.
* **Duty Types&#x20;**<mark style="color:green;">**(\*)**</mark>
  * **Duty Types View**\
    **Command:** `/duty types view` \
    **Ephemeral:** Yes\
    **Description:** Shows all created shift types within the server; other than the default application shift type.
  * **Duty Type Create**\
    **Command:** `/duty types create <name:Text> [default:Boolean]` \
    **Ephemeral:** No\
    **Description:** Returns a prompt to create a duty shift type with the provided name and make it the default for the server if specified.
  * **Duty Type Delete**\
    **Command:** `/duty types delete <name:Text>` \
    **Ephemeral:** No\
    **Description:** Returns a prompt to delete a duty shift type with the provided name and make it inaccessible for usage by staff members.



***

### Leave Notices Module

* **Leave of Absence Request&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/loa request <duration:TimeDurationText> <reason:Text>` \
  **Ephemeral:** Yes\
  **Description:** Submits a leave of absence request for certain duration with provided reason.
* **Leave of Absence Manage&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/loa manage` \
  **Ephemeral:** Yes\
  **Description:** Shows the leave of absence data and status for the one who runs the command. If applicable, prompts a way to cancel a leave or leave extension request that hasn't been reviewed yet by management staff.
* **Leave of Absence Listing&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/loa list [status: "Active" or "Pending"]` \
  **Ephemeral:** No\
  **Description:** Displays the server's leave of absence records with a specified status. The default behavior is to show active leave notices if any.
* **Leave of Absence Administration&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/loa admin <member:User>` \
  **Ephemeral:** No\
  **Description:** Provides the ability to manage and administer other members' leave of absence, including placing somebody on a leave without making them request one, early end a leave of absence, and approving or denying a request.



***

### Reduced Activity Module

* **Reduced Activity Request&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/ra request <duration:TimeDurationText> <quota-reduction:Integer> <reason:Text>` \
  **Ephemeral:** Yes\
  **Description:** Submits a reduced activity request for certain duration with provided details.
* **Reduced Activity Manage&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/ra manage` \
  **Ephemeral:** Yes\
  **Description:** Shows current and previous RAs for the person who initiates the command; same behavior to leave of absence manage.
* **Reduced Activity Listing&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/ra [status: "Active" or "Pending"]` \
  **Ephemeral:** No\
  **Description:** Same behavior as LoA listing.
* **Reduced Activity Administration&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/ra admin <member:User>` \
  **Ephemeral:** No\
  **Description:** Same behavior as LoA administration with additional part of quota reduction.



***

### Duty Activities Module

* **Log Incident&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/log incident <type:Text> <status:Text> <location:Text>` \
  **Ephemeral:** Yes (Prompt)\
  **Description:** Allows staff members to log any incident that occurred during their shift for later review or reference.
* **Log Warning Citation&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/log citation-warning <name:Text> <gender: "Male" or "Female"> <age:Text> <height:Text> <weight:Number> <eye-color:Text> <hair-color:Text> <license-num:Number> <commercial-lic:Boolean> <vehicle-plate:Text> <vehicle-model:Text> <vehicle-color:Text> [nta-type:Text] [vehicle-commercial:Boolean] [vehicle-hazardous:Boolean] [speed-approx:Number] [speed-limit:Number] [vehicle-limit:Number] [weather:Text] [traffic:Text] [surface:Text] [travel-dir:Text] [involved-accident:Boolean]` \
  **Ephemeral:** Yes (Prompt)\
  **Description:** Allows staff members to log warning citations they issue, including detailed information about the violator and the incident. The command supports autocompletion for several parameters to streamline data entry.
* **Log Fine Citation&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/log citation-fine <name:Text> <fine-amount:Number> <gender: "Male" or "Female"> <age:Text> <height:Text> <weight:Number> <eye-color:Text> <hair-color:Text> <license-num:Number> <commercial-lic:Boolean> <vehicle-plate:Text> <vehicle-model:Text> <vehicle-color:Text> [nta-type:Text] [vehicle-commercial:Boolean] [vehicle-hazardous:Boolean] [speed-approx:Number] [speed-limit:Number] [vehicle-limit:Number] [weather:Text] [traffic:Text] [surface:Text] [travel-dir:Text] [involved-accident:Boolean]` \
  **Ephemeral:** Yes (Prompt)\
  **Description:** Allows staff members to log the fines they issue while being on-duty so it can be accessible later on. Nearly the same as the`/log citation-warning` command.
* **Log Arrest&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/log arrest <name:Text> <gender: "Male" or "Female"> <arrest-age:Integer> <height:Text> <weight:Integer>` \
  **Ephemeral:** Yes (Prompt)\
  **Description:** Allows staff members to log the arrests they make while being on-duty.



***

### Utility and Miscellaneous Commands

* **Login&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/log-in <username:Text>` \
  **Ephemeral:** Yes\
  **Description:** Allows staff members to link their Roblox accounts so that they be able to utilize certain commands.
* **Logout&#x20;**<mark style="color:blue;">**(\*)**</mark>\
  **Command:** `/log-out` \
  **Ephemeral:** Yes\
  **Description:** If already linked, unlinks the Roblox account for the one executing the command.
* **Reverse Search&#x20;**<mark style="color:green;">**(\*)**</mark>\
  **Command:** `/reverse-search <roblox-username:Text> [ephemeral:Boolean]` \
  **Ephemeral:** Optional\
  **Description:** Shows who have the Roblox account with that specified username linked to their Discord account.
* **Server Data Management&#x20;**<mark style="color:yellow;">**(\*)**</mark>\
  **Command:** `/server-data manage` \
  **Ephemeral:** No\
  **Permission:** The `Manage Server` permission is required to be able to execute this command.\
  **Description:** Manage logged server data, including shift and leave of absence records.
* **Configuration&#x20;**<mark style="color:yellow;">**(\*)**</mark>\
  **Command:** `/config` \
  **Ephemeral:** No\
  **Permission:** Executing this command requires the `Manage Server` permission.\
  **Description:** Update or modify application settings.
* **Member Roles**
  * **Backup&#x20;**<mark style="color:green;">**(\*)**</mark>\
    **Command:** `/member-roles backup <member:User> [reason:Text]` \
    **Ephemeral:** Yes\
    **Description:** Saves and backups all currently assigned roles for a member. Useful when planning to revoke the assignment or deassignment of some roles automatically by one command.
  * **View&#x20;**<mark style="color:green;">**(\*)**</mark>\
    **Command:** `/member-roles view <member:User> <save:Text> [private:Boolean]` \
    **Ephemeral:** Optional\
    **Description:** Shows details about a backup/save made.
  * **List&#x20;**<mark style="color:green;">**(\*)**</mark>\
    **Command:** `/member-roles list <member:User>` \
    **Ephemeral:** Optional\
    **Description:** Lists all past backups or saves for a member.
  * **Delete&#x20;**<mark style="color:green;">**(\*)**</mark>\
    **Command:** `/member-roles delete <member:User> <save:Text>` \
    **Ephemeral:** No\
    **Description:** Deletes and removes a backup or save record from the database.
  * **Load&#x20;**<mark style="color:yellow;">**(\*)**</mark>\
    **Command:** `/member-roles load <member:User> <save:Text>` \
    **Ephemeral:** No\
    **Permissions:** User required permissions are `Manage Server` and `Manage Roles`.\
    **Description:** Assigns previously saved roles to a member. This command would not remove any unsaved roles and will keep it assigned.
* **Member Nicknames**
  * **Nicknames Search&#x20;**<mark style="color:blue;">**(\*)**</mark>\
    **Command:** `/nicknames search <regex:Text> [flags:Text] [ephemeral:Boolean]` \
    **Ephemeral:** Optional\
    **Description:** Lists all members whose nicknames match the specified ECMAScript regular expression.
  * **Nicknames Replace&#x20;**<mark style="color:red;">**(\*)**</mark>\
    **Command:** `/nicknames replace <regex:Text> <replacement:Text> [flags:Text] [role-filter:Role]`\
    **Ephemeral:** No\
    **Description:** Provides the ability to change and modify the nicknames of all matching members at once based on an ECMAScript regular expression and replacement text or expression.\




***

## Context Menu Commands

### Update Incident Report <mark style="color:yellow;">(\*)</mark>

**Ephemeral:** Yes\
**Permissions:** Regular staff can execute this command if they reported the incident. All management staff can execute it regardless of who reported the incident.\
**Description:** Allows users to edit and update specific details in a submitted incident report.

### Delete Incident Report <mark style="color:green;">(\*)</mark>

**Ephemeral:** Yes\
**Description:** Enables deletion of an incident report from the database. The incident report message remains and should be manually removed by management staff if wanted.
