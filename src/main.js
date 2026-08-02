import Phaser from 'phaser';
import './style.css';
import { BoardScene } from './scenes/BoardScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 960,
  backgroundColor: '#0d0e13',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 },
    },
  },
  scene: [BoardScene],
};

new Phaser.Game(config);
