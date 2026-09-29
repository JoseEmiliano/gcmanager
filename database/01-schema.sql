-- ==============================================================================
-- GCManager - Esquema de Base de Datos Multi-Tenant para Kioscos y Maxikioscos
-- PostgreSQL 15+ con Aislamiento por Tenant (tenant_id y RLS opcional)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Catálogo Global de Tenants (Comercios Suscritos)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subdomain VARCHAR(63) NOT NULL UNIQUE,       -- ej: "kiosco-central", "maxi-express"
    nombre_fantasia VARCHAR(150) NOT NULL,
    razon_social VARCHAR(200) NOT NULL,
    cuit VARCHAR(15) NOT NULL,
    condicion_iva VARCHAR(50) NOT NULL DEFAULT 'Responsable Inscripto', -- Monotributo, Resp. Inscripto, Exento
    direccion VARCHAR(255),
    telefono VARCHAR(50),
    email VARCHAR(150),
    plan VARCHAR(30) NOT NULL DEFAULT 'pro',     -- starter, pro, enterprise
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Configuración Fiscal ARCA (ex-AFIP) por Tenant
CREATE TABLE IF NOT EXISTS arca_configuraciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cuit VARCHAR(15) NOT NULL,
    punto_venta INTEGER NOT NULL DEFAULT 1,
    ambiente VARCHAR(20) NOT NULL DEFAULT 'simulacion', -- simulacion, homologacion, produccion
    certificado_crt TEXT,                               -- Certificado digital X.509
    clave_privada_key TEXT,                             -- Clave privada encriptada
    token_wsaa TEXT,                                    -- Cache token WSAA
    sign_wsaa TEXT,                                     -- Cache sign WSAA
    token_expira_at TIMESTAMP WITH TIME ZONE,
    auto_facturar_monto_minimo NUMERIC(12,2) DEFAULT 0, -- Si supera X monto sugiere factura
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id)
);

-- 3. Usuarios del Sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'cajero', -- 'admin', 'encargado', 'cajero'
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

-- 4. Puntos de Venta Físicos y Turnos de Caja (Arqueo)
CREATE TABLE IF NOT EXISTS cajas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(50) NOT NULL DEFAULT 'Caja 1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turnos_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    caja_id UUID NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    monto_inicial NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monto_cierre_efectivo NUMERIC(12,2),
    monto_esperado_efectivo NUMERIC(12,2),
    diferencia NUMERIC(12,2),
    total_ventas_efectivo NUMERIC(12,2) DEFAULT 0.00,
    total_ventas_debito NUMERIC(12,2) DEFAULT 0.00,
    total_ventas_qr NUMERIC(12,2) DEFAULT 0.00,
    total_ventas_fiado NUMERIC(12,2) DEFAULT 0.00,
    total_retiros NUMERIC(12,2) DEFAULT 0.00,
    total_ingresos NUMERIC(12,2) DEFAULT 0.00,
    observaciones TEXT,
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto' -- 'abierto', 'cerrado'
);

-- 5. Categorías y Productos para Kioscos y Maxikioscos
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    codigo_barra VARCHAR(64),
    codigo_interno VARCHAR(64),
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    costo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    alicuota_iva NUMERIC(5,2) NOT NULL DEFAULT 21.00, -- 21%, 10.5%, 0%
    es_cigarrillo BOOLEAN NOT NULL DEFAULT false,     -- Tratamiento especial de márgenes e impuestos
    es_combo BOOLEAN NOT NULL DEFAULT false,
    stock_actual NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 5.00,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_tenant_codigo ON productos(tenant_id, codigo_barra);
CREATE INDEX IF NOT EXISTS idx_productos_tenant_nombre ON productos(tenant_id, nombre);

-- 6. Clientes y Cuentas Corrientes ("Fiados" de Kiosco)
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    tipo_documento VARCHAR(20) DEFAULT 'DNI', -- DNI, CUIT, Pasaporte
    documento VARCHAR(30),
    condicion_iva VARCHAR(50) DEFAULT 'Consumidor Final',
    telefono VARCHAR(50),
    direccion VARCHAR(255),
    limite_credito NUMERIC(12,2) DEFAULT 20000.00, -- Límite máximo para fiar
    saldo_actual NUMERIC(12,2) DEFAULT 0.00,       -- Saldo adeudado
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cliente_movimientos_cuenta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL, -- 'CARGO_VENTA' (aumenta deuda), 'PAGO' (disminuye deuda)
    monto NUMERIC(12,2) NOT NULL,
    saldo_resultante NUMERIC(12,2) NOT NULL,
    descripcion VARCHAR(255),
    referencia_id UUID,        -- ID de venta si aplica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Proveedores y Compras
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(15),
    contacto VARCHAR(100),
    telefono VARCHAR(50),
    email VARCHAR(150),
    direccion VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id UUID REFERENCES proveedores(id),
    numero_factura VARCHAR(50),
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    observaciones TEXT,
    fecha_compra TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compra_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad NUMERIC(12,2) NOT NULL,
    costo_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL
);

-- 8. Ventas, Items y Comprobantes Fiscales ARCA
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turno_caja_id UUID REFERENCES turnos_caja(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    cliente_id UUID REFERENCES clientes(id),
    numero_ticket_local BIGINT NOT NULL,
    tipo_comprobante VARCHAR(30) NOT NULL DEFAULT 'TICKET_X', -- 'TICKET_X', 'FACTURA_A', 'FACTURA_B', 'FACTURA_C'
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    descuento NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    iva NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'EFECTIVO',     -- 'EFECTIVO', 'DEBITO', 'CREDITO', 'QR_TRANSFERENCIA', 'FIADO'
    paga_con NUMERIC(12,2) DEFAULT 0.00,
    vuelto NUMERIC(12,2) DEFAULT 0.00,
    estado VARCHAR(20) NOT NULL DEFAULT 'COMPLETADA',        -- 'COMPLETADA', 'ANULADA'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS venta_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    codigo_barra VARCHAR(64),
    descripcion VARCHAR(200) NOT NULL,
    cantidad NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    alicuota_iva NUMERIC(5,2) NOT NULL DEFAULT 21.00,
    subtotal NUMERIC(12,2) NOT NULL
);

-- 9. Datos Fiscales ARCA (ex-AFIP) emitidos
CREATE TABLE IF NOT EXISTS comprobantes_arca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    tipo_cbte INTEGER NOT NULL,          -- 1: Factura A, 6: Factura B, 11: Factura C
    punto_venta INTEGER NOT NULL,        -- ej: 1
    numero_cbte BIGINT NOT NULL,         -- ej: 10045
    cae VARCHAR(30) NOT NULL,            -- Código de Autorización Electrónico
    fecha_vto_cae DATE NOT NULL,
    cuit_emisor VARCHAR(15) NOT NULL,
    tipo_doc_receptor INTEGER DEFAULT 99,-- 80: CUIT, 96: DNI, 99: Sin identificar
    nro_doc_receptor VARCHAR(20),
    importe_total NUMERIC(12,2) NOT NULL,
    qr_data TEXT NOT NULL,               -- JSON Base64 oficial según RG 4291 de ARCA/AFIP
    qr_url TEXT NOT NULL,                -- URL pública oficial para escanear en ARCA
    resultado VARCHAR(20) NOT NULL DEFAULT 'A', -- 'A' Aprobado, 'R' Rechazado
    observaciones_arca TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, punto_venta, tipo_cbte, numero_cbte)
);

-- Indices estratégicos para alta concurrencia
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_fecha ON ventas(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_turnos_tenant_estado ON turnos_caja(tenant_id, estado);
