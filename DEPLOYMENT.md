# Beacon Deployment Guide

This document provides step-by-step instructions for deploying the **Beacon** application to Azure.

## 1. Prerequisites

Before you begin, ensure you have:
*   A **GitHub** repository containing the source code.
*   An **Azure** subscription with permissions to create resources.
*   A **Twilio** account with a purchased phone number (E.164 format).

---

## 2. Azure Resource Setup

### A. Create Azure Cosmos DB (NoSQL)
1.  In the Azure Portal, create a new **Azure Cosmos DB for NoSQL** account.
    *   **Tip**: If you are using the **Free Tier**, make sure to check the box "Apply Free Tier Discount".
2.  Once created, navigate to the **Data Explorer**.
3.  Create a database named `beacon`.
    *   **Free Tier Recommended**: Check **Share throughput across containers**. 
    *   Set the throughput to **400** (Autoscale or Manual). This ensures you stay well within the 1000 RU/s free limit even with multiple containers.
4.  Create the following containers inside the `beacon` database (leave "Provision dedicated throughput for this container" **unchecked**):
    *   `users`: Set Partition Key to `/id`.
    *   `incidents`: Set Partition Key to `/id`.
    *   `schedule`: Set Partition Key to `/id`.
    *   `uptimeLogs`: Set Partition Key to `/id`. (Used for system events and error tracking).
    *   `monitors`: Set Partition Key to `/id` (Optional/Future use).

### B. Register Microsoft Entra ID (Azure AD) Application
1.  Go to **Microsoft Entra ID** -> **App registrations** -> **New registration**.
2.  **Name**: `Beacon Auth`.
3.  **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts.
4.  **Redirect URI**: Select **Web** and enter `https://<your-static-web-app-url>/.auth/login/aad/callback`.
    *   *Note: If you haven't created the Static Web App yet, you can add this later.*
5.  After registration, copy the **Application (client) ID**.
6.  Go to **Certificates & secrets** -> **New client secret**.
    *   Add a description and expiry.
    *   **Important**: Copy the secret **Value** immediately; it will be hidden later.

### C. Create Azure Static Web App (SWA)
1.  Search for **Static Web Apps** in the Azure Portal and click **Create**.
2.  Select your Subscription and Resource Group.
3.  **Deployment details**: Select **GitHub** and authorize Azure to access your repo.
4.  Select your **Repository** and **Branch**.
5.  **Build Details**:
    *   **Build Preset**: `Vite` (If not listed, select **Vue.js** or **Custom**)
    *   **App location**: `/`
    *   **Api location**: `api`
    *   **Output location**: `dist`
    *   *Note: "Vue.js" is a perfectly adequate preset for this project as both Vite and Vue CLI use the same output folder (`dist`).*
6.  Click **Review + Create**, then **Create**.
7.  Once deployed, copy the **URL** from the Overview page.
8.  **Important**: Return to your **Entra ID App Registration** (Step B.4) and update the Redirect URI with your actual SWA URL.

---

## 3. Configuration (Application Settings)

Azure Static Web Apps inject environment variables into the API via the **Configuration** blade.

1.  Navigate to your **Static Web App** in the Azure Portal.
2.  Under **Settings**, click on **Configuration**.
3.  Add the following **Application Settings**:

| Setting Name | Value Source |
| :--- | :--- |
| `COSMOS_CONNECTION_STRING` | Primary Connection String from Cosmos DB Account -> Keys |
| `AAD_CLIENT_ID` | Application (client) ID from Step 2.B.5 |
| `AAD_CLIENT_SECRET` | Client secret Value from Step 2.B.6 |
| `TWILIO_ACCOUNT_SID` | Found in your Twilio Console Dashboard |
| `TWILIO_AUTH_TOKEN` | Found in your Twilio Console Dashboard |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (e.g., `+1234567890`) |
| `COSMOS_DATABASE` | `beacon` (or your custom database name) |
| `COSMOS_CONTAINER_USERS` | `users` |
| `COSMOS_CONTAINER_INCIDENTS` | `incidents` |
| `COSMOS_CONTAINER_SCHEDULE` | `schedule` |

*Click **Save** after adding all settings.*

---

## 4. Post-Deployment: Initial Admin Setup

By default, new users are assigned the `user` role. To perform administrative tasks (managing schedules, escalating incidents), you must manually promote your user account.

1.  Open your deployed application URL.
2.  Click **Sign in with Microsoft** and complete the login.
3.  Go to the **Azure Portal** -> **Cosmos DB** -> **Data Explorer**.
4.  Navigate to `beacon` -> `users` -> **Items**.
5.  Find the record matching your email/ID.
6.  Edit the JSON to change `"role": "user"` to `"role": "admin"`.
7.  Click **Update**.
8.  **Sign out** and **Sign back in** to the application for the role change to take effect.

---

## 5. Verification & Testing

To ensure everything is working correctly:

1.  **Authentication**: Verify you can log in and see your name/email in the header.
2.  **On-Call**: Go to the **On-Call Schedule** tab and add yourself to a shift covering the current time.
3.  **Incident Reporting**:
    *   Report a **Medium** incident: Check the dashboard to see it listed.
    *   Report a **Critical** incident:
        *   You should receive an **SMS** notification.
        *   You should receive a **Phone Call**.
4.  **Acknowledgment**: During the phone call, press **1** when prompted. Verify the incident status changes to **Acknowledged** on the dashboard.
5.  **Escalation**: As an Admin, use the **Escalate** button on an open incident to trigger a fresh call to the on-call engineer.

---

## 6. Local Development Configuration

For local development, the application uses a `.env` file instead of the legacy `local.settings.json`.

1.  Navigate to the `api` folder.
2.  Create a file named `.env`.
3.  Add your development credentials:
    ```env
    COSMOS_CONNECTION_STRING=AccountEndpoint=...
    TWILIO_ACCOUNT_SID=AC...
    TWILIO_AUTH_TOKEN=...
    TWILIO_PHONE_NUMBER=+1...
    ```
4.  The centralized configuration in `api/shared/config.js` will automatically load these values.

---

## 7. Troubleshooting

*   **404 Not Found on API**: 
    *   Check the **Functions** blade in the Azure Portal. If you see no functions listed, your API was not deployed. Verify your **Api location** is set to `api` in your deployment settings.
    *   Ensure your `api` folder contains a `package.json` and `host.json`.
    *   Check your GitHub Actions logs for build errors in the API step.
*   **Empty User Database / Roles Not Working**:
    *   **SWA Plan Support**: This application automatically supports both the **Free** and **Standard** SWA plans. 
        *   On the **Standard** plan, roles are injected by the platform via the `get-roles` function.
        *   On the **Free** plan, the API manually looks up roles from your Cosmos DB, and the frontend specifically fetches these augmented roles via `/api/users?me=true`.
    *   **Internal Authorization**: All API endpoints perform their own role checks, so the application remains secure even on the Free Plan.
    *   **Auto-Provisioning**: Your user record is created in the `users` container the first time you make an API call (e.g., loading the dashboard).
    *   **Initial Admin**: Remember that you must still manually change your role from `user` to `admin` in the Cosmos DB Data Explorer to gain full access. Then **Sign Out and Sign In again**.
*   **Roles showing 'anonymous'**:
    *   This is perfectly normal. Azure Static Web Apps always includes `anonymous` and `authenticated` in the roles list for a logged-in user. Your custom roles (`admin`, `engineer`) will appear alongside them.
*   **Diagnostic Endpoint**:
    *   Once logged in, navigate to `https://<your-app-url>/api/debug`. This will show you which environment variables are being detected by the API (secrets are masked).
*   **Twilio Callbacks**: The application dynamically determines the callback URL using `process.env.WEBSITE_HOSTNAME`. No manual webhook configuration is required in the Twilio Console.
*   **Database Errors**: If the API returns a `503` error, check that `COSMOS_CONNECTION_STRING` is correctly set in the Configuration blade.
*   **Authentication Issues**: Ensure the Redirect URI in Entra ID matches your SWA URL exactly and ends with `/.auth/login/aad/callback`.
