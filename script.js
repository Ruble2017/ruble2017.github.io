// Глобальные переменные
let html5QrCode;
let currentCamera = 'environment'; // Use the main (rear) camera by default
let scanResults = [];
let isTelegram = false;
let isScanning = false;

/**
 * Инициализация приложения
 */
function initApp() {
  if (window.Telegram?.WebApp) {
    isTelegram = true;
    Telegram.WebApp.expand();
    Telegram.WebApp.MainButton.hide();
  }
  setupButtons();
  setupScanModeButtons(); // Активируем настройку кнопки режима сканирования
  createScanOverlay();
  startScanner();
}

/**
 * Настройка обработчиков кнопок
 */
function setupButtons() {
  const buttonActions = {
    'stop-scan': stopScanner,
    'start-scan': startScanner,
    'send-result': sendResults
  };
  Object.entries(buttonActions).forEach(([id, action]) => {
    document.getElementById(id).addEventListener('click', action);
  });
  if (isTelegram) Telegram.WebApp.MainButton.onClick(sendResults);
}

/**
 * Настройка кнопок режима сканирования
 */
function setupScanModeButtons() {
  const barcodeButton = document.getElementById('barcode-button');

  barcodeButton.addEventListener('click', () => {
    const isBarcodeMode = barcodeButton.textContent === 'Barcode';
    barcodeButton.textContent = isBarcodeMode ? 'QRCode' : 'Barcode';
    updateScanMode(isBarcodeMode ? 'barcode' : 'qrcode');
  });
}

/**
 * Обновление режима сканирования
 */
function updateScanMode(mode) {
  if (!html5QrCode) return;

  const config = {
    fps: 10,
    qrbox: mode === 'barcode'
      ? { width: 250, height: 75 } // Прямоугольная рамка для штрих-кодов
      : { width: 250, height: 250 }, // Квадратная рамка для QR-кодов
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    aspectRatio: 1.0
  };

  stopScanner();
  setTimeout(() => startCamera(config), 300);
}

/**
 * Создает рамку сканирования с угловыми метками
 */
function createScanOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'scan-overlay';
  ['tl', 'tr', 'bl', 'br'].forEach(pos => {
    const corner = document.createElement('div');
    corner.className = `scan-corner scan-corner-${pos}`;
    overlay.appendChild(corner);
  });
  document.getElementById('qr-reader').appendChild(overlay);
}

/**
 * Запуск сканера
 */
function startScanner() {
  if (isScanning) return;
  html5QrCode = new Html5Qrcode('qr-reader');
  const config = { 
    fps: 10,
    qrbox: { width: 250, height: 250 },
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    aspectRatio: 1.0
  };
  requestCameraAccess(config);
}

/**
 * Запрос доступа к камере и запуск сканера
 */
function requestCameraAccess(config) {
  // Проверяем поддержку API разрешений
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'camera' }).then(permissionStatus => {
      if (permissionStatus.state === 'denied') {
        displayError('Доступ к камере запрещен. Разрешите доступ в настройках браузера.');
        return;
      }
      startCamera(config);
    }).catch(() => {
      // Если API разрешений недоступен, пробуем запустить камеру напрямую
      startCamera(config);
    });
  } else {
    // Если API разрешений не поддерживается, пробуем запустить камеру напрямую
    startCamera(config);
  }
}

/**
 * Запуск камеры
 */
function startCamera(config) {
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentCamera, width: { ideal: 1280 }, height: { ideal: 720 } }
  })
  .then(stream => {
    stream.getTracks().forEach(track => track.stop());
    return html5QrCode.start({ facingMode: currentCamera }, config, onScanSuccess, onScanError);
  })
  .then(() => {
    isScanning = true;
    updateUI();
  })
  .catch(error => {
    handleCameraError(error);
  });
}

/**
 * Остановка сканера
 */
function stopScanner() {
  if (!isScanning || !html5QrCode) return;
  html5QrCode.stop().then(() => {
    isScanning = false;
    updateUI();
  }).catch(err => console.error("Ошибка при остановке:", err));
}

// Remove the toggleCamera function

/**
 * Обработка успешного сканирования
 */
function onScanSuccess(decodedText) {
  if (scanResults.includes(decodedText)) return;
  scanResults.push(decodedText);
  updateResults(decodedText);
  if (isTelegram) updateTelegramButton();
}

/**
 * Обновление результатов сканирования
 */
function updateResults(decodedText) {
  const resultContainer = document.getElementById('qr-reader-results');

  // Create a new result panel
  const resultPanel = document.createElement('div');
  resultPanel.className = 'result-panel';

  // Add the scanned text
  const resultText = document.createElement('span');
  resultText.textContent = `${scanResults.length}. ${decodedText}`;
  resultPanel.appendChild(resultText);

  // Add a delete button
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Удалить';
  deleteButton.className = 'delete-button';
  deleteButton.addEventListener('click', () => {
    // Remove the result from the array and UI
    const index = scanResults.indexOf(decodedText);
    if (index > -1) {
      scanResults.splice(index, 1);
    }
    resultPanel.remove();
    updateTelegramButton();
  });
  resultPanel.appendChild(deleteButton);

  // Append the result panel to the container
  resultContainer.appendChild(resultPanel);

  // Show the send button
  document.getElementById('send-result').style.display = 'block';
  updateTelegramButton();
}

/**
 * Обновление кнопки Telegram
 */
function updateTelegramButton() {
  Telegram.WebApp.MainButton.setText(`Отправить (${scanResults.length})`);
  Telegram.WebApp.MainButton.show();
}

/**
 * Обработка ошибок сканирования
 */
function onScanError(error) {
  console.warn('Ошибка сканирования:', error);
}

/**
 * Обработка ошибок камеры
 */
function handleCameraError(error) {
  console.error('Camera Error:', error);
  let message = 'Ошибка доступа к камере.';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    message = 'Доступ к камере запрещен. Разрешите доступ в настройках браузера.';
  } else if (error.name === 'NotFoundError') {
    message = 'Камера не найдена. Убедитесь, что устройство имеет камеру.';
  } else if (error.message.includes('facingMode')) {
    message = 'Не удалось выбрать камеру. Попробуйте переключить камеру.';
    currentCamera = 'user';
  }
  displayError(message);
}

/**
 * Отображение ошибки
 */
function displayError(message) {
  const resultContainer = document.getElementById('qr-reader-results');
  resultContainer.innerHTML = `<div class="error">${message}</div>`;
  isScanning = false;
  updateUI();
}

/**
 * Обновление интерфейса
 */
function updateUI() {
  document.body.classList.toggle('scanner-active', isScanning);
  document.body.classList.toggle('scanner-inactive', !isScanning);
}

/**
 * Отправка результатов
 */
function sendResults() {
  console.log('Preparing to send results:', scanResults);
  if (scanResults.length === 0) {
    console.warn('No results to send.');
    return;
  }
  const resultsText = scanResults.join('\n');
  if (isTelegram) {
    try {
      Telegram.WebApp.sendData(resultsText);
      console.log('Results successfully sent to Telegram:', scanResults);
      Telegram.WebApp.close();
    } catch (error) {
      console.error('Error sending results to Telegram:', error);
    }
    // Uncomment the following line if you want to close the WebApp after sending data
    // Telegram.WebApp.close();
  } else {
    alert(`Результаты:\n${resultsText}`);
    resetResults();
  }
}

/**
 * Сброс результатов
 */
function resetResults() {
  console.log('Resetting results...');
  scanResults = [];
  document.getElementById('qr-reader-results').innerHTML = '';
  document.getElementById('send-result').style.display = 'none';
}

// Запускаем приложение после загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);