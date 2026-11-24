'use strict';

const LIMIT = 8;
const CART_ARRIVES = 2;
const CART_LEAVES = 5;
const SAVE_KEY = 'haemun-fm-eight-minutes-v1';
const voices = {
  opening: './audio/opening.wav',
  call: './audio/call.wav',
  delivery: './audio/delivery.wav',
};
const rooms = {
  studio: { name: '방송실', floor: '2층', art: './studio.webp', arrival: '진행자 윤서가 콘솔 너머로 고개를 든다. 부두의 불빛이 창에 비친다.' },
  hall: { name: '복도', floor: '1층', arrival: '유리문 위에 작은 현관 종이 매달려 있다.' },
  archive: { name: '자료실', floor: '1층', art: './archive.webp', arrival: '미라가 자료실 마지막 상자의 테이프를 붙이고 있다.' },
  roof: { name: '옥상 송신실', floor: '옥상', art: './roof.webp', arrival: '수신기의 녹색 불빛이 빗소리에 맞춰 미세하게 흔들린다.' },
};

const opening = [
  { speaker: '윤서 · 눈앞에서', text: '“원본 테이프 봤어요? 자정 전에 방송해야 해요.”' },
  { speaker: '윤서의 목소리 · 꺼진 수신기', text: '“거긴 아직 23시 52분이죠? 여기선 마지막 방송이 이미 끝났어요.”', radio: true },
];

const clues = {
  echo: { title: '같은 목소리 두 개', fact: '23:52, 눈앞의 윤서와 꺼진 수신기에서 들려온 목소리가 같았다.', question: '수신기 속 윤서는 어느 밤에 있는 걸까?', clip: 'opening' },
  rundown: { title: '마지막 편성표', fact: '마지막 편성은 주민 인터뷰. 좋은 날에 들려주겠다던 어부와 상인의 이야기가 들어 있다.', question: '원본은 방송실에 어떻게 돌아올까?' },
  bell: { title: '종소리 두 번', fact: '23:54, 현관 종이 두 번 울렸다. 운반 수레가 들어오는 신호다.', question: '수레는 몇 시까지 복도에 머물까?' },
  departure: { title: '수레의 출발 시각', fact: '재호는 23:57에 남은 짐을 차에 싣는다.', question: '그 전에 상자 안을 확인하거나, 누군가에게 맡길 수 있을까?' },
  label: { title: '파란 스티커', fact: '‘빈 상자’ 라벨 아래에 미라가 붙인 파란 스티커가 있다. 주민 인터뷰 원본이 그 안에 들어 있었다.', question: '라벨이 틀렸다는 걸 더 일찍 알려 주면?' },
  routing: { title: '두 곳에서 하는 일', fact: '연결표에는 두 사람이 표시돼 있다. 방송실에서 테이프를 큐에 올리고, 옥상에서 수신 채널을 열어야 한다.', question: '두 곳의 작업을 같은 시간에 맡길 방법은?' },
  relay: { title: '옥상 보조 채널', fact: '23:57에 수신 채널이 또 열린다. 옥상에서 목소리를 보낼 수 있다.', question: '한쪽 송신기에 두 밤의 소리를 실을 수 있을까?', clip: 'call', clipNeeds: 'heardCall' },
};
const callWords = '“여기는 한려 FM. 아직 듣고 있는 사람 있나요?”';

const endings = {
  voices: {
    title: '마을의 목소리',
    story: '“처음 이 동네에 온 날이요? 바다가 집 안에서도 들렸죠.” 주민들의 웃음이 부두까지 번진다. 어선 한 척이 기적으로 화답한다. 그사이 수신기 너머에서 윤서가 마지막으로 누군가 듣고 있느냐고 묻는다.',
    follow: '다음 밤에는 23:57의 호출에 응답해 볼 수 있습니다. 옥상 송신실에서 채널을 확인하세요.',
    clip: 'call',
  },
  signal: {
    title: '건너편의 응답',
    story: '당신은 마이크를 누른다. “여기도 한려 FM이에요. 듣고 있어요.” 긴 잡음 뒤에 윤서가 웃는다. “그럼 이번 밤은 혼자 끝내지 않아도 되겠네요.” 건너편과 작별하는 동안 이쪽의 인터뷰 순서가 조용히 지나간다.',
    follow: '다음 밤에는 인터뷰도 전파에 실을 수 있습니다. 자료실에서 두 장소를 한 번에 연결할 방법을 살펴보세요.',
  },
  both: {
    title: '두 밤의 방송',
    story: '옥상에서 신호를 보내자 윤서가 방송실에서 재호의 테이프를 돌린다. 어부의 목소리 사이로 건너편 윤서가 인사한다. “한려 FM입니다. 우리 쪽에서도 잘 들려요.” 이쪽 윤서는 마이크를 켜고, 같은 인사를 건넨다. 두 시계가 함께 자정을 지난다.',
    follow: '같은 밤을 다시 돌려 다른 선택이 남긴 방송도 들어 볼 수 있습니다.',
  },
};

const newRun = () => ({
  elapsed: 0, room: 'studio', phase: 'play', message: '', speaker: '', event: '', clip: '',
  tape: '', courier: false, dj: false, relay: false, used: [], ending: '', heardCall: false,
});

function loadGame() {
  const fresh = { version: 2, loop: 1, known: ['echo'], unlocked: [], heardCall: false, sound: false, run: newRun() };
  try {
    const old = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!old || !Array.isArray(old.known) || !Array.isArray(old.unlocked)) return fresh;
    fresh.known = [...new Set(['echo', ...old.known.filter((id) => Object.hasOwn(clues, id))])];
    fresh.unlocked = [...new Set(old.unlocked.filter((id) => Object.hasOwn(endings, id)))];
    fresh.loop = Number.isSafeInteger(old.loop) && old.loop > 0 ? old.loop : 1;
    fresh.sound = Boolean(old.sound);
    fresh.heardCall = Boolean(old.heardCall) || fresh.unlocked.length > 0;
    const previous = old.run;
    if (old.version === 2 && previous && Object.hasOwn(rooms, previous.room)
      && Number.isInteger(previous.elapsed) && previous.elapsed >= 0 && previous.elapsed <= LIMIT
      && ['play', 'expired', 'ending'].includes(previous.phase) && Array.isArray(previous.used)
      && (previous.phase !== 'ending' || Object.hasOwn(endings, previous.ending))) {
      fresh.run = { ...newRun(), ...previous };
    }
    if (old.version !== 2 && previous?.elapsed > 0) {
      fresh.run.message = '새로운 방송 회차가 시작됩니다. 이전 단서와 결말 기록을 이어받았습니다.';
    }
  } catch { /* A blocked or unavailable save store still allows this session to play. */ }
  return fresh;
}

const game = loadGame();
const $ = (id) => document.getElementById(id);
const knows = (id) => game.known.includes(id);
const learn = (id) => { if (!knows(id)) game.known.push(id); };
const time = (elapsed) => elapsed === LIMIT ? '00:00' : '23:' + (52 + elapsed);
const cartHere = (elapsed) => elapsed >= CART_ARRIVES && elapsed < CART_LEAVES;

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* In-memory play still works. */ }
}

let soundContext;
let speaking;
let playback = 0;
const recordings = new Map();

function audioContext() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  soundContext ||= new Audio();
  if (soundContext.state === 'suspended') soundContext.resume().catch(() => {});
  return soundContext;
}

function stopClip() {
  playback += 1;
  if (speaking) speaking.stop();
  speaking = null;
}

async function playClip(id) {
  try {
    const context = audioContext();
    if (!context || !voices[id]) return;
    stopClip();
    const thisPlayback = playback;
    if (!recordings.has(id)) {
      recordings.set(id, fetch(voices[id]).then((response) => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).then((bytes) => context.decodeAudioData(bytes)).catch((error) => {
        recordings.delete(id);
        throw error;
      }));
    }
    const buffer = await recordings.get(id);
    if (thisPlayback !== playback) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    speaking = source;
    source.onended = () => { if (speaking === source) speaking = null; };
  } catch { /* Every recording has a text equivalent. */ }
}

function playEffect(id) {
  if (!game.sound) return;
  try {
    const context = audioContext();
    if (!context) return;
    const notes = id === 'bell' ? [860, 710] : id === 'rewind' ? [418, 330, 248] : [250, 315, 392];
    notes.forEach((frequency, index) => {
      const note = context.createOscillator();
      const level = context.createGain();
      const at = context.currentTime + .025 + index * .18;
      note.type = id === 'bell' ? 'triangle' : 'sine';
      note.frequency.value = frequency;
      level.gain.setValueAtTime(.001, at);
      level.gain.exponentialRampToValueAtTime(.08, at + .019);
      level.gain.exponentialRampToValueAtTime(.001, at + .3);
      note.connect(level);
      level.connect(context.destination);
      note.start(at);
      note.stop(at + .31);
    });
  } catch { /* Audio never controls access to clues. */ }
}

function onMinute() {
  const r = game.run;
  if (r.elapsed === CART_ARRIVES) {
    learn('bell');
    r.event = '23:54 · 딩, 딩. 현관 종이 두 번 울리고 재호의 수레가 들어온다.';
    return 'bell';
  }
  if (r.elapsed === 3) {
    r.event = '23:55 · 방송실의 붉은 불이 켜진다. 윤서가 오프닝을 시작한다.';
  }
  if (r.elapsed === CART_LEAVES) {
    learn('departure');
    game.heardCall = true;
    r.heardCall = true;
    if (r.courier) {
      r.tape = 'delivered';
      r.event = '23:57 · 무전 속 재호 “윤서 씨한테 원본 전달했어요. 이제 옥상만 남았죠?”\n옥상 수신기도 동시에 깨어난다.';
      r.clip = 'delivery';
    } else {
      r.event = '23:57 · 재호의 수레가 나간다. 건너편 윤서의 호출이 들린다.\n' + callWords;
      r.clip = 'call';
    }
  }
  if (r.elapsed === LIMIT) {
    r.phase = 'expired';
    r.event = '00:00 · 송출 종료. 붉은 불이 꺼지고 모든 주파수가 조용해진다.';
  }
  return '';
}

function step(message, speaker = '') {
  const r = game.run;
  r.message = message;
  r.speaker = speaker;
  r.event = '';
  r.clip = '';
  r.elapsed += 1;
  return onMinute();
}

function enter(id) {
  const r = game.run;
  if (r.phase !== 'play' || r.room === id) return;
  r.room = id;
  const cue = step(rooms[id].arrival);
  if (id === 'hall' && r.elapsed >= CART_LEAVES && !r.tape) learn('departure');
  update(cue);
}

function finish(id) {
  if (!game.unlocked.includes(id)) game.unlocked.push(id);
  const ending = endings[id];
  Object.assign(game.run, {
    ending: id, elapsed: LIMIT, phase: 'ending', message: ending.story, speaker: '', event: '', clip: ending.clip ?? '',
  });
  if (ending.clip) game.heardCall = true;
  update(ending.clip ? '' : 'ending');
}

function rewind() {
  if (!game.run.elapsed) return;
  stopClip();
  game.loop += 1;
  game.run = newRun();
  update('rewind');
}

function update(cue = '') {
  save();
  render();
  if (cue) playEffect(cue);
  if (game.sound && game.run.clip) playClip(game.run.clip);
  $('narration').focus({ preventScroll: true });
  const top = $('narration').getBoundingClientRect().top;
  const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
  if (top < Math.max(0, hudBottom) || top > window.innerHeight - 120) {
    $('narration').scrollIntoView({ block: 'nearest' });
  }
}

function choices() {
  const r = game.run;
  const actions = [];
  const offer = (id, title, detail, run, primary = false, cost = '1행동') => {
    if (!r.used.includes(id)) actions.push({ id, title, detail, run, primary, cost });
  };
  const scene = (id, title, detail, clue, message, speaker = '', primary = false, change) => {
    offer(id, title, detail, () => {
      if (clue) learn(clue);
      if (change) change();
      if (id !== 'wait') r.used.push(id);
      update(step(message, speaker));
    }, primary);
  };
  const finalChoice = (id, title, detail, primary) =>
    offer(id, title, detail, () => finish(id), primary, '남은 시간');
  const canJoin = r.dj && r.tape === 'delivered' && r.relay && r.elapsed >= CART_LEAVES;

  if (r.room === 'studio') {
    if (r.elapsed <= 1) {
      offer('go-hall', '복도로 가서 수레 확인', '운반 상자에 원본이 섞였을지도 모릅니다.', () => enter('hall'), true);
    }
    scene('ask-dj', '윤서에게 목소리 확인', '눈앞의 윤서도 방금 그 소리를 들었을까요?', 'rundown',
      '“저도 들었어요. 그런데 저한텐 아직 마지막 순서가 남아 있어요. 미라 씨의 원본이 돌아오면 바로 틀게요.”', '윤서');
    if (knows('routing')) {
      scene('assign-dj', '윤서에게 방송실 맡기기', '테이프가 도착하면 보내 줄 사람이 필요합니다.', null,
        '“좋아요. 원본이 들어오면 제가 준비해 둘게요. 당신이 옥상에서 신호를 주면 돼요.”', '윤서', r.elapsed === 0 && game.loop > 1,
        () => { r.dj = true; });
    }
    if (r.tape) {
      finalChoice('voices', '주민 인터뷰 방송하기', '테이프를 틀고 마을의 목소리로 방송을 닫습니다.', !canJoin);
    }
    if (canJoin) {
      finalChoice('both', '두 방송을 잇기', '열어 둔 옥상 채널에 주민 인터뷰를 함께 보냅니다.', true);
    }
  }

  if (r.room === 'hall') {
    if (cartHere(r.elapsed) && !r.tape && !r.courier) {
      scene('search-cart', '수레의 상자 확인', '‘빈 상자’ 라벨 밑으로 파란 스티커가 보입니다.', 'label',
        '라벨을 들추자 파란 스티커가 붙은 테이프가 나온다. 손글씨로 ‘주민 인터뷰 원본’이라고 적혀 있다.', '', !knows('label'),
        () => { r.tape = 'carried'; });
    }
    if (knows('label') && r.elapsed < CART_LEAVES) {
      scene('assign-courier', '재호에게 원본 운반 부탁', '파란 스티커를 알려 주고 23:57에 윤서에게 전달하게 합니다.', null,
        '“빈 상자라고 붙은 데에 파란 스티커요? 찾아서 윤서 씨한테 직접 드릴게요.”', '재호', true,
        () => { r.courier = true; r.tape = ''; });
    }
    scene('read-sheet', '운반표 확인', '현관 옆 종이에 수레가 떠날 시각이 적혀 있습니다.', 'departure',
      '운반표의 마지막 줄에 23:57이라고 적혀 있다. 이 시간 이후 남은 상자는 밖으로 나간다.');
    if (r.elapsed < CART_ARRIVES) {
      scene('wait', '현관 종을 기다리기', '복도에 머무르며 한 분을 보냅니다.', null,
        '빗방울이 유리문을 두드린다. 문 옆에서 바퀴 구르는 소리가 가까워진다.', '', true);
    }
  }

  if (r.room === 'archive') {
    scene('ask-mira', '미라에게 원본의 표식 묻기', '포장을 맡았던 사람에게 상자를 구분할 방법을 묻습니다.', 'rundown',
      '“테이프 상자엔 파란 스티커를 붙였어요. 겉에 뭐라고 적혔든 스티커를 봐요. 바깥으로 가져갈 짐은 전부 복도에 모였고요.”', '미라');
    scene('read-routing', '두 채널 연결표 펼치기', '방송실과 옥상에서 어떤 일을 할 수 있는지 확인합니다.', 'routing',
      '연결표 위에 두 사람이 그려져 있다. 한 명은 방송실의 재생기, 한 명은 옥상의 송신기에 손을 올리고 있다.', '', true);
  }

  if (r.room === 'roof') {
    scene('inspect-relay', '보조 송신기 살피기', '건너편 목소리에 답할 수 있는지 확인합니다.', 'relay',
      '수신기 옆에 ‘23:57 보조 채널 교신’이라고 적혀 있다. 여기서 회선을 열면 건너편에도 목소리가 닿는다.', '', !knows('relay'));
    if (knows('relay')) {
      scene('enable-relay', '보조 채널 열기', '방송이 끝났다는 수신기 속 윤서에게 신호를 보낼 준비를 합니다.', null,
        '송신기의 바늘이 움직인다. 마이크를 켜면 내 목소리도 같은 주파수로 넘어갈 것이다.', '', true,
        () => { r.relay = true; });
    }
    if (r.relay && r.elapsed >= CART_LEAVES) {
      finalChoice('signal', '건너편 윤서에게 응답', '옥상에서 그 목소리에 남은 방송 시간을 씁니다.', !canJoin);
    }
    if (canJoin) {
      finalChoice('both', '두 방송을 잇기', '방송실의 윤서에게 신호를 보내 주민 인터뷰와 응답을 함께 송출합니다.', true);
    }
  }

  if (r.elapsed === 0 && r.room === 'studio') return actions;
  scene('wait', '1분 기다리기', '이곳에서 다음 사건을 기다립니다.', null, '시계의 분침이 한 칸 움직인다.');
  return actions;
}

function context() {
  const r = game.run;
  if (r.room === 'hall') {
    if (r.elapsed < CART_ARRIVES) return ['수레 도착 전', '문 밖은 텅 비어 있다. 바퀴 소리가 들려올 때까지 확인할 상자는 없다.'];
    if (cartHere(r.elapsed)) return ['수레가 들어왔다', '재호가 가져온 상자 세 개가 현관 오른쪽에 놓여 있다.'];
    return ['수레 출발', '바퀴 자국만 남아 있다. 남은 상자는 이미 차에 실렸다.'];
  }
  if (r.room === 'studio') {
    return r.elapsed < 3
      ? ['방송 준비 중', r.elapsed === 0 ? '방송국의 마지막 야간 근무. 자정이 되면 주파수가 닫힌다.' : rooms.studio.arrival]
      : ['생방송 중', r.tape === 'delivered' ? '윤서의 콘솔 옆에 재호가 전해 준 원본이 놓여 있다.' : '마이크 위에 붉은 불이 켜져 있다. 직원들은 마지막 순서를 기다린다.'];
  }
  if (r.room === 'roof') {
    if (r.elapsed >= CART_LEAVES) return ['건너편 호출 중', '헤드폰 너머로 누군가 같은 주파수를 부르고 있다.'];
    return [r.relay ? '보조 채널 열림' : '수신 대기', rooms.roof.arrival];
  }
  return ['폐국 정리 중', rooms.archive.arrival];
}

function objective() {
  const r = game.run;
  if (r.phase === 'expired') return '23:52로 돌아가 다음 시도를 시작한다';
  if (r.phase === 'ending') return '오늘 밤의 방송이 끝났다';
  if (r.dj && r.courier) return r.relay && r.tape === 'delivered'
    ? '두 방송을 함께 송출한다' : '옥상에서 보조 채널을 열고 두 방송을 잇는다';
  if (r.tape && r.room !== 'roof') return '방송실에서 주민 인터뷰를 송출한다';
  if (r.relay && r.elapsed >= CART_LEAVES) return '건너편 호출에 응답한다';
  if (r.room === 'hall' && r.elapsed >= CART_LEAVES && !r.tape) return '다음 회차에 수레를 붙잡을 방법을 찾는다';
  return '자정 전에 주민 인터뷰 원본을 방송한다';
}

function nextPlan() {
  const r = game.run;
  if (r.phase === 'ending') return endings[r.ending].follow;
  if (r.phase === 'expired') {
    if (r.courier && r.dj) return '재호와 윤서에게 먼저 부탁한 뒤, 23:57 전에 옥상 송신실에 도착해 두 사람의 준비를 이어 보세요.';
    if (r.tape) return '다음엔 원본을 챙기는 즉시 방송실로 돌아가 보세요.';
    return '다음엔 23:57 전에 복도에 도착하면 상자를 살필 수 있습니다.';
  }
  if (r.elapsed === 0 && game.loop > 1) {
    if (knows('label') && knows('routing') && knows('relay')) return '이번에는 두 곳에서 같은 시간에 할 일을 누구에게 맡길지 정할 수 있습니다.';
    if (game.unlocked.includes('voices') && !knows('relay')) return '이번엔 옥상 송신실에서 23:57의 호출에 응답할 방법을 찾아보세요.';
    if (knows('label')) return '재호에게 파란 스티커를 미리 알려 주면, 당신이 다른 곳에 가도 원본이 움직입니다.';
    if (knows('departure')) return '23:57 전에 복도에 도착해 수레 안을 확인하세요.';
  }
  return '';
}

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function listenButton(clip, title) {
  const button = element('button', title, 'utility listen');
  button.type = 'button';
  button.addEventListener('click', () => playClip(clip));
  return button;
}

function spoken({ speaker, text, radio = false }) {
  const line = element('div', '', radio ? 'dialogue radio' : 'dialogue');
  if (speaker) line.append(element('strong', speaker));
  line.append(element('p', text));
  return line;
}

function renderScene() {
  const r = game.run;
  const room = rooms[r.room];
  const [state, setting] = context();
  const intro = r.phase === 'play' && r.elapsed === 0;
  const art = room.art || (cartHere(r.elapsed) ? './hall.webp' : './hall-empty.webp');
  const image = $('scene-image');
  if (image.getAttribute('src') !== art) image.setAttribute('src', art);
  const scene = image.closest('.scene');
  scene.dataset.room = r.room;
  scene.dataset.phase = r.phase;
  scene.dataset.intro = String(intro);
  $('room-floor').textContent = r.phase === 'play' ? room.floor : '한려 FM';
  $('room-name').textContent = r.phase === 'play' ? room.name
    : r.phase === 'ending' ? endings[r.ending].title : '시간이 다 됐다';
  $('room-state').textContent = r.phase === 'play' ? state : '송출 종료';
  $('context').hidden = r.phase !== 'play';
  $('context').textContent = setting;

  const story = [];
  if (intro) {
    if (r.message) story.push(spoken({ text: r.message }));
    story.push(...opening.map(spoken));
  } else if (r.message && (r.message !== setting || r.phase !== 'play')) {
    story.push(spoken({ speaker: r.speaker, text: r.message }));
  }
  $('story').replaceChildren(...story);
  $('event').hidden = !r.event;
  $('event').textContent = r.event;
  const clip = intro ? 'opening' : r.clip;
  const replayLabels = { opening: '첫 교신 듣기', delivery: '재호의 무전 듣기', call: '건너편 호출 듣기' };
  $('replay').replaceChildren(...(clip ? [listenButton(clip, replayLabels[clip])] : []));
  const plan = nextPlan();
  $('plan').hidden = !plan;
  $('plan').textContent = plan;
}

function renderTimeline() {
  const r = game.run;
  const entries = [
    [0, '마지막 방송 준비'],
    [CART_ARRIVES, knows('bell') ? '현관 종 두 번 · 수레 도착' : '현관에서 어떤 소리가 날까?'],
    [3, '한려 FM 생방송 시작'],
    [CART_LEAVES, r.tape === 'delivered' ? '재호가 방송실에 원본 전달' : knows('departure') ? '수레 출발 · 옥상 호출' : '다음 사건'],
    [LIMIT, '마지막 송출 종료'],
  ];
  $('timeline').replaceChildren(...entries.map(([minute, label]) => {
    const entry = element('li', '', minute <= r.elapsed ? 'seen' : '');
    if (minute === r.elapsed) entry.setAttribute('aria-current', 'time');
    entry.append(element('time', time(minute)), element('span', label));
    return entry;
  }));
}

function render() {
  const r = game.run;
  const left = LIMIT - r.elapsed;
  $('objective').textContent = objective();
  $('clock').textContent = time(r.elapsed);
  $('budget').textContent = '남은 행동 ' + left + '회';
  document.querySelector('.hud').dataset.urgent = String(left <= 2 && r.phase === 'play');
  $('beats').replaceChildren(...Array.from({ length: LIMIT }, (_, index) => element('span', '', index < left ? 'on' : '')));
  $('cycle').textContent = game.loop + '회차';
  $('journal-count').textContent = game.known.length;
  $('sound').textContent = game.sound ? '소리 끄기' : '소리 켜기';
  $('sound').setAttribute('aria-pressed', String(game.sound));
  $('rewind').hidden = r.phase !== 'play' || r.elapsed === 0;
  renderScene();
  renderTimeline();

  const options = r.phase === 'play' ? choices() : [{
    title: '23:52로 되감기', detail: '발견한 단서와 결말을 가지고 돌아갑니다.', primary: true, cost: '', run: rewind,
  }];
  $('actions').replaceChildren(...options.map(({ title, detail, primary, cost, run }) => {
    const button = element('button', '', primary ? 'action primary' : 'action');
    const heading = element('span', '', 'action-head');
    heading.append(element('strong', title));
    if (cost) heading.append(element('span', cost, 'cost'));
    button.append(heading, element('span', detail, 'action-detail'));
    button.type = 'button';
    button.addEventListener('click', run);
    return button;
  }));

  $('locations').hidden = r.phase !== 'play' || (game.loop === 1 && r.elapsed === 0);
  $('places').replaceChildren(...Object.entries(rooms).map(([id, room]) => {
    const button = element('button', '', 'place');
    button.append(element('span', room.name), element('small', r.room === id ? '현재 위치' : room.floor));
    button.type = 'button';
    button.disabled = r.room === id;
    if (r.room === id) button.setAttribute('aria-current', 'location');
    button.addEventListener('click', () => enter(id));
    return button;
  }));

  $('ending-count').textContent = game.unlocked.length + ' / ' + Object.keys(endings).length;
  $('ending-list').replaceChildren(...Object.entries(endings).map(([id, ending], index) => {
    const item = element('li');
    if (!game.unlocked.includes(id)) {
      item.append(element('span', '미발견 결말 ' + (index + 1)));
    } else {
      const button = element('button', ending.title, 'ending-link');
      button.type = 'button';
      button.addEventListener('click', () => {
        $('record-title').textContent = ending.title;
        $('record-story').textContent = ending.story;
        $('record').showModal();
      });
      item.append(button);
    }
    return item;
  }));
}

function openJournal() {
  $('clues').replaceChildren(...game.known.map((id) => {
    const { title, fact, question, clip, clipNeeds } = clues[id];
    const item = element('li');
    item.append(element('h3', title), element('p', fact), element('p', question, 'question'));
    if (clip && (!clipNeeds || game[clipNeeds])) {
      if (clip === 'call') item.append(element('p', callWords));
      item.append(listenButton(clip, clip === 'opening' ? '첫 교신 다시 듣기' : '호출 다시 듣기'));
    }
    return item;
  }));
  $('journal').showModal();
}

$('journal-open').addEventListener('click', openJournal);
$('journal-close').addEventListener('click', () => $('journal').close());
$('record-close').addEventListener('click', () => $('record').close());
$('rewind').addEventListener('click', rewind);
$('sound').addEventListener('click', () => {
  game.sound = !game.sound;
  save();
  $('sound').textContent = game.sound ? '소리 끄기' : '소리 켜기';
  $('sound').setAttribute('aria-pressed', String(game.sound));
  if (!game.sound) stopClip();
  else if (game.run.elapsed === 0) playClip('opening');
  else if (game.run.clip) playClip(game.run.clip);
});

save();
render();
