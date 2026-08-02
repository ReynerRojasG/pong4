const STEPS = ['3', '2', '1', 'PONG'];
const STEP_DURATION = 1000;
const PONG_VISIBLE_DURATION = 420;

export class Countdown {
  constructor(scene, cameraManager, onComplete) {
    this.scene = scene;
    this.cameraManager = cameraManager;
    this.onComplete = onComplete;
    this.isActive = false;
    this.timer = null;

    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '96px',
      fontStyle: '700',
      color: '#e1fdff',
      align: 'center',
      stroke: '#00dbe7',
      strokeThickness: 2,
      shadow: {
        color: '#00dbe7',
        blur: 22,
        fill: true,
      },
    });
    this.label.setOrigin(0.5);
    this.label.setDepth(100);
    this.label.setVisible(false);
  }

  start() {
    this.stopTimer();
    this.scene.tweens.killTweensOf(this.label);
    this.isActive = true;
    this.stepIndex = 0;
    this.showStep();
  }

  showStep() {
    const step = STEPS[this.stepIndex];

    this.placeLabel();
    this.label.setText(step);
    this.label.setVisible(true);
    this.label.setAlpha(1);
    this.label.setScale(0.82);

    if (step === 'PONG') {
      this.isActive = false;
      this.onComplete();
      this.scene.tweens.add({
        targets: this.label,
        alpha: 0,
        scale: 1.08,
        duration: PONG_VISIBLE_DURATION,
        ease: 'Cubic.easeOut',
        onComplete: () => this.label.setVisible(false),
      });
      return;
    }

    this.scene.tweens.add({
      targets: this.label,
      alpha: 0.15,
      scale: 1.12,
      duration: STEP_DURATION - 120,
      ease: 'Cubic.easeOut',
    });

    this.timer = this.scene.time.delayedCall(STEP_DURATION, () => this.nextStep());
  }

  nextStep() {
    this.stepIndex += 1;
    this.showStep();
  }

  stopTimer() {
    if (this.timer) {
      this.timer.remove(false);
      this.timer = null;
    }
  }

  placeLabel() {
    const { x, y } = this.cameraManager.layout.center;

    this.label.setPosition(x, y);
    this.label.setRotation(-this.cameraManager.getVisualRotation());
  }
}