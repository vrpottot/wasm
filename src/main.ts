import CanvasKitInit from '@rollerbird/canvaskit-wasm-pdf';
import { initPixiApp } from './pixi/scene';
import { convertPixiContainerToSkia } from './skia/renderer';
import { setupEventBridge } from './events/event-bridge';
import { setupUIControls } from './ui/controls';
import './index.css';

const pixiCanvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
const skiaCanvas = document.getElementById('skia-canvas') as HTMLCanvasElement;
const logEl = document.getElementById('event-log') as HTMLDivElement;

function addLog(msg: string) {
  if (!logEl) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  if (msg.includes('pointerdown')) {
    entry.className += ' event-down';
  } else if (msg.includes('pointerup')) {
    entry.className += ' event-up';
  } else {
    entry.className += ' system';
  }

  // Format with a timestamp
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  entry.textContent = `[${timeStr}] ${msg}`;
  
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

// Initialize CanvasKit with WASM loader configured to locate files in public/canvaskit
CanvasKitInit({
  locateFile: (file) => `/canvaskit/${file}`
})
  .then((canvaskit) => {
    addLog('Система: Модуль CanvasKit WASM успешно загружен.');

    // 1. Initialize PixiJS Application
    const pixiContext = initPixiApp(
      pixiCanvas,
      () => {
        // Redraw Skia canvas when changes occur
        drawSkiaFrame();
      },
      (msg) => {
        addLog(msg);
      }
    );

    // Give subContainer a name or mark it to distinguish from random elements
    (pixiContext.mainContainer.children[0] as any).name = 'subContainer';

    // 2. Set up Skia Surface
    const skiaSurface = canvaskit.MakeSWCanvasSurface(skiaCanvas);
    if (!skiaSurface) {
      addLog('Система: Ошибка создания программной поверхности Skia.');
      return;
    }
    addLog('Система: Экранная поверхность Skia инициализирована.');

    // 3. Define rendering loop for Skia
    function drawSkiaFrame() {
      if (!skiaSurface) return;
      const canvas = skiaSurface.getCanvas();
      if (!canvas) return;

      // Clear the canvas with background color matching PIXI
      const clearColor = canvaskit.Color(17, 24, 39, 1.0); // #111827
      canvas.clear(clearColor);

      // Render the PIXI Container hierarchy onto Skia
      convertPixiContainerToSkia(pixiContext.mainContainer, canvas, canvaskit);

      skiaSurface.flush();
    }

    // Run first frame render
    drawSkiaFrame();

    // 4. Connect event bridge to handle hit-testing on Skia Canvas
    setupEventBridge(skiaCanvas, pixiContext.mainContainer);
    addLog('Система: Мост интерактивных событий подключен к холсту Skia.');

    // 5. Setup UI Controls via controls module
    setupUIControls({
      canvaskit,
      mainContainer: pixiContext.mainContainer,
      drawSkiaFrame,
      addLog
    });
  })
  .catch((err) => {
    addLog(`Система: Ошибка загрузки модуля CanvasKit. ${err}`);
    console.error(err);
  });
