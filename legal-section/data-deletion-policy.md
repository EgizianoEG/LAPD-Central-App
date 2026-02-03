---
icon: shredder
layout:
  width: wide
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

{% hint style="warning" %}
### Compliance Update (Effective Feb 2026)

We are currently upgrading our systems to support the Automated Deletion and Anonymization features described in this policy.

* Current Status: Manual deletion requests are fully supported immediately. Please contact support if you need data removal today.
* Target Completion: The automated systems (including the 3-day grace period and self-service `/preferences` command) are being deployed and will be fully operational by February 17, 2026.

_This policy reflects our standard operating procedures once this maintenance window is complete._
{% endhint %}

## **1. Introduction**

This Data Deletion Policy outlines the procedures and timelines for deleting user and guild ("server") data within the LAPD Central application. The policy aims to comply with applicable data privacy laws, such as the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).

_This policy is subject to change to reflect updates in relevant legislation or our data handling practices. The terms 'guild' and 'server' are used here interchangeably._

***

## **2. Data Retention Periods**

### **Guild Data**

* Guild-specific data will be retained for <mark style="color:blue;">a period of 7 days</mark> from the last time the application was active or installed in the guild.
* After this retention period, all guild data, including configurations, member information, and other related records, will be permanently deleted.

### **User Data**

We categorize user data into two types: **Personal Profile Data** and **Operational Data**.

**1. Personal Profile Data (Subject to Auto-Deletion)**\
This includes your personal settings, configuration preferences, and individual save states within a specific guild.

* **Automatic Deletion:** If you leave a guild, this personal profile data enters a **3-day retention grace period**.
* If you do not return within 3 days, this profile data is **permanently deleted** from our active database.
* **Manual Deletion:** You can request immediate deletion via the `/preferences` command or by contacting support.

**2. Operational Data (Retained by Default)**\
This includes records essential to the guild's operations (e.g., **Shift Logs, LOAs, Citations, Arrest Reports**).

* **Retention:** This data is **NOT automatically deleted** when you leave a guild, as it is required for the guild's statistics and history.
* **Anonymization Right:** You may request to have your identity scrubbed from our database. Your Discord ID and Name will be replaced with a generic placeholder (e.g., **"Former Member"**) in all future command outputs and database queries.

{% hint style="warning" %}
**Important Limitation: Discord chat logs**\
The LAPD Central application often generates Discord messages (logs) in server channels when actions occur.

We cannot retroactively edit, delete, or anonymize these static chat messages sent to Discord channels. Once a log message is sent, it becomes the property of the Discord server.

Our anonymization process applies only to the data stored in our application's database. If you want old chat messages removed, contact the server administrators of that guild.
{% endhint %}

***

## **3. Data Deletion Procedures**

1. **Automated Deletion**
   1. **Guild Data:** Deleted automatically after <mark style="color:$primary;">7 days</mark> (based on the retention rules in Section 2).
   2. **Personal Profile Data:** Deleted automatically after <mark style="color:$primary;">3 days</mark> if you leave a guild and do not return.
2. **User Requests**
   1. **Personal Profile Data:** Request immediate deletion via `/preferences` or by contacting support.
   2. **Operational Data:** Request anonymization if you want your identity removed from guild records.

You can contact us as outlined in the [Privacy Policy](privacy-policy.md#id-6.-contact-information) page.

***

## **4. Data Backup and Archiving**

* For security and disaster recovery purposes, we may retain a backup of deleted data for a maximum of 30 days.
* All backup data is stored as securely as possible and is subject to the same strict data protection measures as active data.
