# Azure AD B2C Setup Guide

## Step 1: Create Azure AD B2C Tenant

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource** > Search **"Azure Active Directory B2C"**
3. Click **Create a new Azure AD B2C Tenant**
4. Fill in:
   - **Organization name**: `Beacon`
   - **Initial domain name**: `beaconauth` (becomes `beaconauth.onmicrosoft.com`)
   - **Country/Region**: Your region
5. Click **Review + Create** > **Create**

## Step 2: Register an Application

1. Switch to your B2C tenant (top-right dropdown)
2. Go to **Azure AD B2C** > **App registrations** > **New registration**
3. Fill in:
   - **Name**: `Beacon Web App`
   - **Supported account types**: Accounts in any identity provider or organizational directory
   - **Redirect URI**: 
     - Type: `Web`
     - URL: `https://<your-static-web-app>.azurestaticapps.net/.auth/login/aadb2c/callback`
4. Click **Register**
5. Note down the **Application (client) ID**

## Step 3: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `Beacon SWA Secret`
4. Expiry: Choose appropriate duration
5. Click **Add**
6. **Copy the secret value immediately** (you won't see it again)

## Step 4: Create User Flow (Sign-up and Sign-in)

1. Go to **Azure AD B2C** > **User flows**
2. Click **New user flow**
3. Select **Sign up and sign in** > **Recommended**
4. Fill in:
   - **Name**: `signupsignin` (becomes `B2C_1_signupsignin`)
   - **Identity providers**: Check **Email signup**
   - **User attributes**: Select:
     - Email Address (Collect and Return)
     - Display Name (Collect and Return)
5. Click **Create**

## Step 5: Configure Static Web App

1. Go to your Static Web App in Azure Portal
2. Go to **Configuration** > **Application settings**
3. Add these settings:
   - `AADB2C_CLIENT_ID`: Your Application (client) ID
   - `AADB2C_CLIENT_SECRET`: Your client secret value

## Step 6: Update staticwebapp.config.json

Replace the placeholder values in your `staticwebapp.config.json`:

```json
"wellKnownOpenIdConfiguration": "https://beaconauth.b2clogin.com/beaconauth.onmicrosoft.com/B2C_1_signupsignin/v2.0/.well-known/openid-configuration"
```

Replace:
- `beaconauth` with your tenant name
- `B2C_1_signupsignin` with your user flow name

## Step 7: Add Redirect URI

1. Go back to your App registration
2. Go to **Authentication**
3. Add redirect URI for local development (optional):
   - `http://localhost:4280/.auth/login/aadb2c/callback`

## Testing

Once deployed, users can:
1. Click **Sign In** on the login page
2. Azure AD B2C shows email/password form
3. New users can register with email
4. Existing users can sign in
5. On success, redirected to `/dashboard`

## User Flow URL Format

```
https://<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/<policy>/v2.0/.well-known/openid-configuration
```

Example:
```
https://beaconauth.b2clogin.com/beaconauth.onmicrosoft.com/B2C_1_signupsignin/v2.0/.well-known/openid-configuration
```

