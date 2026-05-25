import * as PIXI from 'pixi.js-legacy';
import type { Canvas, CanvasKit, Image } from '@rollerbird/canvaskit-wasm-pdf';

const imageCache = new WeakMap<PIXI.BaseTexture, Image>();

/**
 * Gets or creates a CanvasKit Image from a PIXI.BaseTexture, cached via a WeakMap.
 */
function getSkiaImage(canvaskit: CanvasKit, baseTexture: PIXI.BaseTexture): Image | null {
  if (imageCache.has(baseTexture)) {
    return imageCache.get(baseTexture) || null;
  }

  // Retrieve the DOM image source (HTMLImageElement, HTMLCanvasElement, or ImageBitmap)
  const source = (baseTexture.resource as any)?.source;
  if (source && (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof ImageBitmap)) {
    try {
      const img = canvaskit.MakeImageFromCanvasImageSource(source);
      if (img) {
        imageCache.set(baseTexture, img);
        return img;
      }
    } catch (e) {
      console.error('Failed to create Skia Image from PIXI texture source:', e);
    }
  }
  return null;
}

/**
 * Draws a PIXI.Graphics object onto the Skia Canvas.
 */
function renderGraphics(graphics: PIXI.Graphics, canvas: Canvas, canvaskit: CanvasKit, accumAlpha: number) {
  const geometry = graphics.geometry;
  if (!geometry || !geometry.graphicsData) return;

  for (const data of geometry.graphicsData) {
    const shape = data.shape;
    if (!shape) continue;

    // 1. Set up Fill Paint
    let fillPaint: any = null;
    if (data.fillStyle && data.fillStyle.visible) {
      fillPaint = new canvaskit.Paint();
      fillPaint.setStyle(canvaskit.PaintStyle.Fill);
      const colorVal = data.fillStyle.color;
      const alphaVal = data.fillStyle.alpha * accumAlpha;
      fillPaint.setColor(
        canvaskit.Color(
          (colorVal >> 16) & 0xff,
          (colorVal >> 8) & 0xff,
          colorVal & 0xff,
          alphaVal
        )
      );
    }

    // 2. Set up Stroke Paint
    let strokePaint: any = null;
    if (data.lineStyle && data.lineStyle.visible && data.lineStyle.width > 0) {
      strokePaint = new canvaskit.Paint();
      strokePaint.setStyle(canvaskit.PaintStyle.Stroke);
      strokePaint.setStrokeWidth(data.lineStyle.width);
      const colorVal = data.lineStyle.color;
      const alphaVal = data.lineStyle.alpha * accumAlpha;
      strokePaint.setColor(
        canvaskit.Color(
          (colorVal >> 16) & 0xff,
          (colorVal >> 8) & 0xff,
          colorVal & 0xff,
          alphaVal
        )
      );
      // Map caps and joins
      if (data.lineStyle.cap === PIXI.LINE_CAP.ROUND) {
        strokePaint.setStrokeCap(canvaskit.StrokeCap.Round);
      } else if (data.lineStyle.cap === PIXI.LINE_CAP.SQUARE) {
        strokePaint.setStrokeCap(canvaskit.StrokeCap.Square);
      } else {
        strokePaint.setStrokeCap(canvaskit.StrokeCap.Butt);
      }

      if (data.lineStyle.join === PIXI.LINE_JOIN.ROUND) {
        strokePaint.setStrokeJoin(canvaskit.StrokeJoin.Round);
      } else if (data.lineStyle.join === PIXI.LINE_JOIN.BEVEL) {
        strokePaint.setStrokeJoin(canvaskit.StrokeJoin.Bevel);
      } else {
        strokePaint.setStrokeJoin(canvaskit.StrokeJoin.Miter);
      }
    }

    if (!fillPaint && !strokePaint) continue;

    // 3. Draw based on shape type
    // In Pixi, shape types are constants:
    // 0: Rectangle, 1: Circle, 2: Ellipse, 3: Polygon, 4: RoundedRectangle
    const shapeType = shape.type;

    if (shapeType === PIXI.SHAPES.RECT) {
      const rect = shape as PIXI.Rectangle;
      const skRect = canvaskit.XYWHRect(rect.x, rect.y, rect.width, rect.height);
      if (fillPaint) canvas.drawRect(skRect, fillPaint);
      if (strokePaint) canvas.drawRect(skRect, strokePaint);
    } else if (shapeType === PIXI.SHAPES.CIRC) {
      const circ = shape as PIXI.Circle;
      if (fillPaint) canvas.drawCircle(circ.x, circ.y, circ.radius, fillPaint);
      if (strokePaint) canvas.drawCircle(circ.x, circ.y, circ.radius, strokePaint);
    } else if (shapeType === PIXI.SHAPES.ELIP) {
      const elip = shape as PIXI.Ellipse;
      const skRect = canvaskit.LTRBRect(
        elip.x - elip.width,
        elip.y - elip.height,
        elip.x + elip.width,
        elip.y + elip.height
      );
      if (fillPaint) canvas.drawOval(skRect, fillPaint);
      if (strokePaint) canvas.drawOval(skRect, strokePaint);
    } else if (shapeType === PIXI.SHAPES.RREC) {
      const rrec = shape as PIXI.RoundedRectangle;
      const skRect = canvaskit.XYWHRect(rrec.x, rrec.y, rrec.width, rrec.height);
      const skRrect = canvaskit.RRectXY(skRect, rrec.radius, rrec.radius);
      if (fillPaint) canvas.drawRRect(skRrect, fillPaint);
      if (strokePaint) canvas.drawRRect(skRrect, strokePaint);
    } else if (shapeType === PIXI.SHAPES.POLY) {
      const poly = shape as PIXI.Polygon;
      const points = poly.points;
      if (points && points.length >= 4) {
        const path = new canvaskit.Path();
        path.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) {
          path.lineTo(points[i], points[i + 1]);
        }
        
        // Polygons are closed for filling, or if closeStroke is explicitly true
        if (fillPaint || poly.closeStroke) {
          path.close();
        }

        if (fillPaint) canvas.drawPath(path, fillPaint);
        if (strokePaint) canvas.drawPath(path, strokePaint);
        path.delete();
      }
    }

    // Clean up Paint resources
    if (fillPaint) fillPaint.delete();
    if (strokePaint) strokePaint.delete();
  }
}

/**
 * Draws a PIXI.Sprite object onto the Skia Canvas.
 */
function renderSprite(sprite: PIXI.Sprite, canvas: Canvas, canvaskit: CanvasKit, accumAlpha: number) {
  if (!sprite.texture || !sprite.texture.valid) return;

  const skImg = getSkiaImage(canvaskit, sprite.texture.baseTexture);
  if (skImg) {
    const width = sprite.width;
    const height = sprite.height;
    
    // In Pixi, anchor determines the center of drawing. Default is (0, 0)
    const anchorX = sprite.anchor ? sprite.anchor.x : 0;
    const anchorY = sprite.anchor ? sprite.anchor.y : 0;

    const srcRect = canvaskit.XYWHRect(0, 0, skImg.width(), skImg.height());
    const destRect = canvaskit.XYWHRect(
      -anchorX * width,
      -anchorY * height,
      width,
      height
    );

    const paint = new canvaskit.Paint();
    paint.setAlphaf(accumAlpha);
    
    canvas.drawImageRect(skImg, srcRect, destRect, paint, false);
    paint.delete();
  }
}

/**
 * Core recursive function to traverse the PIXI tree and apply coordinate spaces + rendering.
 */
function renderObject(child: PIXI.DisplayObject, canvas: Canvas, canvaskit: CanvasKit, parentAlpha: number) {
  if (!child.visible || child.alpha <= 0) return;

  const accumAlpha = parentAlpha * child.alpha;

  canvas.save();

  // Apply absolute world matrix directly in Skia coordinate space
  const wt = child.worldTransform;
  const skMatrix = [
    wt.a, wt.c, wt.tx,
    wt.b, wt.d, wt.ty,
    0,    0,    1
  ];
  canvas.concat(skMatrix);

  // Draw current object
  if (child instanceof PIXI.Graphics) {
    renderGraphics(child, canvas, canvaskit, accumAlpha);
  } else if (child instanceof PIXI.Sprite) {
    renderSprite(child, canvas, canvaskit, accumAlpha);
  }

  canvas.restore();

  // Recurse to children (no need to save/restore canvas transforms recursively
  // since child worldTransform is already absolute and includes parent matrix)
  if (child instanceof PIXI.Container && child.children && child.children.length > 0) {
    for (const grandChild of child.children) {
      renderObject(grandChild, canvas, canvaskit, accumAlpha);
    }
  }
}

/**
 * Main wrapper entrypoint: converts a PIXI.Container into Skia rendering commands.
 */
export function convertPixiContainerToSkia(
  container: PIXI.Container,
  skiaCanvas: Canvas,
  canvaskit: CanvasKit
): void {
  // Render children of the main container using local alpha 1.0
  if (container.children) {
    for (const child of container.children) {
      renderObject(child, skiaCanvas, canvaskit, 1.0);
    }
  }
}
