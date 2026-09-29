// ==============================================================================
// GCManager - Frontend Controller & POS Engine
// ==============================================================================

const API_BASE = '/api';

// Estado global de la aplicación
const state = {
  currentTenant: 'kiosco-central',
  token: null,
  user: {
    nombre: 'Juan Cajero',
    email: 'cajero@kiosco.com',
    rol: 'cajero',
  },
  tenantInfo: null,
  cart: [],
  catalog: [],
  activeShift: null,
  clients: [],
  selectedPaymentMethod: 'EFECTIVO',
  currentCategoryFilter: 'all',
  activeFiadoClient: null,
};

// ==============================================================================
// Helper HTTP con Tenant Header e Inyección de JWT
// ==============================================================================
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-subdomain': state.currentTenant,
    ...(options.headers || {}),
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Error en la solicitud (${res.status})`);
    }
    return data;
  } catch (err) {
    console.error(`[API Error ${endpoint}]:`, err);
    throw err;
  }
}

// ==============================================================================
// Inicialización y Autenticación Inicial
// ==============================================================================
async function initApp() {
  setupTabs();
  setupEventListeners();
  setupKeyboardShortcuts();

  // Intentar login con usuario demo para arrancar la sesión de inmediato
  await autoLoginDemo();
  await loadTenantData();
}

async function autoLoginDemo() {
  try {
    // Login inicial transparente
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: state.user.email,
        password: 'cajero123',
      }),
    });
    state.token = res.token;
    state.user = res.user;
    state.tenantInfo = res.tenant;
    updateUserBadge();
  } catch (err) {
    console.warn('Login demo inicial falló, se continuará en modo libre:', err.message);
  }
}

async function loadTenantData() {
  try {
    // 1. Cargar info del Tenant
    const tenant = await apiRequest('/tenants/current');
    state.tenantInfo = tenant;
    document.getElementById('tenantIvaTag').textContent = tenant.condicion_iva;

    // 2. Cargar estado de caja
    await checkActiveShift();

    // 3. Cargar catálogo de productos
    await loadProducts();

    // 4. Cargar clientes
    await loadClients();

    // 5. Cargar dashboard
    await loadDashboard();
  } catch (err) {
    console.error('Error al cargar datos del tenant:', err);
  }
}

function updateUserBadge() {
  document.getElementById('userEmailText').textContent = state.user.email;
  document.getElementById('userRoleBadge').textContent = state.user.rol.toUpperCase();
}

// ==============================================================================
// Navegación de Pestañas
// ==============================================================================
function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');

      // Acciones al cambiar de tab
      if (targetId === 'tab-caja') loadShiftDetails();
      if (targetId === 'tab-productos') loadProductsTable();
      if (targetId === 'tab-fiados') loadClientsTable();
      if (targetId === 'tab-proveedores') loadProveedoresTable();
      if (targetId === 'tab-arca') loadArcaVouchers();
      if (targetId === 'tab-dashboard') loadDashboard();
    });
  });
}

// ==============================================================================
// Atajos de Teclado de Kiosco
// ==============================================================================
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // F12: Abrir Cobro
    if (e.key === 'F12') {
      e.preventDefault();
      if (state.cart.length > 0) openCobroModal();
    }
    // Escape: Vaciar Carrito o Cerrar Modales
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

// ==============================================================================
// PUNTO DE VENTA (POS)
// ==============================================================================
async function loadProducts(filterCategory = 'all') {
  try {
    const products = await apiRequest('/productos');
    state.catalog = products;
    renderPosCatalog(products, filterCategory);
  } catch (err) {
    console.error('Error cargando productos:', err);
  }
}

function renderPosCatalog(products, category = 'all') {
  const grid = document.getElementById('posProductGrid');
  grid.innerHTML = '';

  const filtered = category === 'all' 
    ? products 
    : products.filter(p => p.categoria_nombre === category);

  filtered.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="card-top">
        <span class="card-category">${p.categoria_nombre || 'Kiosco'}</span>
        <span class="card-stock ${p.stock_actual <= p.stock_minimo ? 'low' : ''}">
          Stock: ${p.stock_actual}
        </span>
      </div>
      <div class="card-title">${p.nombre}</div>
      <div class="card-price">$${parseFloat(p.precio_venta).toFixed(2)}</div>
    `;
    card.addEventListener('click', () => addToCart(p));
    grid.appendChild(card);
  });
}

function addToCart(product) {
  const existing = state.cart.find((item) => item.producto_id === product.id);
  if (existing) {
    existing.cantidad += 1;
    existing.subtotal = existing.cantidad * existing.precio_unitario;
  } else {
    state.cart.push({
      producto_id: product.id,
      codigo_barra: product.codigo_barra,
      descripcion: product.nombre,
      precio_unitario: parseFloat(product.precio_venta),
      alicuota_iva: parseFloat(product.alicuota_iva || 21.0),
      cantidad: 1,
      subtotal: parseFloat(product.precio_venta),
    });
  }
  renderCart();
}

function updateCartItemQty(index, delta) {
  const item = state.cart[index];
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    state.cart.splice(index, 1);
  } else {
    item.subtotal = item.cantidad * item.precio_unitario;
  }
  renderCart();
}

function clearCart() {
  state.cart = [];
  renderCart();
}

function renderCart() {
  const list = document.getElementById('cartItemsList');
  const countBadge = document.getElementById('cartItemCount');
  const subtotalEl = document.getElementById('cartSubtotal');
  const ivaEl = document.getElementById('cartIva');
  const totalEl = document.getElementById('cartTotal');
  const btnTotalEl = document.getElementById('btnCobrarTotal');

  if (state.cart.length === 0) {
    list.innerHTML = `
      <div class="empty-cart-msg">
        <p>🛒 Carrito vacío</p>
        <small>Escanea un código de barras o selecciona un producto de la izquierda</small>
      </div>
    `;
    countBadge.textContent = '0 items';
    subtotalEl.textContent = '$0.00';
    ivaEl.textContent = '$0.00';
    totalEl.textContent = '$0.00';
    btnTotalEl.textContent = '$0.00';
    return;
  }

  list.innerHTML = '';
  let subtotal = 0;
  let totalIva = 0;
  let totalItemsCount = 0;

  state.cart.forEach((item, idx) => {
    subtotal += item.subtotal;
    totalIva += item.subtotal * (item.alicuota_iva / 100);
    totalItemsCount += item.cantidad;

    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="item-info">
        <div class="item-name" title="${item.descripcion}">${item.descripcion}</div>
        <div class="item-unit-price">$${item.precio_unitario.toFixed(2)} c/u</div>
      </div>
      <div class="item-qty-controls">
        <button class="btn-qty" onclick="updateCartItemQty(${idx}, -1)">-</button>
        <span class="qty-val">${item.cantidad}</span>
        <button class="btn-qty" onclick="updateCartItemQty(${idx}, 1)">+</button>
      </div>
      <div class="item-subtotal">$${item.subtotal.toFixed(2)}</div>
    `;
    list.appendChild(row);
  });

  const total = subtotal; // Precios ya con IVA incluido en mostrador
  countBadge.textContent = `${totalItemsCount} items`;
  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  ivaEl.textContent = `$${totalIva.toFixed(2)}`;
  totalEl.textContent = `$${total.toFixed(2)}`;
  btnTotalEl.textContent = `$${total.toFixed(2)}`;
}

// Búsqueda por Código de Barras o Enter
document.getElementById('posBarcodeInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = e.target.value.trim();
    if (!query) return;

    // Buscar coincidencia exacta por código de barra primero
    const matchBarcode = state.catalog.find(p => p.codigo_barra === query || p.codigo_interno === query);
    if (matchBarcode) {
      addToCart(matchBarcode);
      e.target.value = '';
      return;
    }

    // Buscar coincidencia por nombre
    const matches = state.catalog.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 1) {
      addToCart(matches[0]);
      e.target.value = '';
    } else if (matches.length > 1) {
      renderPosCatalog(matches);
    } else {
      alert(`Producto con código "${query}" no encontrado.`);
    }
  }
});

// Filtros por Categoría
document.querySelectorAll('#posCategoryPills .pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#posCategoryPills .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderPosCatalog(state.catalog, pill.dataset.cat);
  });
});

document.getElementById('btnVaciarCarrito').addEventListener('click', clearCart);
document.getElementById('btnCobrarModal').addEventListener('click', openCobroModal);

// ==============================================================================
// MODAL DE COBRO Y EMISIÓN DE TICKET
// ==============================================================================
function openCobroModal() {
  if (state.cart.length === 0) {
    alert('El carrito está vacío.');
    return;
  }

  const total = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
  document.getElementById('checkoutModalTotal').textContent = `$${total.toFixed(2)}`;
  
  const inputPaga = document.getElementById('inputPagaCon');
  inputPaga.value = total.toFixed(2);
  calculateVuelto();

  // Reset de medio de pago a Efectivo
  selectPaymentMethod('EFECTIVO');

  populateFiadoClients();
  openModal('modalCobro');
}

function selectPaymentMethod(method) {
  state.selectedPaymentMethod = method;
  document.querySelectorAll('.btn-method').forEach((b) => {
    b.classList.toggle('active', b.dataset.method === method);
  });

  const groupPaga = document.getElementById('groupPagaCon');
  const groupFiado = document.getElementById('groupClienteFiado');

  if (method === 'EFECTIVO') {
    groupPaga.style.display = 'block';
    groupFiado.style.display = 'none';
  } else if (method === 'FIADO') {
    groupPaga.style.display = 'none';
    groupFiado.style.display = 'block';
  } else {
    groupPaga.style.display = 'none';
    groupFiado.style.display = 'none';
  }
}

document.querySelectorAll('.btn-method').forEach((btn) => {
  btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
});

document.getElementById('inputPagaCon').addEventListener('input', calculateVuelto);

function calculateVuelto() {
  const total = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
  const paga = parseFloat(document.getElementById('inputPagaCon').value || 0);
  const vuelto = Math.max(0, paga - total);
  document.getElementById('checkoutVuelto').textContent = `$${vuelto.toFixed(2)}`;
}

function populateFiadoClients() {
  const select = document.getElementById('selectClienteFiado');
  select.innerHTML = '<option value="">-- Seleccionar Cliente con Fiado --</option>';

  state.clients.forEach((c) => {
    if (c.nombre !== 'Consumidor Final') {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nombre} (Deuda actual: $${parseFloat(c.saldo_actual).toFixed(2)})`;
      select.appendChild(opt);
    }
  });

  select.addEventListener('change', () => {
    const selected = state.clients.find(c => c.id === select.value);
    const box = document.getElementById('fiadoStatusBox');
    if (selected) {
      box.innerHTML = `
        <p>Saldo Adeudado: <strong>$${parseFloat(selected.saldo_actual).toFixed(2)}</strong></p>
        <p>Límite Autorizado: $${parseFloat(selected.limite_credito).toFixed(2)}</p>
      `;
    } else {
      box.innerHTML = '';
    }
  });
}

document.getElementById('btnConfirmarVenta').addEventListener('click', async () => {
  try {
    const total = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
    const pagaCon = parseFloat(document.getElementById('inputPagaCon').value || total);
    const tipoCbte = document.getElementById('selectTipoComprobante').value;
    const clienteId = state.selectedPaymentMethod === 'FIADO' ? document.getElementById('selectClienteFiado').value : null;

    if (state.selectedPaymentMethod === 'FIADO' && !clienteId) {
      alert('Por favor selecciona el cliente para registrar el fiado.');
      return;
    }

    const payload = {
      items: state.cart,
      metodo_pago: state.selectedPaymentMethod,
      tipo_comprobante: tipoCbte,
      cliente_id: clienteId,
      paga_con: pagaCon,
    };

    const res = await apiRequest('/pos/venta', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    closeModal('modalCobro');
    clearCart();

    // Mostrar el ticket térmico con el QR fiscal ARCA
    showThermalTicketModal(res);

    // Actualizar datos de caja y dashboard
    await checkActiveShift();
    await loadProducts();
    await loadClients();
  } catch (err) {
    alert(`Error al registrar venta: ${err.message}`);
  }
});

// ==============================================================================
// VISOR DE TICKET TÉRMICO E IMPRESIÓN
// ==============================================================================
function showThermalTicketModal(saleResponse) {
  const pre = document.getElementById('ticketPreText');
  pre.textContent = saleResponse.ticketText;

  const qrContainer = document.getElementById('ticketQrContainer');
  const qrImg = document.getElementById('ticketQrImg');

  if (saleResponse.arcaInfo && saleResponse.arcaInfo.qrDataUrl) {
    qrImg.src = saleResponse.arcaInfo.qrDataUrl;
    qrContainer.style.display = 'flex';
  } else {
    qrContainer.style.display = 'none';
  }

  openModal('modalTicket');
}

document.getElementById('btnPrintReceipt').addEventListener('click', () => {
  window.print();
});

// ==============================================================================
// CONTROL DE CAJA Y TURNOS (ARQUEO)
// ==============================================================================
async function checkActiveShift() {
  try {
    const data = await apiRequest('/caja/turno-activo');
    state.activeShift = data.turnoActivo;

    const badge = document.getElementById('shiftBadge');
    const text = document.getElementById('shiftStatusText');

    if (data.abierto && data.turnoActivo) {
      badge.querySelector('.status-dot').className = 'status-dot green';
      text.textContent = `Turno Abierto: ${data.turnoActivo.cajero_nombre} (#${data.turnoActivo.caja_nombre})`;
      document.getElementById('btnAbrirTurnoModal').style.display = 'none';
      document.getElementById('btnCerrarTurnoModal').style.display = 'inline-block';
    } else {
      badge.querySelector('.status-dot').className = 'status-dot red';
      text.textContent = 'Caja Cerrada - Iniciar Turno';
      document.getElementById('btnAbrirTurnoModal').style.display = 'inline-block';
      document.getElementById('btnCerrarTurnoModal').style.display = 'none';
    }
  } catch (err) {
    console.warn('Error verificando turno activo:', err.message);
  }
}

async function loadShiftDetails() {
  await checkActiveShift();
  const t = state.activeShift;

  const inicial = t ? parseFloat(t.monto_inicial || 0) : 0;
  const ef = t ? parseFloat(t.total_ventas_efectivo || 0) : 0;
  const deb = t ? parseFloat(t.total_ventas_debito || 0) : 0;
  const qr = t ? parseFloat(t.total_ventas_qr || 0) : 0;
  const fiado = t ? parseFloat(t.total_ventas_fiado || 0) : 0;
  const ingresos = t ? parseFloat(t.total_ingresos || 0) : 0;
  const retiros = t ? parseFloat(t.total_retiros || 0) : 0;
  const esperado = inicial + ef + ingresos - retiros;

  document.getElementById('cajaMontoInicial').textContent = `$${inicial.toFixed(2)}`;
  document.getElementById('cajaVentasEfectivo').textContent = `$${ef.toFixed(2)}`;
  document.getElementById('cajaVentasTarjetas').textContent = `$${deb.toFixed(2)}`;
  document.getElementById('cajaVentasQr').textContent = `$${qr.toFixed(2)}`;
  document.getElementById('cajaVentasFiado').textContent = `$${fiado.toFixed(2)}`;
  document.getElementById('cajaEfectivoEsperado').textContent = `$${esperado.toFixed(2)}`;

  // Cargar ventas de hoy
  const ventas = await apiRequest('/pos/ventas-hoy');
  const tbody = document.querySelector('#tablaVentasTurno tbody');
  tbody.innerHTML = '';

  ventas.forEach((v) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${String(v.numero_ticket_local).padStart(6, '0')}</td>
      <td>${new Date(v.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td><span class="tenant-tag">${v.tipo_comprobante}</span></td>
      <td>${v.cliente_nombre || 'Consumidor Final'}</td>
      <td>${v.metodo_pago}</td>
      <td><strong>$${parseFloat(v.total).toFixed(2)}</strong></td>
      <td>${v.cae ? `CAE: ${v.cae}` : '-'}</td>
      <td><button class="btn-secondary" onclick="reprintTicket('${v.id}')">Ver Ticket</button></td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('btnAbrirTurnoModal').addEventListener('click', () => openModal('modalAbrirTurno'));
document.getElementById('btnConfirmarApertura').addEventListener('click', async () => {
  try {
    const monto = parseFloat(document.getElementById('inputMontoInicial').value || 0);
    const obs = document.getElementById('inputObsApertura').value;

    await apiRequest('/caja/abrir', {
      method: 'POST',
      body: JSON.stringify({ monto_inicial: monto, observaciones: obs }),
    });

    closeModal('modalAbrirTurno');
    await loadShiftDetails();
    alert('Turno abierto exitosamente.');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btnCerrarTurnoModal').addEventListener('click', () => {
  if (!state.activeShift) return;
  openModal('modalCerrarTurno');
});

document.getElementById('btnConfirmarCierre').addEventListener('click', async () => {
  try {
    if (!state.activeShift) return;
    const real = parseFloat(document.getElementById('inputMontoCierreReal').value || 0);
    const obs = document.getElementById('inputObsCierre').value;

    const res = await apiRequest('/caja/cerrar', {
      method: 'POST',
      body: JSON.stringify({
        turno_id: state.activeShift.id,
        monto_cierre_efectivo: real,
        observaciones: obs,
      }),
    });

    closeModal('modalCerrarTurno');
    await loadShiftDetails();
    alert(`Turno cerrado.\nDiagnóstico: ${res.arqueo.diagnostico}\nEsperado: $${res.arqueo.monto_esperado.toFixed(2)} | Real: $${res.arqueo.monto_real.toFixed(2)}`);
  } catch (err) {
    alert(err.message);
  }
});

// ==============================================================================
// PRODUCTOS Y STOCK
// ==============================================================================
async function loadProductsTable() {
  const products = await apiRequest('/productos');
  const tbody = document.querySelector('#tablaProductos tbody');
  tbody.innerHTML = '';

  products.forEach((p) => {
    const costo = parseFloat(p.costo || 0);
    const venta = parseFloat(p.precio_venta || 0);
    const margen = costo > 0 ? (((venta - costo) / costo) * 100).toFixed(0) + '%' : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${p.codigo_barra || '-'}</code></td>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.categoria_nombre || 'General'}</td>
      <td>$${costo.toFixed(2)}</td>
      <td><strong>$${venta.toFixed(2)}</strong></td>
      <td><span class="tenant-tag">${margen}</span></td>
      <td><span class="card-stock ${p.stock_actual <= p.stock_minimo ? 'low' : ''}">${p.stock_actual}</span></td>
      <td>${p.es_cigarrillo ? '🚬 Cigarrillo' : 'Estándar'}</td>
      <td>
        <button class="btn-secondary" onclick="quickStockAdjust('${p.id}', 10)">+10 Stock</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.quickStockAdjust = async function(id, delta) {
  try {
    await apiRequest(`/productos/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    });
    await loadProductsTable();
    await loadProducts();
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('btnNuevoProductoModal').addEventListener('click', () => openModal('modalNuevoProducto'));
document.getElementById('btnGuardarProducto').addEventListener('click', async () => {
  try {
    const payload = {
      codigo_barra: document.getElementById('prodCodigoBarra').value.trim(),
      nombre: document.getElementById('prodNombre').value.trim(),
      costo: parseFloat(document.getElementById('prodCosto').value || 0),
      precio_venta: parseFloat(document.getElementById('prodPrecioVenta').value || 0),
      stock_actual: parseFloat(document.getElementById('prodStock').value || 0),
      stock_minimo: parseFloat(document.getElementById('prodStockMin').value || 5),
      es_cigarrillo: document.getElementById('prodEsCigarrillo').checked,
    };

    await apiRequest('/productos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    closeModal('modalNuevoProducto');
    await loadProductsTable();
    await loadProducts();
    alert('Producto creado con éxito.');
  } catch (err) {
    alert(err.message);
  }
});

// ==============================================================================
// CLIENTES Y FIADOS
// ==============================================================================
async function loadClients() {
  const clients = await apiRequest('/clientes');
  state.clients = clients;
}

async function loadClientsTable() {
  await loadClients();
  const tbody = document.querySelector('#tablaClientes tbody');
  tbody.innerHTML = '';

  state.clients.forEach((c) => {
    const deuda = parseFloat(c.saldo_actual || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.nombre}</strong></td>
      <td>${c.tipo_documento || 'DNI'} ${c.documento || '-'}</td>
      <td>${c.telefono || '-'}</td>
      <td>${c.condicion_iva}</td>
      <td>$${parseFloat(c.limite_credito).toFixed(2)}</td>
      <td><span class="${deuda > 0 ? 'text-amber' : 'text-green'} font-bold">$${deuda.toFixed(2)}</span></td>
      <td>
        ${deuda > 0 ? `<button class="btn-primary" onclick="openCobroFiadoModal('${c.id}')">Cobrar Fiado</button>` : '<span class="text-muted">Al día</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openCobroFiadoModal = function(clienteId) {
  const cliente = state.clients.find(c => c.id === clienteId);
  if (!cliente) return;
  state.activeFiadoClient = cliente;

  document.getElementById('fiadoModalClienteNombre').textContent = `Cliente: ${cliente.nombre}`;
  document.getElementById('fiadoModalDeudaActual').textContent = `$${parseFloat(cliente.saldo_actual).toFixed(2)}`;
  document.getElementById('inputPagoFiadoMonto').value = parseFloat(cliente.saldo_actual).toFixed(2);
  openModal('modalCobroFiado');
};

document.getElementById('btnConfirmarPagoFiado').addEventListener('click', async () => {
  try {
    if (!state.activeFiadoClient) return;
    const monto = parseFloat(document.getElementById('inputPagoFiadoMonto').value || 0);
    const metodo = document.getElementById('selectPagoFiadoMetodo').value;

    await apiRequest(`/clientes/${state.activeFiadoClient.id}/pago-fiado`, {
      method: 'POST',
      body: JSON.stringify({ monto, metodo_pago: metodo }),
    });

    closeModal('modalCobroFiado');
    await loadClientsTable();
    await checkActiveShift();
    alert('Cobro de fiado asentado con éxito.');
  } catch (err) {
    alert(err.message);
  }
});

// ==============================================================================
// PROVEEDORES Y FACTURACIÓN ARCA
// ==============================================================================
async function loadProveedoresTable() {
  const provs = await apiRequest('/proveedores');
  const tbody = document.querySelector('#tablaProveedores tbody');
  tbody.innerHTML = '';

  provs.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.razon_social}</strong></td>
      <td>${p.cuit || '-'}</td>
      <td>${p.contacto || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td>${p.email || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadArcaVouchers() {
  const docs = await apiRequest('/reportes/comprobantes-arca');
  const tbody = document.querySelector('#tablaComprobantesArca tbody');
  tbody.innerHTML = '';

  docs.forEach((d) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(d.created_at).toLocaleDateString('es-AR')}</td>
      <td><span class="tenant-tag">${d.tipo_cbte === 1 ? 'Factura A' : d.tipo_cbte === 6 ? 'Factura B' : 'Factura C'}</span></td>
      <td>${String(d.punto_venta).padStart(5, '0')}</td>
      <td><strong>${String(d.numero_cbte).padStart(8, '0')}</strong></td>
      <td><code>${d.cae}</code></td>
      <td>${d.fecha_vto_cae}</td>
      <td><strong>$${parseFloat(d.importe_total).toFixed(2)}</strong></td>
      <td><span class="status-dot green"></span> Aprobado</td>
      <td><a href="${d.qr_url}" target="_blank" class="btn-secondary" style="font-size: 11px;">Verificar QR</a></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// DASHBOARD
// ==============================================================================
async function loadDashboard() {
  try {
    const data = await apiRequest('/reportes/dashboard');
    document.getElementById('dashboardFechaHoy').textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('dashFacturacionHoy').textContent = `$${parseFloat(data.resumenHoy.facturacion_total).toFixed(2)}`;
    document.getElementById('dashOperacionesHoy').textContent = `${data.resumenHoy.total_operaciones} ventas completadas`;
    document.getElementById('dashTotalFiados').textContent = `$${parseFloat(data.fiados.total_deuda).toFixed(2)}`;
    document.getElementById('dashClientesDeudores').textContent = `${data.fiados.cant_clientes_deudores} clientes con saldo fiado`;
    document.getElementById('dashStockBajo').textContent = data.stockAlerta.total_bajo_stock;

    const list = document.getElementById('dashTopProductosList');
    list.innerHTML = '';
    data.topProductos.forEach((p, idx) => {
      const item = document.createElement('div');
      item.style.padding = '8px 0';
      item.style.borderBottom = '1px solid #334155';
      item.innerHTML = `<strong>#${idx + 1} ${p.descripcion}</strong>: ${p.total_unidades} unidades ($${parseFloat(p.total_recaudado).toFixed(2)})`;
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

// ==============================================================================
// Selector de Tenant (SaaS Multi-Tenant Switching)
// ==============================================================================
document.getElementById('tenantSelect').addEventListener('change', async (e) => {
  state.currentTenant = e.target.value;
  clearCart();
  await autoLoginDemo();
  await loadTenantData();
});

// Helper de Modales
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function setupEventListeners() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', initApp);
