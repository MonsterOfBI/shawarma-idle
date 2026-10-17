import Phaser from 'phaser';
import { localPlatform } from './platform/platform';
import { StallScene } from './scenes/StallScene';

async function start() {
  const saved = await localPlatform.load();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 420,
    height: 640,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new StallScene(localPlatform, saved),
  });
}

void start();
