<p align="center">
  <a href="https://github.com/Amiir-Dark/darkpanel" target="_blank" rel="noopener noreferrer">
    <img width="160" height="160" src="./dashboard/src/assets/logo.svg" alt="DarkPanel logo">
  </a>
</p>

<h1 align="center">DarkPanel</h1>

<p align="center">
    Unified GUI Censorship Resistant Solution Powered by <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

<br/>
<p align="center">
  <a href="https://github.com/Amiir-Dark/darkpanel/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Amiir-Dark/darkpanel/build.yml?style=flat-square" />
  </a>
  <a href="https://github.com/Amiir-Dark/darkpanel/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Amiir-Dark/darkpanel?style=flat-square" />
  </a>
  <a href="https://github.com/Amiir-Dark/darkpanel/stargazers">
    <img src="https://img.shields.io/github/stars/Amiir-Dark/darkpanel?style=social" />
  </a>
</p>

<p align="center">
 <a href="./README.md">
 English
 </a>
 /
 <a href="./docs/README-fa.md">
 فارسی
 </a>
  /
  <a href="./docs/README-zh-cn.md">
 简体中文
 </a>
   /
  <a href="./docs/README-ru.md">
 Русский
 </a>
</p>

## Table of Contents

- [Overview](#overview)
  - [Why using DarkPanel?](#why-using-darkpanel)
    - [Features](#features)
- [Installation guide](#installation-guide)
- [Configuration](#configuration)
- [Donation](#donation)
- [License](#license)
- [Contributors](#contributors)

# Overview

DarkPanel is a proxy management tool that provides a simple and easy-to-use user interface for managing hundreds of proxy accounts powered by [Xray-core](https://github.com/XTLS/Xray-core) and built with a high-performance Go backend and modern React dashboard.

## Why use DarkPanel?

DarkPanel is user-friendly, feature-rich and reliable. It lets you create different proxies for your users without any complicated configuration. Using its built-in web UI, you can monitor, modify and limit users.

### Features

- Built-in **Modern Web UI** with dark mode & responsive layout
- Fully **REST API** backend
- **Multiple Nodes** support (for infrastructure distribution & scalability)
- Supports protocols **Vmess**, **VLESS**, **Trojan**, **Shadowsocks**, and **WireGuard**
- **Multi-protocol** for a single user
- **Multi-user** on a single inbound
- **Multi-inbound** on a **single port** (fallbacks support)
- **Traffic** and **expiry date** limitations
- **Periodic** traffic limit (e.g. daily, weekly, etc.)
- **Hardware ID (HWID)** and concurrent device connection limiter
- **Subscription link** compatible with **V2ray** _(such as V2RayNG, SingBox, Nekoray, etc.)_, **Clash** and **ClashMeta**
- Automated **Share link** and **QRcode** generator
- System monitoring and **traffic statistics**
- Advanced host sorting and inbound filtering
- Customizable xray configuration
- **TLS**, **REALITY**, and **ECH** support
- Integrated **Command Line Interface (CLI)**
- **Multi-language** support (English, فارسی, 简体中文, Русский)
- **Multi-admin** support with granular roles

# Installation guide

Install DarkPanel with the binary installer:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/rebecca/rebecca-binary.sh | sudo bash -s -- install
```

> **Note:** Do not run the installers with `sudo bash -c "$(curl ...)"`; the downloaded script can exceed Linux's single-argument limit and fail with `Argument list too long`. Always pipe the download into `sudo bash -s --` as shown above.

For the dev channel, use:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/dev/scripts/rebecca/rebecca-binary.sh | sudo bash -s -- install --dev
```

Install DarkPanel-node on each node server with the binary node installer:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/rebecca/rebecca-node-binary.sh | sudo bash -s -- install
```

The binary installers create native systemd services and automatically download the matching Linux release asset for the server architecture. The master installer supports SQLite, MySQL, and MariaDB through its install options; the node installer installs only the node runtime and connects it to the master through the certificate/token flow in the panel.

Once the installation is complete:

- You will see the logs that you can stop watching them by closing the terminal or pressing `Ctrl+C`
- The application files will be located at `/opt/rebecca`
- The configuration file can be found at `/opt/rebecca/.env` (refer to [configurations](#configuration) section to see variables)
- The data files will be placed at `/var/lib/rebecca`
- For security reasons, the DarkPanel dashboard is not accessible via IP address directly by default. Therefore, you must obtain an SSL certificate and access your DarkPanel dashboard by navigating to `https://YOUR_DOMAIN:8000/dashboard/` (replace YOUR_DOMAIN with your actual domain).
- You can also use SSH port forwarding to access the DarkPanel dashboard locally without a domain. Replace `user@serverip` with your actual SSH username and server IP and run:

```bash
ssh -L 8000:localhost:8000 user@serverip
```

Then open the link in your browser:

```
http://localhost:8000/dashboard/
```

Next, create a sudo admin for logging into the DarkPanel dashboard by running:

```bash
rebecca cli admin create --role full_access
```

That's it! You can now login to your dashboard using these credentials.

> **Full access admins** can only be created by another full access admin from the dashboard or by using the on-box `rebecca cli`.  
> If you ever need to promote an existing sudo admin, run:  
> `rebecca cli admin change-role --username YOUR_ADMIN --role full_access`

To see the help message of the CLI tool, run:

```bash
rebecca --help
```

If you are eager to run the project using the source code, check the section below
<details markdown="1">
<summary><h3>Manual install (advanced)</h3></summary>

Install xray on your machine

You can install it using [Xray-install](https://github.com/XTLS/Xray-install)

```bash
curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh | bash -s -- install
```

Clone this project and build the dashboard and Go binaries:

```bash
git clone https://github.com/Amiir-Dark/darkpanel.git
cd darkpanel
cd dashboard
npm ci
VITE_BASE_API=/api/ npm run build -- --outDir=build --assetsDir=statics
cp ./build/index.html ./build/404.html
cd ..
bash scripts/build_binary.sh
```

Then run the following command to run the Go database migrations:

```bash
./dist/rebecca-cli migrate up
```

Downgrade migrations are not supported. Check the migration status with
`./dist/rebecca-cli migrate status` before upgrading a legacy database.

If you want to use the CLI globally, install the built Go CLI:

```bash
sudo install -m 755 ./dist/rebecca-cli /usr/local/bin/rebecca
rebecca cli --help
```

Now it's time to configuration

Make a copy of `.env.example` file, take a look and edit it using a text editor like `nano`.

You probably like to modify the admin credentials.

```bash
cp .env.example .env
nano .env
```

> Check [configurations](#configuration) section for more information

Eventually, launch the application using command below:

```bash
./dist/rebecca-server
```

For source/manual installs, create a systemd unit that runs the Go server binary:

```ini
[Unit]
Description=Rebecca
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/rebecca
EnvironmentFile=/opt/rebecca/.env
ExecStart=/opt/rebecca/dist/rebecca-server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rebecca
```

To use with nginx

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location ~* /(dashboard|statics|sub|api|docs|redoc|openapi.json) {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

  # xray-core ws-path: /
  # client ws-path: /rebecca/me/2087
    #
  # All traffic is proxied through port 443, and sent to the xray port (2087, 2088, etc.).
  # The '/rebecca' in the location regex path can be changed to any value you like.
    #
  # /${path}/${username}/${xray-port}
  location ~* /rebecca/.+/(.+)$ {
        proxy_redirect off;
        proxy_pass http://127.0.0.1:$1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

or

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
  server_name  rebecca.example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

By default the app will be run on `http://localhost:8000/dashboard`. You can configure it by changing the `UVICORN_HOST` and `UVICORN_PORT` environment variables.
</details>

# Configuration

> You can set settings below using environment variables or placing them in `.env` file.

| Variable                                 | Description                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| SQLALCHEMY_DATABASE_URL                  | Database URL. The legacy name is still used by the Go runtime for compatibility.                                         |
| UVICORN_HOST                             | Public gateway bind host (default: `0.0.0.0`).                                                                           |
| UVICORN_PORT                             | Public gateway bind port (default: `8000`).                                                                              |
| UVICORN_SSL_CERTFILE                     | TLS certificate path for the Go gateway.                                                                                |
| UVICORN_SSL_KEYFILE                      | TLS private key path for the Go gateway.                                                                                |
| UVICORN_SSL_CA_TYPE                      | Certificate authority type used by install scripts (`public` or `private`).                                             |
| REBECCA_GATEWAY_ADDR                     | Optional full gateway listen address. Overrides `UVICORN_HOST`/`UVICORN_PORT`.                                          |
| REBECCA_NODE_OPERATIONS_POLL_INTERVAL    | Node operation queue polling interval.                                                                                   |
| REBECCA_USER_LIFECYCLE_INTERVAL          | User lifecycle review interval.                                                                                          |
| REBECCA_USER_USAGE_RESET_INTERVAL        | Periodic user usage reset interval.                                                                                      |
| REBECCA_USER_AUTODELETE_INTERVAL         | Expired/limited user auto-delete job interval.                                                                            |
| USERS_AUTODELETE_DAYS                    | Delete expired users after this many days. Negative values disable this feature.                                         |
| USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS | Whether auto-delete includes limited accounts.                                                                            |
| USERS_LIST_TIMEOUT_SECONDS               | Optional timeout for large user list queries. `0` disables the timeout.                                                  |
| REBECCA_CERT_BASE                        | Base directory for managed certificates.                                                                                  |
| REBECCA_CERTBOT_BIN                      | Optional Certbot executable override used by the SSL manager.                                                              |
| REBECCA_CONFIG_DIR                       | Configuration root included in full backup export/import.                                                                |

# Telegram integration

Telegram bot commands, reports, settings, and backup delivery are handled by the Go services and can be configured from the panel.

# Webhook notifications

Webhook notifications are handled by the Go event worker and can be configured from the panel.

# Donation

If you found Rebecca useful and would like to support its development, you can make a donation in one of the following crypto networks:

- TRON network (TRC20): `TGftLESDAeRncE7yMAHrTUCsixuUwPc6qp`
- ETH, BNB, MATIC network (ERC20, BEP20): `0x413eb47C430a3eb0E4262f267C1AE020E0C7F84D`
- TON network: `UQDNpA3SlFMorlrCJJcqQjix93ijJfhAwIxnbTwZTLiHZ0Xa`

Thank you for your support!

# License

Made in [Unknown!] and published under [AGPL-3.0](./LICENSE).

# Contributors

We ❤️‍🔥 contributors! If you'd like to contribute, please check out our [Contributing Guidelines](docs/CONTRIBUTING.md) and feel free to submit a pull request or open an issue.

Check [open issues](https://github.com/Amiir-Dark/darkpanel/issues) to help the progress of this project.

<p align="center">
Thanks to the all contributors who have helped improve DarkPanel:
</p>
<p align="center">
<a href="https://github.com/Amiir-Dark/darkpanel/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Amiir-Dark/darkpanel" />
</a>
</p>
<p align="center">
  Made with <a rel="noopener noreferrer" target="_blank" href="https://contrib.rocks">contrib.rocks</a>
</p>
