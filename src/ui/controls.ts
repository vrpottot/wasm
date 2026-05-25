import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit } from '@rollerbird/canvaskit-wasm-pdf';
import { exportSceneToPDF } from '../skia/pdf-exporter';

export interface UIControlsConfig {
  canvaskit: CanvasKit;
  mainContainer: PIXI.Container;
  drawSkiaFrame: () => void;
  addLog: (msg: string) => void;
}

/**
 * Binds UI button listeners (adding random shapes, clearing shapes, exporting PDF, clearing logs)
 * to maintain clean module boundaries and separate UI logic from the main application setup.
 */
export function setupUIControls(config: UIControlsConfig): void {
  const btnAddShape = document.getElementById('btn-add-shape');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnClear = document.getElementById('btn-clear');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const logEl = document.getElementById('event-log') as HTMLDivElement;

  if (btnAddShape) {
    btnAddShape.addEventListener('click', () => {
      // Option A: Add a random shape with random transforms
      const shapes = ['rect', 'ellipse', 'line'];
      const type = shapes[Math.floor(Math.random() * shapes.length)];
      const color = Math.floor(Math.random() * 0xffffff);
      const alpha = 0.5 + Math.random() * 0.5;
      
      const w = 40 + Math.random() * 100;
      const h = 40 + Math.random() * 80;
      const x = w + Math.random() * (600 - 2 * w);
      const y = h + Math.random() * (500 - 2 * h);
      const angle = Math.random() * 360;

      const g = new PIXI.Graphics();
      g.name = 'random'; // Mark as random for easy cleanup
      g.interactive = true;
      g.cursor = 'pointer';

      if (type === 'rect') {
        g.beginFill(color, alpha).drawRect(-w / 2, -h / 2, w, h).endFill();
      } else if (type === 'ellipse') {
        g.beginFill(color, alpha).drawEllipse(0, 0, w / 2, h / 2).endFill();
      } else {
        // Line
        const strokeWidth = 4 + Math.random() * 8;
        g.lineStyle(strokeWidth, color, alpha).moveTo(-w / 2, -h / 2).lineTo(w / 2, h / 2);
      }

      g.position.set(x, y);
      g.angle = angle;

      // Translate shape type to Russian
      const typeNames: Record<string, string> = {
        rect: 'прямоугольник',
        ellipse: 'эллипс',
        line: 'линия'
      };
      const typeName = typeNames[type] || type;

      // Attach event logs to the random shape
      const shapeId = `${typeName}_#${color.toString(16).padStart(6, '0')}`;
      g.on('pointerdown', () => config.addLog(`${shapeId}: нажатие (pointerdown)`));
      g.on('pointerup', () => config.addLog(`${shapeId}: отпускание (pointerup)`));

      config.mainContainer.addChild(g);
      config.addLog(`Система: Создана фигура ${shapeId} в точке (${Math.round(x)}, ${Math.round(y)})`);
      
      // Redraw Skia
      config.drawSkiaFrame();
    });
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      config.addLog('Система: Запуск экспорта в векторный PDF...');
      exportSceneToPDF(config.mainContainer, 600, 500, config.canvaskit);
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const toRemove: PIXI.DisplayObject[] = [];
      for (const child of config.mainContainer.children) {
        if (child.name === 'random') {
          toRemove.push(child);
        }
      }
      toRemove.forEach((child) => {
        config.mainContainer.removeChild(child);
        child.destroy();
      });
      config.addLog('Система: Все случайные фигуры удалены.');
      config.drawSkiaFrame();
    });
  }

  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      if (logEl) logEl.innerHTML = '';
    });
  }
}
