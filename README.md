# GCManager - SaaS Multi-Tenant para Kioscos y Maxikioscos 🚀

Sistema integral de gestión de Puntos de Venta (POS), control de stock, clientes con libreta de fiados (cuentas corrientes), proveedores y **facturación electrónica ARCA (ex-AFIP)** con CAE y QR fiscal reglamentario.

Diseñado con arquitectura **Multi-Tenant (base de datos PostgreSQL compartida con aislamiento por subdominio)** optimizado para escalar a carteras de 600+ comercios minoristas bajo suscripción SaaS.

---

## 📁 Estructura del Proyecto

```text
gcmanager/
├── docker-compose.yml              # Orquestador Docker (DB, Backend, Frontend Nginx)
├── .env.example                    # Variables de entorno de referencia
├── database/
│   ├── 01-schema.sql               # Esquema DDL de PostgreSQL con aislamiento multi-tenant
│   └── 02-seed.sql                 # Datos iniciales realistas (comercios, usuarios, productos, fiados)
├── backend/
│   ├── Dockerfile                  # Imagen Node.js 20 optimizada (Non-root user)
│   ├── package.json
│   └── src/
│       ├── index.js                # Servidor Express, CORS, Morgan, Healthcheck
│       ├── config/                 # Conexión DB Pool PostgreSQL
│       ├── middleware/             # Resolución de Subdominio/Tenant y Autenticación JWT
│       ├── modules/
│       │   ├── pos/                # Motor de ventas mostrador, atajos, ticket térmico
│       │   ├── arca/               # Servicio de Facturación Electrónica ARCA (AFIP)
│       │   ├── caja/               # Turnos, aperturas, retiros y arqueo de caja
│       │   ├── productos/          # ABM productos, stock, lector de código de barras
│       │   ├── clientes/           # ABM clientes y cuentas corrientes ("fiados")
│       │   ├── proveedores/        # ABM proveedores y recepción de stock
│       │   └── reportes/           # Dashboard y resumen de comprobantes emitidos
│       └── utils/
│           ├── arcaFiscalQr.js     # Generador de QR fiscal RG 4291/2018
│           └── ticketPrinter.js    # Formateador de tickets térmicos 58mm/80mm
├── frontend/
│   ├── Dockerfile                  # Servidor Nginx Alpine
│   ├── nginx.conf                  # Proxy reverso transparente hacia la API
│   ├── index.html                  # Interfaz POS táctil + Teclado + Panel de control
│   ├── style.css                   # Diseño moderno, responsivo y modo impresión térmica
│   └── app.js                      # Controlador SPA, atajos de teclado y selector de tenant
└── docs/
    ├── CREDENCIALES_PRUEBA.md      # Usuarios, contraseñas y guía paso a paso de pruebas
    └── DEVSECOPS_PROXMOX_CLOUDFLARE.md # Despliegue en Proxmox, Cloudflare Tunnel y Oracle VPS
```

---

## ⚡ Inicio Rápido con Docker en WSL Ubuntu

En tu terminal de **WSL Ubuntu**:

```bash
# 1. Navegar a la carpeta del proyecto
cd /mnt/c/dev/gcmanager

# 2. Levantar el stack completo en una red aislada
docker compose up -d --build

# 3. Comprobar que los servicios estén activos
docker compose ps
```

Abre tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Credenciales de Prueba

| Comercio (Tenant) | Usuario | Contraseña | Rol | CUIT |
| :--- | :--- | :--- | :--- | :--- |
| **Kiosco San Martín** (`kiosco-central`) | `cajero@kiosco.com` | `cajero123` | Cajero (Turno Abierto) | `30-71234567-8` |
| **Kiosco San Martín** (`kiosco-central`) | `admin@kiosco.com` | `admin123` | Administrador | `30-71234567-8` |
| **Maxikiosco 24hs** (`maxikiosco-24`) | `admin@maxi24.com` | `admin123` | Administrador | `30-79876543-2` |

---

## 🛠️ Funcionalidades Clave

1. **POS Ultrarrápido de Kiosco:**
   * Soporte directo para lectores de código de barras (USB / Bluetooth).
   * Atajos de teclado: **F12** (Cobro rápido), **Esc** (Vaciar/Cerrar).
   * Teclado numérico en pantalla para pantallas táctiles.
2. **Facturación Fiscal ARCA (ex-AFIP):**
   * Emisión de Facturas **A, B, C** y **Ticket X**.
   * Obtención automática de **CAE** y fecha de vencimiento.
   * Generación del **código QR reglamentario** oficial según Resolución General 4291/2018.
3. **Impresión de Tickets Térmicos:**
   * Formato adaptado a impresoras de **58mm y 80mm**.
   * Vista previa interactiva con QR fiscal incrustado y comando de impresión nativa.
4. **Módulo de "Fiados" (Cuentas Corrientes):**
   * Control de saldo adeudado por cliente y límite de crédito fijado.
   * Asentamiento de cobro parcial o total de la deuda que ingresa directamente al turno de caja.
5. **Control de Turnos y Arqueo de Caja:**
   * Apertura de turno con fondo inicial de cambio en billetes.
   * Registro de retiros/ingresos extra.
   * Arqueo ciego con detección de caja cuadrada, faltantes o sobrantes.
6. **Multi-Tenant Seguro:**
   * Cada comercio cuenta con su propio subdominio (`kiosco-central.tudominio.com`).
   * Aislamiento estricto por `tenant_id` en PostgreSQL.

---

## 📖 Documentación Adicional

* 🧪 [Guía de Pruebas y Casos de Uso](file:///c:/dev/gcmanager/docs/CREDENCIALES_PRUEBA.md)
* 🛡️ [Guía DevSecOps: Proxmox VPS, Cloudflare Tunnel y Oracle Cloud](file:///c:/dev/gcmanager/docs/DEVSECOPS_PROXMOX_CLOUDFLARE.md)
