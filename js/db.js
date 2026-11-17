const DB_NAME = 'POS_Offline_DB';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('productos')) {
        db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('ventas')) {
        db.createObjectStore('ventas', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function seedInitialProducts() {
  const productos = await getAll('productos');
  if (productos.length === 0) {
    await addProduct({ nombre: 'Café Americano', precio: 35, stock: 10, foto: '' });
    await addProduct({ nombre: 'Rebanada Cheesecake', precio: 55, stock: 4, foto: '' });
    await addProduct({ nombre: 'Agua Embotellada', precio: 18, stock: 15, foto: '' });
  }
}

export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addProduct(producto) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('productos', 'readwrite');
    tx.objectStore('productos').add(producto);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateProduct(producto) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('productos', 'readwrite');
    tx.objectStore('productos').put(producto);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function registerSale(venta, carrito) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['ventas', 'productos'], 'readwrite');
    const ventasStore = tx.objectStore('ventas');
    const prodStore = tx.objectStore('productos');

    ventasStore.add(venta);

    carrito.forEach((item) => {
      const getReq = prodStore.get(item.id);
      getReq.onsuccess = () => {
        const prod = getReq.result;
        if (prod) {
          prod.stock = Math.max(0, prod.stock - item.cantidad);
          prodStore.put(prod);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}