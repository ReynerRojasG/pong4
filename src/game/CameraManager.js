export class CameraManager {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
  }

  resize(width, height) {
    const camera = this.scene.cameras.main;
    const table = this.layout.table;
    const horizontalMargin = 1.16;
    const verticalMargin = 1.16;
    const zoom = Math.min(
      width / (table.width * horizontalMargin),
      height / (table.height * verticalMargin)
    );

    camera.setViewport(0, 0, width, height);
    camera.setZoom(zoom);
    camera.centerOn(
      this.layout.center.x,
      this.layout.center.y
    );
  }

  screenToWorld(x, y) {
    return this.scene.cameras.main.getWorldPoint(x, y);
  }

  getVisualRotation() {
    return 0;
  }
}
