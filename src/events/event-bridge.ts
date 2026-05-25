import * as PIXI from 'pixi.js-legacy';

/**
 * Helper to calculate the shortest distance from point P = (px, py) to line segment AB = (x1, y1) to (x2, y2).
 */
function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  
  // Projection factor t, clamped to [0, 1]
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * Checks recursively if a coordinate in world (canvas) space hits an interactive PIXI object.
 * Returns the hit object, or null if nothing was hit.
 */
function hitTestDisplayObject(
  child: PIXI.DisplayObject,
  worldPoint: PIXI.Point
): PIXI.DisplayObject | null {
  if (!child.visible) return null;

  // 1. Recursively check children first (render order: top-most elements are checked first)
  if (child instanceof PIXI.Container && child.children && child.children.length > 0) {
    for (let i = child.children.length - 1; i >= 0; i--) {
      const hit = hitTestDisplayObject(child.children[i], worldPoint);
      if (hit) return hit;
    }
  }

  // 2. If no children hit, check if this child itself is interactive and is hit
  if (child.interactive) {
    // Convert world space coordinates to this child's local coordinate space
    const localPoint = new PIXI.Point();
    child.worldTransform.applyInverse(worldPoint, localPoint);

    if (child instanceof PIXI.Graphics) {
      const geometry = child.geometry;
      if (geometry && geometry.graphicsData) {
        for (const data of geometry.graphicsData) {
          const shape = data.shape;
          if (!shape) continue;

          // Special handling for Polygon (which represents lines/paths in PixiJS Graphics)
          if (shape.type === PIXI.SHAPES.POLY) {
            const poly = shape as PIXI.Polygon;
            // 2a. Check if point is inside if there's a fill
            if (data.fillStyle && data.fillStyle.visible && poly.contains(localPoint.x, localPoint.y)) {
              return child;
            }
            // 2b. Check distance to each segment if there's a stroke (helps with lines/curves)
            if (data.lineStyle && data.lineStyle.visible && data.lineStyle.width > 0) {
              const points = poly.points;
              // Add a click tolerance buffer (+ 3 pixels) on top of the stroke radius
              const tolerance = data.lineStyle.width / 2 + 3;
              for (let i = 0; i < points.length - 2; i += 2) {
                const dist = distanceToSegment(
                  localPoint.x,
                  localPoint.y,
                  points[i],
                  points[i + 1],
                  points[i + 2],
                  points[i + 3]
                );
                if (dist <= tolerance) {
                  return child;
                }
              }
              // Check closed connection if closed polygon
              if (poly.closeStroke && points.length >= 6) {
                const len = points.length;
                const dist = distanceToSegment(
                  localPoint.x,
                  localPoint.y,
                  points[len - 2],
                  points[len - 1],
                  points[0],
                  points[1]
                );
                if (dist <= tolerance) {
                  return child;
                }
              }
            }
          } else {
            // Circle, Ellipse, Rectangle, etc.
            if (shape.contains(localPoint.x, localPoint.y)) {
              return child;
            }
          }
        }
      }
    } else if (child instanceof PIXI.Sprite) {
      const width = child.width;
      const height = child.height;
      const anchorX = child.anchor ? child.anchor.x : 0;
      const anchorY = child.anchor ? child.anchor.y : 0;

      const left = -anchorX * width;
      const right = (1 - anchorX) * width;
      const top = -anchorY * height;
      const bottom = (1 - anchorY) * height;

      if (localPoint.x >= left && localPoint.x <= right && localPoint.y >= top && localPoint.y <= bottom) {
        return child;
      }
    }
  }

  return null;
}

/**
 * Attaches pointerdown and pointerup event handlers to the Skia canvas,
 * hit-tests the click coordinates, and bridges the events back to the PIXI stage objects.
 */
export function setupEventBridge(
  skiaCanvasElement: HTMLCanvasElement,
  mainContainer: PIXI.Container
): void {
  // Store the active target to match pointerdown and pointerup sequences
  let activeTarget: PIXI.DisplayObject | null = null;

  skiaCanvasElement.addEventListener('pointerdown', (e) => {
    const rect = skiaCanvasElement.getBoundingClientRect();
    // Calculate click coordinates relative to the canvas element
    const worldPoint = new PIXI.Point(
      e.clientX - rect.left,
      e.clientY - rect.top
    );

    const hit = hitTestDisplayObject(mainContainer, worldPoint);
    if (hit) {
      activeTarget = hit;
      hit.emit('pointerdown', e as any);
    }
  });

  skiaCanvasElement.addEventListener('pointerup', (e) => {
    const rect = skiaCanvasElement.getBoundingClientRect();
    const worldPoint = new PIXI.Point(
      e.clientX - rect.left,
      e.clientY - rect.top
    );

    const hit = hitTestDisplayObject(mainContainer, worldPoint);
    
    // Trigger pointerup on the hit target
    if (hit) {
      hit.emit('pointerup', e as any);
    }

    // Also trigger pointerup on the active pointerdown target if it's different (standard pointer behavior)
    if (activeTarget && activeTarget !== hit) {
      activeTarget.emit('pointerup', e as any);
    }
    
    activeTarget = null;
  });
}
