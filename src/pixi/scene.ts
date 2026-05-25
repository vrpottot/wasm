import * as PIXI from 'pixi.js-legacy';

export interface SceneContext {
  app: PIXI.Application;
  mainContainer: PIXI.Container;
  g1: PIXI.Graphics;
  g2: PIXI.Graphics;
  g3: PIXI.Graphics;
  g4: PIXI.Graphics;
  sprite: PIXI.Sprite | null;
}

export function initPixiApp(
  canvas: HTMLCanvasElement,
  onUpdate: () => void,
  onLog: (msg: string) => void
): SceneContext {
  // 1. Initialize PIXI Application with forceCanvas = true
  const app = new PIXI.Application({
    view: canvas,
    width: 600,
    height: 500,
    backgroundColor: 0x111827, // Dark grey background (#111827)
    forceCanvas: true,
    antialias: true
  });

  const mainContainer = new PIXI.Container();
  app.stage.addChild(mainContainer);

  const subContainer = new PIXI.Container();

  // Create G1: Red Ellipse
  const g1 = new PIXI.Graphics();
  g1.beginFill(0xff0000).drawEllipse(0, 0, 200, 100).endFill();
  g1.position.set(200, 100);
  g1.angle = 30;
  g1.interactive = true;
  g1.cursor = 'pointer';
  g1.on('pointerdown', () => {
    onLog('g1 (эллипс): нажатие (pointerdown)');
  });
  g1.on('pointerup', () => {
    onLog('g1 (эллипс): отпускание (pointerup)');
  });

  // Create G2: Blue Rectangle
  const g2 = new PIXI.Graphics();
  g2.beginFill(0x0000ff).drawRect(-50, -75, 100, 150).endFill();
  g2.position.set(120, 60);
  g2.angle = 15;
  g2.scale.set(1.5, 1.7);
  g2.interactive = true;
  g2.cursor = 'pointer';
  g2.on('pointerdown', () => {
    onLog('g2 (прямоугольник): нажатие (pointerdown)');
  });
  g2.on('pointerup', () => {
    onLog('g2 (прямоугольник): отпускание (pointerup)');
  });

  // Create G3: White Line
  const g3 = new PIXI.Graphics();
  g3.lineStyle(10, 0xffffff, 1).moveTo(0, 0).lineTo(150, 100);
  g3.angle = -20;
  g3.interactive = true;
  g3.cursor = 'pointer';
  g3.on('pointerdown', () => {
    onLog('g3 (линия): нажатие (pointerdown)');
  });
  g3.on('pointerup', () => {
    onLog('g3 (линия): отпускание (pointerup)');
  });

  // Create G4: Yellow Line
  const g4 = new PIXI.Graphics();
  g4.lineStyle(10, 0xffff00, 1).moveTo(0, 70).lineTo(150, -30);
  g4.angle = 20;
  g4.interactive = true;
  g4.cursor = 'pointer';
  g4.on('pointerdown', () => {
    onLog('g4 (линия): нажатие (pointerdown)');
  });
  g4.on('pointerup', () => {
    onLog('g4 (линия): отпускание (pointerup)');
  });

  // Set up hierarchy
  subContainer.position.set(75, 50);
  subContainer.addChild(g3, g4);
  mainContainer.addChild(subContainer, g1, g2);

  // Load a Sprite (glowing orb) as a bitmap
  const spriteTexture = PIXI.Texture.from('/assets/sprite.png');
  const sprite = new PIXI.Sprite(spriteTexture);
  sprite.position.set(380, 320);
  sprite.anchor.set(0.5);
  sprite.scale.set(0.4); // Scale down a bit
  sprite.angle = -15;
  sprite.interactive = true;
  sprite.cursor = 'pointer';
  sprite.on('pointerdown', () => {
    onLog('спрайт (картинка): нажатие (pointerdown)');
  });
  sprite.on('pointerup', () => {
    onLog('спрайт (картинка): отпускание (pointerup)');
  });

  // When texture is loaded, force update
  spriteTexture.baseTexture.on('loaded', () => {
    onUpdate();
  });

  mainContainer.addChild(sprite);

  return {
    app,
    mainContainer,
    g1,
    g2,
    g3,
    g4,
    sprite
  };
}
