-- ==============================================================================
-- GCManager - Datos Iniciales de Prueba (Seed Data)
-- Comercios, Usuarios, Productos de Kiosco, Clientes con Fiado y Turnos
-- ==============================================================================

-- 1. Tenants de Prueba
INSERT INTO tenants (id, subdomain, nombre_fantasia, razon_social, cuit, condicion_iva, direccion, telefono, email, plan)
VALUES 
(
    'a0000000-0000-0000-0000-000000000001',
    'kiosco-central',
    'Kiosco San Martín Centro',
    'Kiosco San Martín S.R.L.',
    '30712345678',
    'Responsable Inscripto',
    'Av. San Martín 1245, CABA',
    '11-4567-8901',
    'contacto@kioscosanmartin.com',
    'pro'
),
(
    'a0000000-0000-0000-0000-000000000002',
    'maxikiosco-24',
    'Maxikiosco 24 Horas Express',
    'Maxi Kiosco 24hs S.A.',
    '30798765432',
    'Responsable Inscripto',
    'Av. Corrientes 3820, CABA',
    '11-9876-5432',
    'administracion@maxi24hs.com',
    'enterprise'
)
ON CONFLICT (subdomain) DO NOTHING;

-- 2. Configuración Fiscal ARCA (ex-AFIP)
INSERT INTO arca_configuraciones (tenant_id, cuit, punto_venta, ambiente, auto_facturar_monto_minimo)
VALUES 
('a0000000-0000-0000-0000-000000000001', '30712345678', 1, 'simulacion', 10000.00),
('a0000000-0000-0000-0000-000000000002', '30798765432', 2, 'simulacion', 15000.00)
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Usuarios de Prueba
-- Passwords hasheadas con bcrypt para 'admin123' y 'cajero123'
-- Hash para 'admin123': $2a$10$wE0vWf8v8xN6M3mY475x8OQvK0Z4b4Xl6W67gq1o9W8h9R1f0sHGy (o generado por pgcrypto)
INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
VALUES 
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Administrador Central',
    'admin@kiosco.com',
    crypt('admin123', gen_salt('bf', 10)),
    'admin'
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Juan Cajero (Turno Mañana)',
    'cajero@kiosco.com',
    crypt('cajero123', gen_salt('bf', 10)),
    'cajero'
),
(
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    'Admin Maxi 24hs',
    'admin@maxi24.com',
    crypt('admin123', gen_salt('bf', 10)),
    'admin'
)
ON CONFLICT DO NOTHING;

-- 4. Cajas y Turno Abierto para Kiosco San Martín
INSERT INTO cajas (id, tenant_id, nombre)
VALUES 
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Caja Mostrador 1'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Caja Principal')
ON CONFLICT DO NOTHING;

INSERT INTO turnos_caja (id, tenant_id, caja_id, usuario_id, monto_inicial, estado, observaciones)
VALUES 
(
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    15000.00,
    'abierto',
    'Apertura turno con cambio en billetes de 500, 1000 y 2000'
)
ON CONFLICT DO NOTHING;

-- 5. Categorías de Kiosco
INSERT INTO categorias (id, tenant_id, nombre, descripcion)
VALUES 
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Alfajores', 'Alfajores simples, triples y regionales'),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Bebidas y Gaseosas', 'Gaseosas, aguas, energizantes y jugos'),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Golosinas y Chocolates', 'Caramelos, chupetines, chocolates'),
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Cigarrillos y Tabaco', 'Control estricto de margen y precios'),
('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Galletitas y Snacks', 'Papas fritas, galletitas dulces y saladas')
ON CONFLICT DO NOTHING;

-- 6. Productos Realistas de Kiosco
INSERT INTO productos (tenant_id, categoria_id, codigo_barra, codigo_interno, nombre, costo, precio_venta, alicuota_iva, es_cigarrillo, stock_actual, stock_minimo)
VALUES 
-- Alfajores
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '77900401', 'ALF-JOR-CHOC', 'Alfajor Jorgito Chocolate Triple', 650.00, 1100.00, 21.00, false, 48, 12),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '77900402', 'ALF-GUAY-BLA', 'Alfajor Guaymallén Blanco Dulce de Leche', 280.00, 500.00, 21.00, false, 80, 20),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '77900403', 'ALF-HAV-70C', 'Alfajor Havanna 70% Cacao Puro', 1400.00, 2300.00, 21.00, false, 25, 6),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '77900404', 'ALF-CAP-ESP', 'Alfajor Capitán del Espacio Triple Negro', 850.00, 1500.00, 21.00, false, 36, 10),

-- Bebidas
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', '77908950001', 'BEB-COCA-500', 'Coca Cola Sabor Original 500ml', 950.00, 1600.00, 21.00, false, 60, 15),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', '77908950002', 'BEB-SPRI-500', 'Sprite Lima Limón 500ml', 900.00, 1500.00, 21.00, false, 35, 10),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', '77908950003', 'BEB-AGUA-600', 'Agua Mineral Villavicencio sin gas 500ml', 600.00, 1000.00, 21.00, false, 45, 12),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', '77908950004', 'BEB-MONS-473', 'Monster Energy Drink Verde 473ml', 1350.00, 2200.00, 21.00, false, 30, 8),

-- Golosinas
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', '77912340001', 'GOL-BELD-MEN', 'Chicle Beldent Sensations Menta Fuerte', 450.00, 800.00, 21.00, false, 50, 15),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', '77912340002', 'GOL-PICO-DUL', 'Chupetín Pico Dulce Tutti Frutti', 120.00, 250.00, 21.00, false, 120, 30),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', '77912340003', 'GOL-MILK-100', 'Chocolate Milka Leche 100g', 1800.00, 2900.00, 21.00, false, 20, 5),

-- Cigarrillos (Margen reducido/fijo)
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', '77945670001', 'CIG-MARL-B20', 'Marlboro Red Box 20', 2900.00, 3200.00, 21.00, true, 40, 10),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', '77945670002', 'CIG-PHIL-B20', 'Philip Morris Box 20', 2600.00, 2900.00, 21.00, true, 35, 10),

-- Varios
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', '77978900001', 'VAR-ENC-BIC', 'Encendedor Bic Maxi Clásico', 850.00, 1400.00, 21.00, false, 45, 10),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', '77978900002', 'VAR-PAP-LAYS', 'Papas Fritas Lays Clásicas 85g', 1100.00, 1800.00, 21.00, false, 28, 8)
ON CONFLICT DO NOTHING;

-- 7. Clientes de Prueba (incluyendo Cuenta Corriente / Fiados)
INSERT INTO clientes (id, tenant_id, nombre, tipo_documento, documento, condicion_iva, telefono, limite_credito, saldo_actual)
VALUES 
(
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Consumidor Final',
    'DNI',
    '0',
    'Consumidor Final',
    '',
    0.00,
    0.00
),
(
    'f0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Carlos Gómez (Vecino Taller)',
    'DNI',
    '28456123',
    'Consumidor Final',
    '11-4455-6677',
    40000.00,
    6400.00
),
(
    'f0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Dra. Marcela Rossi (Consultorio)',
    'CUIT',
    '27329876541',
    'Responsable Inscripto',
    '11-5566-7788',
    60000.00,
    2800.00
)
ON CONFLICT DO NOTHING;

-- Historial inicial de fiado para Carlos Gómez
INSERT INTO cliente_movimientos_cuenta (tenant_id, cliente_id, tipo, monto, saldo_resultante, descripcion)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'CARGO_VENTA', 6400.00, 6400.00, 'Compra fiada: 2 paquetes cigarrillos + Coca 500ml')
ON CONFLICT DO NOTHING;

-- 8. Proveedores Clave de Kiosco
INSERT INTO proveedores (tenant_id, razon_social, cuit, contacto, telefono, email)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'Arcor S.A.I.C.', '30502793175', 'Preventista Pablo', '0800-444-2726', 'pedidos@arcor.com'),
('a0000000-0000-0000-0000-000000000001', 'Distribuidora Golosinas Sur', '30711223344', 'Martín Ventas', '11-6677-8899', 'ventas@golosinassur.com.ar'),
('a0000000-0000-0000-0000-000000000001', 'Massalin Particulares S.R.L.', '30500115822', 'Ruta 14 Preventa', '0800-777-6277', 'atencion@massalin.com')
ON CONFLICT DO NOTHING;
