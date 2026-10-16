

<h1 align="center">DarkPanel</h1>

<p align="center">
  Unified GUI Censorship Resistant Solution Powered by <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

---

# Installation Guide

### 1. Install DarkPanel (Master Server)

Run the following command on your server to install DarkPanel:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/darkpanel/darkpanel-binary.sh | sudo bash -s -- install
```

> **Note:** Always pipe the script into `sudo bash -s --` as shown above. Do not use `sudo bash -c "$(curl ...)"` to prevent argument list length errors on Linux.

---

### 2. Install DarkPanel Node (Optional / Multi-Server)

To connect additional node servers, run the node binary installer on each node:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/darkpanel/darkpanel-node-binary.sh | sudo bash -s -- install
```

---

### 3. Access the Dashboard

- **Via Domain (Recommended):**  
  After setting up an SSL certificate, navigate to:  
  `https://YOUR_DOMAIN:8000/dashboard/`

- **Via SSH Tunnel (Local access without domain):**  
  Forward port 8000 to your local machine:
  ```bash
  ssh -L 8000:localhost:8000 user@serverip
  ```
  Then open in your browser:  
  `http://localhost:8000/dashboard/`

---

### 4. Create Admin Account

Next, create a sudo admin for logging into the DarkPanel dashboard by running:

#### Interactive mode (recommended):
This will prompt you for the username and password securely:

```bash
darkpanel cli admin create --role sudo
```

*(or `--role full_access` for full administrative access)*

#### Non-interactive one-line command:
You can pass the username and password directly:

```bash
darkpanel cli admin create YOUR_USERNAME --role sudo --password YOUR_PASSWORD
```

For super-admin with full access:

```bash
darkpanel cli admin create YOUR_USERNAME --role full_access --password YOUR_PASSWORD
```

#### Admin Roles Explained:
- `--role sudo`: Sudo administrator with rights to manage users, nodes, and configurations.
- `--role full_access`: Super administrator with full authority, including creating and editing other full-access admins.

> **Tip:** If you ever need to change or promote an existing admin's role, run:
> ```bash
> darkpanel cli admin change-role --username YOUR_USERNAME --role full_access
> ```

---

### Service Management Commands

Manage your DarkPanel service using the built-in CLI:

```bash
darkpanel status     # Check panel status
darkpanel restart    # Restart panel service
darkpanel logs       # View live panel logs
darkpanel cli --help # CLI commands and options
darkpanel help       # Control center menu
```

---

# Developer Guide / راهنمای توسعه‌دهنده

**Start here:** [`map.md`](map.md)

The project map (written in Persian) documents the full architecture: what each
folder and file is for, where all data and settings live (databases, env vars,
templates, certificates), how the main flows work (gateway, auth, migrations,
subscriptions, nodes, sales bot, dashboard), day-to-day commands, common
pitfalls, and suggested next steps.

Every new developer **must** read `map.md` before changing code, and
must keep it updated when adding files, folders, or features.

نقطه‌ی شروع هر توسعه‌دهنده: `map.md` — قبل از تغییر کد بخوانید و
بعد از هر تغییر مهم، به‌روزش کنید.
