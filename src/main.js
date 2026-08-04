import Phaser from 'phaser';
import './style.css';
import { LobbyApp } from './lobby/LobbyApp.js';
import { MultiplayerClient } from './network/MultiplayerClient.js';
import { BoardScene } from './scenes/BoardScene.js';
import { MultiplayerBoardScene } from './scenes/MultiplayerBoardScene.js';

const appRoot = document.querySelector('#app');
const multiplayerClient = new MultiplayerClient();
let activeGame = null;
let lobby = null;

function createGameConfig(scene) {
  return {
    type: Phaser.AUTO,
    parent: 'game-canvas',
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
    scene: [scene],
  };
}

function createMatchBadge({ mode, room, player }) {
  const badge = document.createElement('aside');
  badge.className = 'match-badge';

  const modeLabel = document.createElement('span');
  modeLabel.textContent = mode === 'online'
    ? `SALA ${room.code} / SERVIDOR AUTORITATIVO`
    : 'MODO LOCAL';

  const playerLabel = document.createElement('strong');
  playerLabel.textContent = mode === 'online'
    ? `${player.name} / ${player.side.toUpperCase()}`
    : 'PC1 / LEFT';

  badge.append(modeLabel, playerLabel);
  return badge;
}

function startGame({ mode, room = null, player = null, state = null }) {
  lobby.destroy({ disconnect: mode === 'local' });
  appRoot.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'game-shell';

  const canvasHost = document.createElement('div');
  canvasHost.id = 'game-canvas';

  shell.append(canvasHost, createMatchBadge({ mode, room, player }));
  appRoot.append(shell);

  const scene = mode === 'online'
    ? new MultiplayerBoardScene({
      client: multiplayerClient,
      room,
      player,
      initialState: state,
      onExit: () => returnToLobby(),
    })
    : new BoardScene({ localPlayerSide: 'left' });
  activeGame = new Phaser.Game(createGameConfig(scene));
}

function startLobby() {
  lobby = new LobbyApp({
    root: appRoot,
    client: multiplayerClient,
    onMatchReady: ({ room, player, state }) => {
      startGame({ mode: 'online', room, player, state });
    },
    onStartLocal: () => {
      startGame({ mode: 'local' });
    },
  });

  lobby.start();
}

async function returnToLobby() {
  try {
    if (multiplayerClient.connected) {
      await multiplayerClient.leaveRoom();
    }
  } catch {
    multiplayerClient.disconnect();
  }

  activeGame?.destroy(true);
  activeGame = null;
  appRoot.replaceChildren();
  startLobby();
}

startLobby();

window.addEventListener('beforeunload', () => {
  multiplayerClient.disconnect();
  activeGame?.destroy(true);
});
