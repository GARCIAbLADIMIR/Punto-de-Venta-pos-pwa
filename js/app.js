import { seedInitialProducts, getAll, addProduct, registerSale } from './db.js';
import { openCameraModal, requestNotificationPermission, sendLowStockNotification } from './native-apis.js';

let carrito = [];
let deferredPrompt = null;
let tempProductPhoto = '';
let tempReceiptPhoto = '';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => console.log('Service Worker registrado correctamente'))
      .catch((err) => console.error('Error registrando SW:', err));
  });
}

const btnInstall = document.getElementById('btn-install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    btnInstall.classList.add('hidden');
  }
  deferredPrompt = null;
});

const statusBadge = document.getElementById('network-status');
function updateNetworkStatus() {
  if (navigator.onLine) {
    statusBadge.textContent = '● En línea';
    statusBadge.classList.remove('offline');
  } else {
    statusBadge.textContent = '● Modo Offline';
    statusBadge.classList.add('offline');
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

document.getElementById('btn-notify-perm').addEventListener('click', async () => {
  const granted = await requestNotificationPermission();
  alert(granted ? 'Notificaciones de stock bajo activadas.' : 'Permiso denegado.');
});

const appView = document.getElementById('app-view');
const navButtons = document.querySelectorAll('.nav-btn');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderView(btn.dataset.view);
  });
});

async function renderView(view) {
  if (view === 'caja') await renderCaja();
  if (view === 'inventario') await renderInventario();
  if (view === 'ventas') await renderVentas();
}

async function renderCaja() {
  const productos = await getAll('productos');
  const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  appView.innerHTML = `
    <div class="card">
      <h3>Ticket Actual ($${total.toFixed(2)})</h3>
      ${
        carrito.length === 0
          ? '<p style="color:#64748b;margin-top:0.5rem;">Selecciona productos para agregar a la venta.</p>'
          : `<ul style="list-style:none;margin:0.75rem 0;">
              ${carrito
                .map(
                  (item) =>
                    `<li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;">
                      <span>${item.cantidad}x ${item.nombre}</span>
                      <strong>$${(item.precio * item.cantidad).toFixed(2)}</strong>
                    </li>`
                )
                .join('')}
            </ul>
            <button id="btn-receipt-photo" class="btn-secondary">
              ${tempReceiptPhoto ? '✅ Comprobante Adjunto' : '📷 Foto Comprobante (Opcional)'}
            </button>
            <button id="btn-checkout" class="btn-primary">Cobrar $${total.toFixed(2)}</button>
            <button id="btn-clear-cart" class="btn-danger">Vaciar Carrito</button>`
      }
    </div>

    <h3 style="margin-bottom:0.75rem;">Catálogo Disponible</h3>
    <div class="grid-products">
      ${productos
        .map(
          (p) => `
        <div class="product-card">
          <div>
            ${p.foto ? `<img src="${p.foto}" alt="${p.nombre}">` : ''}
            <strong>${p.nombre}</strong>
            <p style="color:#2563eb;font-weight:700;">$${p.precio}</p>
            <small style="color:${p.stock <= 3 ? '#dc2626' : '#64748b'};">Stock: ${p.stock}</small>
          </div>
          <button class="btn-primary btn-add-cart" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
            ${p.stock === 0 ? 'Agotado' : '+ Agregar'}
          </button>
        </div>`
        )
        .join('')}
    </div>
  `;

  document.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const prod = productos.find((p) => p.id === id);
      const inCart = carrito.find((c) => c.id === id);

      if (inCart) {
        if (inCart.cantidad < prod.stock) inCart.cantidad++;
      } else {
        carrito.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1, stockActual: prod.stock });
      }
      renderCaja();
    });
  });

  const btnReceipt = document.getElementById('btn-receipt-photo');
  if (btnReceipt) {
    btnReceipt.addEventListener('click', async () => {
      const photo = await openCameraModal();
      if (photo) {
        tempReceiptPhoto = photo;
        renderCaja();
      }
    });
  }

  const btnClear = document.getElementById('btn-clear-cart');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      carrito = [];
      tempReceiptPhoto = '';
      renderCaja();
    });
  }

  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', async () => {
      const venta = {
        fecha: new Date().toLocaleString(),
        items: [...carrito],
        total,
        comprobante: tempReceiptPhoto
      };

      await registerSale(venta, carrito);

      carrito.forEach((item) => {
        const nuevoStock = item.stockActual - item.cantidad;
        if (nuevoStock <= 3) {
          sendLowStockNotification(item.nombre, nuevoStock);
        }
      });

      carrito = [];
      tempReceiptPhoto = '';
      alert('¡Venta registrada en IndexedDB!');
      renderCaja();
    });
  }
}

async function renderInventario() {
  const productos = await getAll('productos');

  appView.innerHTML = `
    <div class="card">
      <h3>Nuevo Producto</h3>
      <form id="form-product">
        <div class="form-group">
          <label>Nombre del Producto</label>
          <input type="text" id="prod-name" required placeholder="Ej. Galletas Chispas" />
        </div>
        <div class="form-group">
          <label>Precio ($)</label>
          <input type="number" id="prod-price" step="0.5" required placeholder="25.00" />
        </div>
        <div class="form-group">
          <label>Stock Inicial</label>
          <input type="number" id="prod-stock" required placeholder="10" />
        </div>
        <button type="button" id="btn-prod-photo" class="btn-secondary">
          ${tempProductPhoto ? '✅ Foto Capturada' : '📷 Tomar Foto del Producto'}
        </button>
        <button type="submit" class="btn-primary">Guardar en Inventario</button>
      </form>
    </div>

    <div class="card">
      <h3>Inventario Registrado (${productos.length})</h3>
      ${productos
        .map(
          (p) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid #e2e8f0;">
          <div>
            <strong>${p.nombre}</strong><br/>
            <small>$${p.precio} | Stock: ${p.stock}</small>
          </div>
          ${p.foto ? `<img src="${p.foto}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">` : ''}
        </div>`
        )
        .join('')}
    </div>
  `;

  document.getElementById('btn-prod-photo').addEventListener('click', async () => {
    const photo = await openCameraModal();
    if (photo) {
      tempProductPhoto = photo;
      renderInventario();
    }
  });

  document.getElementById('form-product').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevo = {
      nombre: document.getElementById('prod-name').value.trim(),
      precio: parseFloat(document.getElementById('prod-price').value),
      stock: parseInt(document.getElementById('prod-stock').value, 10),
      foto: tempProductPhoto
    };
    await addProduct(nuevo);
    tempProductPhoto = '';
    renderInventario();
  });
}

async function renderVentas() {
  const ventas = await getAll('ventas');
  const ingresosTotales = ventas.reduce((sum, v) => sum + v.total, 0);

  appView.innerHTML = `
    <div class="card" style="text-align:center;">
      <small style="color:#64748b;">Ventas Totales Acumuladas</small>
      <h2 style="color:#16a34a;font-size:2rem;">$${ingresosTotales.toFixed(2)}</h2>
      <p>${ventas.length} transacciones guardadas localmente</p>
    </div>

    ${ventas
      .slice()
      .reverse()
      .map(
        (v) => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;">
          <strong>Ticket #${v.id}</strong>
          <strong style="color:#2563eb;">$${v.total.toFixed(2)}</strong>
        </div>
        <small style="color:#64748b;">${v.fecha}</small>
        <p style="margin-top:0.5rem;font-size:0.9rem;">
          ${v.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}
        </p>
        ${v.comprobante ? `<img src="${v.comprobante}" style="width:100%;max-height:140px;object-fit:cover;border-radius:6px;margin-top:0.5rem;">` : ''}
      </div>`
      )
      .join('')}
  `;
}

(async function init() {
  updateNetworkStatus();
  await seedInitialProducts();
  renderCaja();
})();