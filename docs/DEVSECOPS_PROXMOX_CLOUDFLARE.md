# GCManager - Guía DevSecOps: Proxmox VPS, Cloudflare Zero Trust y Oracle Cloud

Esta guía detalla la arquitectura de despliegue para llevar GCManager desde pruebas locales a **Pre-producción en tu VPS Proxmox local** con **Cloudflare Tunnel (Zero Trust)**, y finalmente a **Producción en Oracle Cloud**.

---

## 🏗️ 1. Arquitectura de Red y Seguridad (DevSecOps)

```text
                                 [ Usuario / Kiosco ]
                                          │
                                   (HTTPS / TLS 1.3)
                                          ▼
                         [ Cloudflare Edge Network ]
                         - WAF (Web Application Firewall)
                         - Mitigación DDoS L7
                         - Wildcard SSL (*.tuapp.com)
                         - Zero Trust Access Policies
                                          │
                               (Túnel Seguro Saliente)
                                          ▼
                         [ cloudflared Tunnel Daemon ]
                                          │
    ┌────────────────────── Servidor VPS (Proxmox / Oracle) ──────────┐
    │                                                                │
    │   [ Docker Isolated Bridge: gcmanager-net ]                     │
    │   ┌────────────────┐    ┌─────────────────┐    ┌────────────┐  │
    │   │  Frontend Web  │───>│   Backend API   │───>│ PostgreSQL │  │
    │   │ (Nginx Alpine) │    │  (Node.js 20)   │    │ (PG 16 RLS)│  │
    │   └────────────────┘    └─────────────────┘    └────────────┘  │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
```

### Principios de Seguridad Aplicados
1. **Zero Open Ports (Sin puertos abiertos al router/internet):**
   * El túnel `cloudflared` establece una conexión **saliente** (outbound) hacia los servidores perimetrales de Cloudflare.
   * No necesitas abrir puertos `80` o `443` en tu router ni exponer tu IP pública residencial/datacenter.
2. **Contenedores sin privilegios (Non-Root):**
   * El backend corre bajo el usuario `USER node` en Linux.
3. **Aislamiento Multi-Tenant estricto:**
   * Todas las operaciones de datos validan `tenant_id` en el middleware y en la base de datos PostgreSQL.
4. **Protección de Datos Fiscales:**
   * Certificados `.crt` y claves privadas `.key` de ARCA se almacenan encriptados en base de datos.

---

## ☁️ 2. Despliegue en Pre-Producción (VPS Proxmox + Cloudflared)

### Paso 1: Clonar el repositorio en tu VPS Proxmox
```bash
git clone https://github.com/tu-usuario/gcmanager.git /opt/gcmanager
cd /opt/gcmanager
```

### Paso 2: Crear el archivo `.env` de pre-producción
```bash
cp .env.example .env
# Editar contraseñas seguras y JWT_SECRET
nano .env
```

### Paso 3: Instalar y Configurar Cloudflare Tunnel (`cloudflared`)
1. En el panel de **Cloudflare Zero Trust** (`one.dash.cloudflare.com`):
   * Ve a **Networks** > **Tunnels** > **Create a Tunnel**.
   * Elige tipo **Cloudflared**.
   * Asigna un nombre (ej: `proxmox-gcmanager`).
2. Copia el comando de instalación para Ubuntu/Debian que te da Cloudflare:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   sudo cloudflared service install <TUNNEL_TOKEN>
   ```
3. En la pestaña **Public Hostnames** de Cloudflare:
   * Agrega un Hostname:
     * **Subdomain:** `*` (Wildcard para soportar todos los subdominios de clientes: `kiosco1.tudominio.com`, `kiosco2.tudominio.com`).
     * **Domain:** `tudominio.com`
     * **Service Type:** `HTTP`
     * **URL:** `localhost:3000` (el puerto de Nginx de GCManager).

### Paso 4: Levantar el stack en Proxmox
```bash
docker compose up -d --build
```

---

## 🚀 3. Migración a Producción Definitiva (Oracle Cloud VPS)

Cuando completes las pruebas con los primeros comercios en Proxmox:

1. **Instancia en Oracle Cloud:**
   * Se recomienda una instancia Compute **Ampere A1 (ARM64)** o **AMD x86-64** (Ubuntu 22.04 o 24.04 LTS).
   * Instala Docker y Docker Compose plugin:
     ```bash
     sudo apt update && sudo apt install -y docker.io docker-compose-v2
     sudo systemctl enable --now docker
     ```
2. **Escalabilidad para 600 comercios:**
   * Agrega **PgBouncer** al `docker-compose.yml` para gestionar eficientemente hasta 1.000 conexiones concurrentes sin agotar la memoria de PostgreSQL.
   * Configura copias de seguridad automáticas diarias (`pg_dump`) hacia un Object Storage (S3 o Oracle Object Storage).
3. **Mantenimiento y Certificados ARCA:**
   * Cada uno de tus 600 comercios obtendrá su certificado digital emitido desde la web de ARCA mediante delegación del servicio `Facturación Electrónica` al CUIT de tu SaaS, permitiendo facturar automáticamente en su nombre sin requerir la clave fiscal personal del cliente en el día a día.
