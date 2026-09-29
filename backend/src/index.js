const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { resolveTenant } = require('./middleware/tenant.middleware');

// Rutas de módulos
const tenantRoutes = require('./modules/tenants/tenants.routes');
const authRoutes = require('./modules/auth/auth.routes');
const productosRoutes = require('./modules/productos/productos.routes');
const cajaRoutes = require('./modules/caja/caja.routes');
const posRoutes = require('./modules/pos/pos.routes');
const clientesRoutes = require('./modules/clientes/clientes.routes');
const proveedoresRoutes = require('./modules/proveedores/proveedores.routes');
const reportesRoutes = require('./modules/reportes/reportes.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Seguridad y Middlewares Globales
app.use(cors({
  origin: '*', // Para pruebas locales y contenedores
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-subdomain'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Endpoint de Liveness / Readiness para Docker & DevSecOps
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'gcmanager-api',
    uptime: process.uptime(),
  });
});

// Middleware Multi-Tenant (Se activa para todas las rutas /api)
app.use('/api', resolveTenant);

// Registro de endpoints
app.use('/api/tenants', tenantRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/reportes', reportesRoutes);

// Manejador 404
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Ruta no encontrada en la API.' });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Unhandled Global Error]', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || 'Error interno del servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 GCManager API - SaaS Multi-Tenant Kioscos activo`);
  console.log(`📍 Puerto: ${PORT}`);
  console.log(`🔒 Multi-Tenant: Subdominios, x-tenant-subdomain o ?tenant=`);
  console.log(`📄 Facturación ARCA (ex-AFIP) integrada con QR RG 4291`);
  console.log(`=======================================================`);
});
