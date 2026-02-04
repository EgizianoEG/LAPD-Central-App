---
icon: shredder
layout:
  width: default
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: true
---

# Data Deletion Policy

## **1. Introduction**

This Data Deletion Policy outlines the procedures and timelines for deleting user and guild ("server") data within the LAPD Central application. The policy aims to comply with applicable data privacy laws, such as the General Data Protection Regulation ([GDPR](https://gdpr-info.eu/)) and the California Consumer Privacy Act ([CCPA](https://oag.ca.gov/privacy/ccpa)).

_This policy is subject to change to reflect updates in relevant legislation or our data handling practices. The terms 'guild' and 'server' are used here interchangeably._

***

## **2. Data Retention Periods**

### **A. Guild Data**

* [Guild-specific data](#user-content-fn-1)[^1] will be retained for **7 days** from the last time the application was active or installed in the guild.
* After this retention period, all guild data, including configurations, member information, and other related records, will be permanently deleted.

### **B. User Data**

We categorize user data into two types: **Personal Profile Data** and **Operational Data**.

#### **I. Personal Profile Data (Subject to Auto-Deletion)**

This includes your personal settings, configuration preferences, and individual save states within a specific guild.

*   **Automatic Deletion**

    If you leave a guild, this personal profile data enters a **3-day retention grace period**. If you do not return within 3 days, this profile data is **permanently deleted**.
*   **Manual Deletion**

    You can request immediate deletion via the /preferences command or by contacting support.

#### **II. Operational Data (Retained & Anonymizable)**

This includes records essential to the guild's operations, such as:

* Shift logs and duty time records
* Leave of Absence (LOA) and Reduced Activity (RA) notices
* Citations, Arrest Reports, and Incident Reports
* Call sign assignment history
* Member role snapshots (for role restoration)

**Retention:**\
This data is **NOT automatically deleted** when you leave a guild, as it is required for the guild's operational statistics and historical records.

**Anonymization Right:**\
You may request to have your identity removed from these records. Your Discord ID and username will be replaced with **anonymized placeholders** (e.g., `anon_a3f2b`) in all database records and future command outputs. This process is **irreversible**.

**What Gets Anonymized:**

* Your Discord ID → Anonymous identifier
* Your username and nickname → Generic placeholder
* Personal reasons (LOA/RA requests, call sign requests) → `[Reason redacted for privacy]`
* Your signatures on reports → `[Redacted]`

**Active Assignments:**\
When anonymization is requested, any active shifts, call sign assignments, or activity notices (LOA/RA) you hold will be **automatically ended and expired** to prevent operational conflicts.

**Server Safety Exemption:**\
Records used for moderation enforcement (such as role persistence for restricted members) are **not anonymized** when they pertain to you as the target member. This is necessary to maintain server security and is permitted under [GDPR Article 6(1)(f)](https://gdpr-info.eu/art-6-gdpr/) as a legitimate interest. However, if you were the [_administrator_](#user-content-fn-2)[^2] who created such a record, your identity as the creator will be anonymized.

{% hint style="warning" %}
#### **Important Limitation: Discord Chat Logs**

The LAPD Central application typically generates Discord messages (logs) in server channels when actions occur.

We **cannot** retroactively edit, delete, or anonymize these static chat messages sent to Discord channels. Once a log message is sent, it becomes the property of the Discord server.

Our anonymization process applies **only** to the data stored in our application's database. If you want old chat messages removed, contact the server administrators of that guild.
{% endhint %}

### C. Roblox Player Data (Fictional Roleplay Records)

When a Roblox user is named in arrest records, citations, or incident reports (e.g., as a suspect, witness, or victim), this data is classified as Game Content.

*   **Nature of Data:**

    These records are purely fictional and exist solely to support the roleplay scenario. They document in-game events and do not represent real-world legal history, violations, or personal character assessments.
*   **Retention & Integrity:**

    Roblox player identifiers (Usernames/IDs) within operational records are not subject to automated anonymization. These identifiers are essential to the guild's narrative history and the continuity of the roleplay experience (e.g., maintaining a consistent "criminal record" for a character).
* **Corrections & Disputes:**\
  As we cannot technically verify the ownership of third-party Roblox accounts, we cannot process removal requests for this data directly. If information is factually incorrect (e.g., wrong ID entered), please contact the Guild Administrators of the specific server to request a correction or redaction.

***

## **3. Data Deletion Procedures**

### **A. Automated Deletion**

1. **Guild Data:** Deleted automatically after <mark style="color:$warning;">7 days</mark>.
2. **Personal Profile Data:** Deleted automatically after <mark style="color:$warning;">3 days</mark> if you leave a guild and do not return.

### **B. User Requests**

Use the `/preferences` command to manage your data. Two options are available:

<mark style="color:$info;">Both options require confirmation by typing</mark> <mark style="color:$info;"></mark><mark style="color:$info;">**"I UNDERSTAND"**</mark> <mark style="color:$info;"></mark><mark style="color:$info;">and submitting to prevent accidental deletion.</mark>

<details>

<summary>Delete Profile Only</summary>

Removes your personal settings and preferences from the server. Operational history remains with your identity visible.

</details>

<details>

<summary>Delete &#x26; Anonymize History</summary>

Removes your profile _**and**_ replaces your identity across all operational records with anonymous placeholders.

</details>

**Deletion Scope:**

* **Within a Discord server:** Affects only that server's data.
* **In Direct Messages (DM):** Affects your data across **ALL servers** where you have records.

You can also contact us for manual assistance as outlined in the [Privacy Policy](privacy-policy.md#id-6.-contact-information).

***

## **4. Data Backup and Archiving**

* For security and disaster recovery purposes, we may retain a backup of deleted data for a maximum of 14 days.
* All backup data is stored securely and is subject to the same strict data protection measures as active data.

[^1]: Basically everything linked to the server.

[^2]: or moderator
