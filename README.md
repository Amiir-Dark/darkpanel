<p align="center">
  <a href="https://github.com/Amiir-Dark/darkpanel" target="_blank" rel="noopener noreferrer">
    <img width="140" height="140" src="./dashboard/src/assets/logo.svg" alt="DarkPanel logo">
  </a>
</p>

<h1 align="center">DarkPanel</h1>

<p align="center">
  Unified GUI Censorship Resistant Solution Powered by <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

---

# Installation Guide

### 1. Install DarkPanel (Master Server)

Run the following command on your server to install DarkPanel:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/rebecca/rebecca-binary.sh | sudo bash -s -- install
```

> **Note:** Always pipe the script into `sudo bash -s --` as shown above. Do not use `sudo bash -c "$(curl ...)"` to prevent argument list length errors on Linux.

For the **development channel**, use:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/dev/scripts/rebecca/rebecca-binary.sh | sudo bash -s -- install --dev
```

---

### 2. Install DarkPanel Node (Optional / Multi-Server)

To connect additional node servers, run the node binary installer on each node:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/rebecca/rebecca-node-binary.sh | sudo bash -s -- install
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
rebecca cli admin create --role sudo
```

*(or `--role full_access` for full administrative access)*

#### Non-interactive one-line command:
You can pass the username and password directly:

```bash
rebecca cli admin create YOUR_USERNAME --role sudo --password YOUR_PASSWORD
```

For super-admin with full access:

```bash
rebecca cli admin create YOUR_USERNAME --role full_access --password YOUR_PASSWORD
```

#### Admin Roles Explained:
- `--role sudo`: Sudo administrator with rights to manage users, nodes, and configurations.
- `--role full_access`: Super administrator with full authority, including creating and editing other full-access admins.

> **Tip:** If you ever need to change or promote an existing admin's role, run:
> ```bash
> rebecca cli admin change-role --username YOUR_USERNAME --role full_access
> ```

---

### Service Management Commands

Manage your DarkPanel service using the built-in CLI:

```bash
rebecca status     # Check panel status
rebecca restart    # Restart panel service
rebecca logs       # View live panel logs
rebecca cli --help # CLI commands and options
rebecca help       # Control center menu
```
