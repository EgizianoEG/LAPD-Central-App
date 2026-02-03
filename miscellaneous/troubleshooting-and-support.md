---
icon: life-ring
---

# Troubleshooting and Support

## Clearance

The **LAPD Central** application is designed to offer clear, actionable error messages and informative responses directly within the app. This approach helps users understand and resolve most issues on the spot, ensuring proper use of all available features without needing to consult external documentation in most cases.

However, if you come across something unclear, unresolved, or missing — or if you simply need further clarification — please don’t hesitate to [reach out to us](../legal-section/privacy-policy.md#id-6.-contact-information) or contribute directly to the project. For more details on how to contribute, please refer to the [Contributing](contributing.md) page.

***

## Common Issues and Fixes

### Issue: The application did not respond.

If you receive a private message stating **"The application did not respond,"** it typically means one (or maybe more) of the following:

* **The application or the executed command is currently offline.**\
  This may occur if the app is not running in the server where the command was used, or if there is ongoing maintenance. If suspected downtime, you can check [the status page](https://lapd-central-app.betteruptime.com/) for further details.
* **LAPD Central failed to respond within Discord's 3-second timeout.**\
  This can happen due to service-side complications or if the operation being performed is unusually complex, delayed, or at worst case scenarios, rate-limited or bugged. A fix could be retrying the command execution again or at a later time.

### Issue: The application didn't assign or remove the configured role(s)

If you executed a command that should assign or remove specific roles (whether configured or stored as if related to member roles commands) and the application _didn't_ perform the action, the issue is likely due to one of the following reasons:

* **Missing permission**\
  The app requires the [**Manage Roles**](../getting-started/app-permissions.md#manage-roles) permission in the server to assign or remove roles. If this permission is missing, the action (and may cause the command to) cannot succeed.
* **Role Hierarchy Limitation**\
  The application _does_ have the **Manage Roles** permission, _but_ its highest role is at the same level or **below** the target role(s) it needs to assign or remove. In Discord, a bot/app can only manage roles that are positioned **below** its own highest role in the server’s role hierarchy.

For further details, see [Discord Roles and Permissions guide](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions).

