# GCManager - Guía Rápida de Pruebas y Credenciales

Este documento contiene las credenciales de acceso, comercios de prueba precargados y los pasos de validación para probar el sistema en tu notebook con Docker desde WSL Ubuntu.

---

## 🚀 Cómo Iniciar el Entorno Local en WSL Ubuntu

Abre tu terminal de **WSL Ubuntu** y ejecuta:

```bash
# 1. Ingresar al directorio del proyecto (mapeado desde Windows)
cd /mnt/c/dev/gcmanager

# 2. Levantar todos los contenedores (PostgreSQL, Backend API y Frontend Nginx)
docker compose up -d --build

# 3. Verificar que los 3 contenedores estén "Up" y saludables
docker compose ps
```

Una vez levantado, abre tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

*(La API backend corre internamente en el puerto `4000` y está conectada transparentemente al frontend).*

---

## 🔑 Credenciales de Acceso Precargadas

El sistema precarga automáticamente 2 comercios (Tenants) y usuarios de prueba:

### Comercio 1: **Kiosco San Martín Centro** (Subdominio: `kiosco-central`)
* **CUIT:** `30-71234567-8`
* **Condición IVA:** Responsable Inscripto
* **Punto de Venta Fiscal:** 1
* **Usuarios:**
  * **Administrador:**
    * **Email:** `admin@kiosco.com`
    * **Contraseña:** `admin123`
    * **Rol:** Administrador (Acceso total)
  * **Cajero (Turno Abierto):**
    * **Email:** `cajero@kiosco.com`
    * **Contraseña:** `cajero123`
    * **Rol:** Cajero

### Comercio 2: **Maxikiosco 24 Horas Express** (Subdominio: `maxikiosco-24`)
* **CUIT:** `30-79876543-2`
* **Condición IVA:** Responsable Inscripto
* **Punto de Venta Fiscal:** 2
* **Usuario:**
  * **Email:** `admin@maxi24.com`
  * **Contraseña:** `admin123`
  * **Rol:** Administrador

---

## 🧪 Casos de Prueba y Validación Funcional

### Prueba 1: Venta Rápida en Mostrador (POS)
1. En la pestaña **"🛒 Punto de Venta (POS)"**, haz clic en cualquier alfajor o bebida, o tipea en el buscador: `77900401` y presiona **ENTER** (simula un lector de código de barras).
2. Verás que el producto se agrega instantáneamente al carrito de la derecha.
3. Presiona la tecla **`F12`** o haz clic en el botón verde **"COBRAR (F12)"**.
4. Deja seleccionada la opción **"💵 Efectivo"**, ingresa el monto con el que paga el cliente y observa el cálculo automático de **vuelto**.
5. Haz clic en **"Confirmar Venta e Imprimir Ticket"**.
6. Se abrirá la **Vista Previa del Ticket Térmico** (formato 58mm / 80mm). Haz clic en **"🖨️ Imprimir Ticket Térmico"** para ver el render de impresión nativa.

---

### Prueba 2: Facturación Electrónica ARCA (ex-AFIP) con CAE y QR Fiscal
1. Agrega productos al carrito y presiona **`F12`**.
2. En el desplegable **"Tipo de Comprobante"**, cambia de *Ticket X* a **"Factura B"** o **"Factura C"**.
3. Haz clic en **"Confirmar Venta"**.
4. Observa cómo el sistema:
   * Genera el **CAE oficial de 14 dígitos** y fecha de vencimiento a 10 días.
   * Genera el **código QR normativo de ARCA / AFIP** según RG 4291/2018.
   * Muestra el QR y los datos fiscales en el ticket impreso.
5. Puedes ir a la pestaña **"📄 Facturación ARCA (AFIP)"** para ver el libro de comprobantes emitidos y hacer clic en **"Verificar QR"**.

---

### Prueba 3: Gestión de Fiados (Cuentas Corrientes)
1. En el POS, agrega productos al carrito y presiona **`F12`**.
2. Elige el medio de pago **"📖 Fiado (Cta Cte)"**.
3. Selecciona el cliente: **Carlos Gómez (Vecino Taller)**. Verás su deuda actual precargada ($6.400,00) y su límite de crédito autorizado.
4. Confirma la venta.
5. Ve a la pestaña **"👥 Clientes & Fiados"**:
   * Observa cómo el saldo adeudado de Carlos Gómez se incrementó automáticamente con el total de la venta.
6. Haz clic en **"Cobrar Fiado"**:
   * Ingresa un pago parcial (ej: `$2.000,00`) en efectivo.
   * Confirma.
7. Ve a la pestaña **"💵 Turnos y Arqueo de Caja"**:
   * Observa cómo los `$2.000,00` cobrados del fiado entraron a la caja registradora del turno actual.

---

### Prueba 4: Cierre de Turno y Arqueo de Caja
1. En la pestaña **"💵 Turnos y Arqueo de Caja"**, revisa el desglose en tiempo real:
   * Fondo inicial de apertura.
   * Total ventas en efectivo vs tarjetas vs QR vs fiados.
   * **Efectivo Teórico Esperado**.
2. Haz clic en el botón rojo **"Cerrar Turno & Arqueo"**.
3. Ingresa el dinero real contado en el cajón y confirma.
4. El sistema calculará automáticamente si la caja está **Cuadrada Exacta**, o si existe **Sobrante / Faltante**.

---

### Prueba 5: Multi-Tenant Real (Aislamiento entre Comercios)
1. En la barra superior, cambia el selector de comercio de **"Kiosco San Martín Centro"** a **"Maxikiosco 24 Horas"**.
2. Observa cómo cambia instantáneamente:
   * El CUIT emisor.
   * El catálogo y el stock (completamente aislado en PostgreSQL).
   * La caja y el historial de ventas.
3. No hay cruce de datos entre comercios, garantizando la confidencialidad para tu cartera de 600 clientes.

---

## 🛑 Detener y Limpiar Contenedores

```bash
# Para detener la aplicación:
docker compose down

# Para reiniciar desde cero borrando los datos de prueba:
docker compose down -v
docker compose up -d --build
```
