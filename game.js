const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const sceneName = document.querySelector('#sceneName');
const sceneIndex = document.querySelector('#sceneIndex');
const questNote = document.querySelector('#questNote');
const nearbyPrompt = document.querySelector('#nearbyPrompt');
const toast = document.querySelector('#toast');
const entryOverlay = document.querySelector('#entryOverlay');
const entrySkins = document.querySelector('#entrySkins');
const shopItems = document.querySelector('#shopItems');
const roomLabel = document.querySelector('#roomLabel');
const joystick = document.querySelector('#joystick');
const joystickKnob = document.querySelector('#joystickKnob');
const staticPages = location.hostname.endsWith('.github.io');

const WORLD_WIDTH = 2400;
const scenes = [
  { id: 'reed', name: '芦苇渡口', sky: ['#9fc1ad', '#e7cc9d'], far: '#779b84', mid: '#537864', ground: '#405f49', water: '#72998d', accent: '#e5c785', landmark: '旧渡牌' },
  { id: 'vine', name: '悬藤谷', sky: ['#a8b99a', '#d2bd8c'], far: '#718d72', mid: '#506d59', ground: '#3c5748', water: '#667f65', accent: '#d8a974', landmark: '石中回声' },
  { id: 'cloud', name: '云上石庭', sky: ['#8cb9bb', '#e5c89c'], far: '#8baca5', mid: '#637f78', ground: '#4b655d', water: '#a3c4b8', accent: '#f0d291', landmark: '无根之树' },
  { id: 'altar', name: '夜潮祭坛', sky: ['#263e4d', '#a76f67'], far: '#405963', mid: '#354d4c', ground: '#263d3b', water: '#4d7370', accent: '#e99870', landmark: '潮汐石灯' },
];

const skins = [
  { id: 'mist', name: '雾青', subtitle: '渡口旧衣', coat: '#769d8c', trim: '#d8c795', face: '#e8c39c', hair: '#263a35', price: 0 },
  { id: 'coral', name: '晚霞', subtitle: '落日余温', coat: '#d17b64', trim: '#f0c77b', face: '#e7bd91', hair: '#533a34', price: 0 },
  { id: 'moss', name: '苔痕', subtitle: '山径拾来', coat: '#829052', trim: '#d9ca8d', face: '#e8c49b', hair: '#343b2b', price: 0 },
  { id: 'ink', name: '墨潮', subtitle: '夜行斗篷', coat: '#536d82', trim: '#c4b8a2', face: '#eac5a0', hair: '#283343', price: 65 },
  { id: 'sun', name: '金乌', subtitle: '向阳而行', coat: '#d6a64f', trim: '#f2d89e', face: '#e7bd91', hair: '#59402b', price: 90 },
  { id: 'plum', name: '山茶', subtitle: '花影入袖', coat: '#a85d68', trim: '#e5b3a5', face: '#e8c39c', hair: '#49313a', price: 120 },
];

const coinPoints = [
  [290, 695, 1080, 1530],
  [340, 820, 1390, 1910],
  [260, 730, 1240, 1790],
  [440, 990, 1510, 2050],
];
const stories = [
  { x: 590, text: '渡口的船家说，雾会记住每个认真告别的人。' },
  { x: 1150, text: '藤蔓攀过千年石壁，替山谷把旧歌留了下来。' },
  { x: 1050, text: '树梢托住一小片天，风从云背后慢慢经过。' },
  { x: 1250, text: '石灯里还留着暖意，像是有人刚刚离开。' },
];
const keyState = new Set();
const input = { x: 0, y: 0 };
const player = { x: 110, lane: 0, jump: 0, jumpSpeed: 0, facing: 1, scene: 0, skin: 'mist', name: '拾雾的人' };
const state = {
  coins: 0,
  owned: ['mist', 'coral', 'moss'],
  collected: [],
  remotes: [],
  room: '',
  id: crypto.randomUUID(),
  lastSync: 0,
  lastToast: 0,
  toastTimer: 0,
  storySeen: [],
  started: false,
};

let width = innerWidth;
let height = innerHeight;
let dpr = Math.min(devicePixelRatio || 1, 2);
let camera = 0;
let previousFrame = performance.now();
let networkTimer;
let touchPointer = null;
let hasChosenEntrySkin = false;

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem('mist-island-save') || '{}');
    state.coins = Math.max(0, Number(saved.coins) || 0);
    state.owned = Array.isArray(saved.owned) ? [...new Set(['mist', 'coral', 'moss', ...saved.owned.filter((id) => skins.some((skin) => skin.id === id))])] : ['mist', 'coral', 'moss'];
    state.collected = Array.isArray(saved.collected) ? saved.collected : [];
    player.skin = state.owned.includes(saved.skin) ? saved.skin : 'mist';
  } catch {
    state.owned = ['mist', 'coral', 'moss'];
  }
  updateCoinCount();
}

function saveGame() {
  localStorage.setItem('mist-island-save', JSON.stringify({ coins: state.coins, owned: state.owned, collected: state.collected, skin: player.skin }));
}

function updateCoinCount() {
  document.querySelector('#coinCount').textContent = state.coins;
  document.querySelector('#shopCoinCount').textContent = state.coins;
}

function renderSkinOptions() {
  entrySkins.replaceChildren();
  skins.filter((skin) => state.owned.includes(skin.id)).forEach((skin) => {
    const button = document.createElement('button');
    button.className = `skin-option${hasChosenEntrySkin && player.skin === skin.id ? ' selected' : ''}`;
    button.style.setProperty('--skin-coat', skin.coat);
    button.style.setProperty('--skin-face', skin.face);
    button.innerHTML = `<span class="skin-swatch" aria-hidden="true"></span><strong>${skin.name}</strong><small>${skin.subtitle}</small>`;
    button.addEventListener('click', () => {
      player.skin = skin.id;
      hasChosenEntrySkin = true;
      document.querySelector('#startJourney').disabled = false;
      renderSkinOptions();
    });
    entrySkins.append(button);
  });
}

function renderShop() {
  shopItems.replaceChildren();
  skins.forEach((skin) => {
    const owned = state.owned.includes(skin.id);
    const item = document.createElement('div');
    item.className = 'shop-item';
    item.style.setProperty('--skin-coat', skin.coat);
    item.style.setProperty('--skin-face', skin.face);
    const button = document.createElement('button');
    button.textContent = owned ? (player.skin === skin.id ? '正在穿' : '已拥有') : `✦ ${skin.price}`;
    button.disabled = owned || state.coins < skin.price;
    button.addEventListener('click', () => {
      if (state.coins < skin.price) return showToast('潮光还不够，再去岛上走走吧。');
      state.coins -= skin.price;
      state.owned.push(skin.id);
      player.skin = skin.id;
      saveGame();
      updateCoinCount();
      renderShop();
      renderSkinOptions();
      showToast(`换得「${skin.name}」，新衣裳已经备好。`);
    });
    const info = document.createElement('div');
    info.className = 'shop-item-info';
    info.innerHTML = `<strong>${skin.name}</strong><small>${skin.subtitle}${owned ? ' · 已收进衣箱' : ` · ${skin.price} 枚潮光`}</small>`;
    item.innerHTML = '<span class="skin-swatch" aria-hidden="true"></span>';
    item.append(info, button);
    shopItems.append(item);
  });
}

function resize() {
  width = innerWidth;
  height = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seeded(index, offset = 0) {
  const value = Math.sin(index * 127.1 + offset * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}

function drawBackground(scene, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, scene.sky[0]);
  sky.addColorStop(.68, scene.sky[1]);
  sky.addColorStop(1, scene.water);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * .73;
  const sunY = height * (scene.id === 'altar' ? .2 : .24);
  ctx.globalAlpha = scene.id === 'altar' ? .86 : .75;
  ctx.fillStyle = scene.accent;
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.min(42, width * .048), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const horizon = height * .63;
  for (let layer = 0; layer < 3; layer += 1) {
    const color = [scene.far, scene.mid, scene.ground][layer];
    const baseY = horizon + layer * height * .055;
    const shift = camera * [.1, .2, .34][layer];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, baseY);
    for (let worldX = -350; worldX < WORLD_WIDTH + 500; worldX += 270) {
      const localX = worldX - shift;
      const peak = baseY - (38 + seeded(worldX, layer) * height * .17);
      ctx.quadraticCurveTo(localX + 95, peak + 32, localX + 175, baseY + 9);
      ctx.quadraticCurveTo(localX + 225, baseY + 25, localX + 270, baseY);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  const floor = height * .77;
  ctx.fillStyle = scene.ground;
  ctx.fillRect(0, floor, width, height - floor);
  ctx.fillStyle = scene.water;
  ctx.globalAlpha = .36;
  ctx.fillRect(0, floor - 4, width, 15);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `${scene.accent}66`;
  ctx.lineWidth = 1;
  for (let index = 0; index < 14; index += 1) {
    const x = ((index * 197 + time * .012) % (width + 100)) - 50;
    const y = floor + 12 + (index % 4) * 10;
    ctx.globalAlpha = .14 + (index % 3) * .04;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 25, y - 3, x + 53, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawReeds(scene) {
  const floor = height * .77;
  const first = Math.floor(camera / 100) - 1;
  for (let index = first; index < first + Math.ceil(width / 100) + 3; index += 1) {
    const x = index * 100 + seeded(index, player.scene) * 48;
    const stalkHeight = 28 + seeded(index, 4) * 75;
    const color = index % 2 ? '#536f4f' : '#718654';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, floor + 4);
    ctx.quadraticCurveTo(x - 9, floor - stalkHeight * .65, x + Math.sin(performance.now() * .001 + index) * 5, floor - stalkHeight);
    ctx.stroke();
    ctx.fillStyle = index % 3 ? '#c1ab6f' : '#9d9770';
    ctx.beginPath();
    ctx.ellipse(x + 2, floor - stalkHeight, 3, 8, -.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSceneFeatures(scene, time) {
  const floor = height * .77;
  ctx.save();
  ctx.translate(-camera, 0);

  if (scene.id === 'reed') {
    drawReeds(scene);
    for (const x of [180, 820, 1470, 2040]) {
      polygon([[x - 54, floor + 12], [x - 17, floor - 33], [x + 25, floor - 42], [x + 68, floor + 12]], '#526d5b');
      polygon([[x - 22, floor - 10], [x + 2, floor - 37], [x + 34, floor - 10]], '#6b8063');
    }
    const boardX = 880;
    ctx.fillStyle = '#806849';
    ctx.fillRect(boardX, floor - 68, 7, 72);
    ctx.fillRect(boardX - 25, floor - 70, 56, 27);
    ctx.fillStyle = '#d7c18e';
    ctx.font = '12px serif';
    ctx.fillText('渡', boardX - 7, floor - 51);
    ctx.fillStyle = 'rgba(230,220,190,.25)';
    ctx.fillRect(0, floor - 2, WORLD_WIDTH, 3);
  } else if (scene.id === 'vine') {
    for (let index = 0; index < 8; index += 1) {
      const x = 170 + index * 300;
      const archHeight = 80 + seeded(index, 2) * 95;
      ctx.fillStyle = '#445c4c';
      ctx.fillRect(x, floor - archHeight, 27, archHeight + 9);
      ctx.fillRect(x + 102, floor - archHeight + 12, 27, archHeight - 3);
      ctx.fillRect(x - 12, floor - archHeight - 14, 152, 21);
      ctx.fillStyle = '#70815e';
      ctx.fillRect(x + 4, floor - archHeight + 20, 6, 18);
      ctx.strokeStyle = '#6f8e60';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 42, floor - archHeight - 5);
      ctx.bezierCurveTo(x + 37, floor - 95, x + 90, floor - 135, x + 63, floor - 31);
      ctx.stroke();
      ctx.fillStyle = '#a4a06a';
      ctx.beginPath();
      ctx.ellipse(x + 58, floor - 74, 6, 11, .6, 0, Math.PI * 2);
      ctx.fill();
    }
    polygon([[730, floor], [755, floor - 54], [780, floor - 68], [803, floor - 42], [828, floor]], '#8b8c68');
    ctx.fillStyle = '#475a4a';
    ctx.fillRect(763, floor - 37, 31, 37);
  } else if (scene.id === 'cloud') {
    for (let index = 0; index < 7; index += 1) {
      const x = 150 + index * 350;
      const top = floor - 52 - seeded(index, 7) * 94;
      polygon([[x - 54, floor + 9], [x - 26, top + 8], [x + 20, top], [x + 58, floor + 9]], '#65766b');
      polygon([[x - 10, top + 10], [x + 5, top - 8], [x + 27, top + 8]], '#8ca18d');
      ctx.fillStyle = '#798a72';
      ctx.fillRect(x - 4, top - 77, 9, 78);
      ctx.beginPath();
      ctx.arc(x, top - 86, 33, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 25, top - 73, 22, 0, Math.PI * 2);
      ctx.arc(x + 23, top - 69, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d2bc84';
      ctx.beginPath();
      ctx.arc(x + 14, top + 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let index = 0; index < 5; index += 1) {
      const cloudX = (index * 470 + time * .008) % (WORLD_WIDTH + 200) - 100;
      ctx.fillStyle = 'rgba(234,239,213,.38)';
      ctx.beginPath();
      ctx.ellipse(cloudX, height * (.32 + index % 2 * .09), 45, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(cloudX + 22, height * (.32 + index % 2 * .09) - 5, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let index = 0; index < 6; index += 1) {
      const x = 230 + index * 370;
      const scale = .8 + seeded(index, 1) * .35;
      ctx.fillStyle = '#344b48';
      ctx.fillRect(x, floor - 140 * scale, 160 * scale, 140 * scale);
      ctx.fillStyle = '#586c5d';
      ctx.fillRect(x - 12, floor - 151 * scale, 185 * scale, 18);
      ctx.fillStyle = '#263d3b';
      ctx.fillRect(x + 22, floor - 97 * scale, 24, 42 * scale);
      ctx.fillRect(x + 104, floor - 97 * scale, 24, 42 * scale);
      ctx.fillStyle = '#e99870';
      ctx.globalAlpha = .55 + Math.sin(time * .002 + index) * .2;
      ctx.beginPath();
      ctx.arc(x + 85, floor - 70 * scale, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (let index = 0; index < 12; index += 1) {
      const x = (index * 211 + time * .004) % WORLD_WIDTH;
      const y = 52 + seeded(index, 9) * height * .43;
      ctx.fillStyle = `rgba(242,211,154,${.35 + seeded(index, 3) * .55})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  drawGate(scene, floor);
  ctx.restore();
}

function drawGate(scene, floor) {
  const gateX = WORLD_WIDTH - 100;
  ctx.fillStyle = scene.id === 'altar' ? '#b77f63' : '#9c936d';
  ctx.fillRect(gateX - 25, floor - 87, 12, 91);
  ctx.fillRect(gateX + 17, floor - 87, 12, 91);
  ctx.fillRect(gateX - 33, floor - 93, 70, 11);
  ctx.strokeStyle = scene.accent;
  ctx.globalAlpha = .72;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(gateX, floor - 54, 27, 38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = scene.accent;
  ctx.font = '10px serif';
  ctx.fillText(scene.id === 'altar' ? '潮' : '雾', gateX - 5, floor - 48);
}

function drawCoin(x, y, time, index) {
  const bob = Math.sin(time * .004 + index * 1.7) * 4;
  ctx.save();
  ctx.translate(x - camera, y + bob);
  ctx.globalAlpha = .2;
  ctx.fillStyle = '#ffe5a0';
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#efd18e';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 11);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff1c8';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(x, lane, skin, name, facing, jump, time, isRemote = false) {
  const outfit = skins.find((entry) => entry.id === skin) || skins[0];
  const floor = height * .77;
  const baseY = floor + lane * 30 - jump;
  const step = Math.sin(time * .014 + x * .02) * 2;
  const px = x - camera;
  ctx.save();
  ctx.translate(px, baseY);
  ctx.scale(facing || 1, 1);
  ctx.globalAlpha = isRemote ? .78 : 1;
  ctx.fillStyle = 'rgba(19,34,29,.28)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#443d33';
  ctx.fillRect(-8, -15 + step, 6, 14);
  ctx.fillRect(2, -15 - step, 6, 14);
  ctx.fillStyle = outfit.coat;
  ctx.fillRect(-12, -38, 24, 25);
  ctx.fillRect(-15, -34, 5, 18);
  ctx.fillRect(10, -34, 5, 18);
  ctx.fillStyle = outfit.trim;
  ctx.fillRect(-1, -37, 3, 22);
  ctx.fillRect(-11, -16, 22, 3);
  ctx.fillStyle = outfit.face;
  ctx.fillRect(-8, -55, 17, 18);
  ctx.fillStyle = outfit.hair;
  ctx.fillRect(-10, -57, 19, 7);
  ctx.fillRect(-10, -53, 4, 9);
  ctx.fillRect(3, -54, 6, 5);
  ctx.fillStyle = '#433b33';
  ctx.fillRect(4, -48, 2, 2);
  ctx.fillStyle = outfit.trim;
  ctx.fillRect(-13, -60, 24, 3);
  ctx.fillRect(-6, -63, 12, 4);
  ctx.globalAlpha = 1;
  ctx.scale(1 / (facing || 1), 1);
  ctx.textAlign = 'center';
  ctx.font = '10px serif';
  ctx.fillStyle = 'rgba(248,241,218,.95)';
  ctx.fillText(name, 0, -70);
  ctx.restore();
}

function draw(time) {
  const scene = scenes[player.scene];
  camera = Math.max(0, Math.min(WORLD_WIDTH - width, player.x - width * .45));
  drawBackground(scene, time);
  drawSceneFeatures(scene, time);

  const floor = height * .77;
  coinPoints[player.scene].forEach((x, index) => {
    const key = `${scene.id}:${index}`;
    if (!state.collected.includes(key)) drawCoin(x, floor - 41 - (index % 2) * 12, time, index);
  });

  for (const remote of state.remotes) {
    if (remote.scene !== scene.id || !Number.isFinite(remote.x)) continue;
    drawPlayer(remote.x, (remote.y - 225) / 100, remote.skin, remote.name, 1, 0, time, true);
  }
  drawPlayer(player.x, player.lane, player.skin, player.name, player.facing, player.jump, time);
  updateHud(scene);
}

function updateHud(scene) {
  sceneName.textContent = scene.name;
  sceneIndex.textContent = `${String(player.scene + 1).padStart(2, '0')} / 04`;
  const total = coinPoints.flat().length;
  const gathered = state.collected.length;
  questNote.querySelector('p').textContent = gathered >= total ? '潮光都已收好，去渡口尽头看看。' : `收集散落的潮光（${gathered}/${total}），去渡口尽头看看。`;

  const closeStory = Math.abs(player.x - stories[player.scene].x) < 70;
  const nearGate = player.x > WORLD_WIDTH - 180;
  const nearReturn = player.x < 70 && player.scene > 0;
  nearbyPrompt.hidden = !closeStory && !nearGate && !nearReturn;
  const promptText = nearbyPrompt.querySelector('span');
  promptText.textContent = closeStory ? `聆听「${scene.landmark}」` : nearReturn ? '回到上一处风景' : player.scene === scenes.length - 1 ? '前路仍在更新' : '与雾门交谈';
  nearbyPrompt.querySelector('kbd').textContent = 'E';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

function collectCoins() {
  const floor = height * .77;
  coinPoints[player.scene].forEach((x, index) => {
    const key = `${scenes[player.scene].id}:${index}`;
    if (!state.collected.includes(key) && Math.abs(player.x - x) < 29) {
      state.collected.push(key);
      state.coins += 1;
      saveGame();
      updateCoinCount();
      showToast('拾得一枚潮光，收进山海钱袋。');
    }
  });
}

function interact() {
  if (!state.started) return;
  const story = stories[player.scene];
  if (Math.abs(player.x - story.x) < 100) {
    state.storySeen.push(player.scene);
    showToast(story.text);
    return;
  }
  if (player.x > WORLD_WIDTH - 180 && player.scene < scenes.length - 1) {
    player.scene += 1;
    player.x = 100;
    player.lane = 0;
    showToast(`来到「${scenes[player.scene].name}」。`);
    return;
  }
  if (player.x > WORLD_WIDTH - 180 && player.scene === scenes.length - 1) {
    openModal('updateOverlay');
    return;
  }
  if (player.x < 70 && player.scene > 0) {
    player.scene -= 1;
    player.x = WORLD_WIDTH - 120;
    player.lane = 0;
    showToast(`回到「${scenes[player.scene].name}」。`);
    return;
  }
  showToast('风从海那边吹来，带着潮湿的草木气息。');
}

function jump() {
  if (player.jump <= 0.1) player.jumpSpeed = 335;
}

function update(delta) {
  if (!state.started) return;
  const speed = 230;
  const axisX = input.x + (keyState.has('KeyA') || keyState.has('ArrowLeft') ? -1 : 0) + (keyState.has('KeyD') || keyState.has('ArrowRight') ? 1 : 0);
  const axisY = input.y + (keyState.has('KeyW') || keyState.has('ArrowUp') ? -1 : 0) + (keyState.has('KeyS') || keyState.has('ArrowDown') ? 1 : 0);
  const moveX = Math.max(-1, Math.min(1, axisX));
  const moveY = Math.max(-1, Math.min(1, axisY));
  player.x = Math.max(30, Math.min(WORLD_WIDTH - 45, player.x + moveX * speed * delta));
  player.lane = Math.max(-.55, Math.min(.55, player.lane + moveY * delta * 1.8));
  if (moveX) player.facing = Math.sign(moveX);
  if (player.jump > 0 || player.jumpSpeed > 0) {
    player.jump += player.jumpSpeed * delta;
    player.jumpSpeed -= 850 * delta;
    if (player.jump < 0) { player.jump = 0; player.jumpSpeed = 0; }
  }
  collectCoins();
}

function frame(time) {
  const delta = Math.min((time - previousFrame) / 1000, .04);
  previousFrame = time;
  update(delta);
  draw(time);
  requestAnimationFrame(frame);
}

async function syncPlayers() {
  if (!state.room || !state.started) return;
  const payload = {
    id: state.id,
    room: state.room,
    name: player.name,
    x: player.x,
    y: 225 + player.lane * 100,
    scene: scenes[player.scene].id,
    skin: player.skin,
  };
  try {
    await fetch('/api/players', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const response = await fetch(`/api/players?room=${encodeURIComponent(state.room)}&id=${encodeURIComponent(state.id)}`);
    if (!response.ok) throw new Error('room unavailable');
    state.remotes = await response.json();
    roomLabel.textContent = `${state.room} · ${state.remotes.length + 1} 位同行`;
    document.querySelector('.room-status i').style.background = '#8eb28b';
  } catch {
    roomLabel.textContent = '联机暂不可用';
    document.querySelector('.room-status i').style.background = '#d88868';
  }
}

function startJourney() {
  if (!hasChosenEntrySkin) return;
  player.name = document.querySelector('#playerName').value.trim().slice(0, 14) || '拾雾的人';
  state.room = staticPages ? '' : document.querySelector('#roomCode').value.trim().replace(/[^\w-]/g, '').slice(0, 24);
  state.started = true;
  entryOverlay.hidden = true;
  roomLabel.textContent = state.room ? `${state.room} · 正在寻人` : '单人旅途';
  if (state.room) {
    syncPlayers();
    networkTimer = setInterval(syncPlayers, 900);
  }
  showToast('渡船已经靠岸，向右走去看看吧。');
}

function openModal(id) {
  document.querySelector(`#${id}`).hidden = false;
}

function closeModal(id) {
  document.querySelector(`#${id}`).hidden = true;
}

function setJoystick(event) {
  const bounds = joystick.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const limit = 34;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const length = Math.hypot(dx, dy);
  const scale = length > limit ? limit / length : 1;
  const knobX = dx * scale;
  const knobY = dy * scale;
  joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
  input.x = knobX / limit;
  input.y = knobY / limit;
}

readSave();
if (staticPages) {
  const roomCode = document.querySelector('#roomCode');
  roomCode.disabled = true;
  roomCode.placeholder = 'GitHub Pages 静态版不支持联机';
  roomCode.previousElementSibling.querySelector('small').textContent = '此部署仅支持单人游玩';
}
renderSkinOptions();
renderShop();
resize();
requestAnimationFrame(frame);

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keyState.add(event.code);
  if (event.code === 'KeyE' && !event.repeat) interact();
  if (event.code === 'Space' && !event.repeat) jump();
  if (event.code === 'Escape') ['shopOverlay', 'updateOverlay'].forEach((id) => closeModal(id));
});
window.addEventListener('keyup', (event) => keyState.delete(event.code));
window.addEventListener('blur', () => keyState.clear());

joystick.addEventListener('pointerdown', (event) => {
  touchPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  setJoystick(event);
});
joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId === touchPointer) setJoystick(event);
});
function releaseJoystick(event) {
  if (event.pointerId !== touchPointer) return;
  touchPointer = null;
  input.x = 0;
  input.y = 0;
  joystickKnob.style.transform = 'translate(0, 0)';
}
joystick.addEventListener('pointerup', releaseJoystick);
joystick.addEventListener('pointercancel', releaseJoystick);

document.querySelector('#interactButton').addEventListener('click', interact);
document.querySelector('#jumpButton').addEventListener('pointerdown', jump);
document.querySelector('#startJourney').addEventListener('click', startJourney);
document.querySelector('#openShop').addEventListener('click', () => { renderShop(); openModal('shopOverlay'); });
document.querySelector('#openUpdate').addEventListener('click', () => openModal('updateOverlay'));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.addEventListener('click', (event) => {
  if (event.target === overlay) overlay.hidden = true;
}));