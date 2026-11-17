let mediaStream = null;

export function openCameraModal() {
  return new Promise(async (resolve, reject) => {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const btnCapture = document.getElementById('btn-capture');
    const btnClose = document.getElementById('btn-close-camera');

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      video.srcObject = mediaStream;
      modal.classList.remove('hidden');

      const cleanup = () => {
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
          mediaStream = null;
        }
        modal.classList.add('hidden');
      };

      btnCapture.onclick = () => {
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);
        cleanup();
        resolve(imageBase64);
      };

      btnClose.onclick = () => {
        cleanup();
        resolve(null);
      };
    } catch (err) {
      alert('No se pudo acceder a la cámara: ' + err.message);
      reject(err);
    }
  });
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Este navegador no soporta notificaciones.');
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendLowStockNotification(productName, remainingStock) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⚠️ Alerta de Inventario Bajo', {
      body: `Quedan solo ${remainingStock} unidad(es) de "${productName}".`,
      icon: './icons/icon-192.png'
    });
  }
}