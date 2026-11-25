'use strict';

const LIMIT = 8;
const CART_ARRIVES = 2;
const CART_LEAVES = 5;
const REPLY_WINDOW = 5;
const SAVE_KEY = 'haemun-fm-eight-minutes-v1';
const hypotheses = {
  equal: { label: '두 시계가 같다', local: 6 },
  slower: { label: '건너편이 1분 느리다', local: 7 },
  faster: { label: '건너편이 1분 빠르다', local: 5 },
};
const evidence = {
  localBell: { clue: 'bell', side: 'local', event: 'bell', time: '23:54', label: '복도 현관 종', detail: '높은 종 · 낮은 종' },
  localOpening: { clue: 'onAir', side: 'local', event: 'onAir', time: '23:55', label: '방송실 오프닝', detail: '“비 오는 항구의 밤입니다.”' },
  remoteOpening: { clue: 'airlog', side: 'remote', event: 'onAir', time: '23:56', label: '건너편 방송 일지', detail: '“비 오는 항구의 밤입니다.”' },
  remoteBell: { clue: 'relay', side: 'remote', event: 'bell', time: '23:55', label: '건너편 수신 녹음', detail: '높은 종 · 낮은 종' },
};
const voices = {
  opening: './audio/opening.wav',
  call: './audio/call.wav',
  delivery: './audio/delivery.wav',
  distantBell: './audio/distant-bell.wav',
  onAir: './audio/harbor-opening.wav',
  voices: './audio/sunim.wav',
  signal: './audio/ending-signal.wav',
  both: './audio/two-nights.wav',
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
  bell: { title: '복도의 종소리', fact: '이쪽 시계 23:54. 높은 종소리 뒤에 낮은 종소리가 울렸다. 수레가 현관에 들어왔다.', question: '건너편 녹음에도 같은 소리가 있을까?' },
  departure: { title: '수레의 출발 시각', fact: '재호는 23:57에 남은 짐을 차에 싣는다.', question: '그 전에 상자 안을 확인하거나, 누군가에게 맡길 수 있을까?' },
  label: { title: '파란 스티커', fact: '‘빈 상자’ 라벨 아래에 미라가 붙인 파란 스티커가 있다. 주민 인터뷰 원본이 그 안에 들어 있었다.', question: '라벨이 틀렸다는 걸 더 일찍 알려 주면?' },
  routing: { title: '두 곳에서 하는 일', fact: '연결표에는 두 사람이 표시돼 있다. 방송실에서 테이프를 큐에 올리고, 옥상에서 수신 채널을 열어야 한다.', question: '두 곳의 작업을 같은 시간에 맡길 방법은?' },
  relay: { title: '건너편 수신 기록', fact: '건너편 시계 23:55. 높은 종소리 뒤에 낮은 종소리가 들어 있다. 다음 교신은 건너편 시계 23:58에 열린다.', question: '이쪽 시계로는 몇 시에 보조 채널을 열어야 할까?', clip: 'distantBell' },
  onAir: { title: '윤서의 오프닝', fact: '이쪽 시계 23:55. 윤서가 “비 오는 항구의 밤입니다”라고 방송을 시작했다.', question: '건너편 방송 일지에는 이 멘트가 언제 찍혔을까?', clip: 'onAir' },
  airlog: { title: '건너편 방송 일지', fact: '자료실의 자동 수신 일지에 “비 오는 항구의 밤입니다”가 건너편 시계 23:56으로 기록돼 있다.', question: '종소리에서 찾은 시차와도 일치할까?', clip: 'onAir' },
  sunim: { title: '순임이 남긴 부탁', fact: '테이프에 순임의 메모가 붙어 있다. 아버지는 큰비가 온 밤마다 라디오로 귀항 소식을 확인하며 부두에서 기다렸다.', question: '순임은 마지막 방송을 누가 듣길 바랐을까?' },
};
const callWords = '“여기는 한려 FM. 아직 듣고 있는 사람 있나요?”';

const endings = {
  voices: {
    title: '마을의 목소리',
    story: '순임은 아버지가 비 오는 부두에서 라디오에 귀를 기울이던 밤을 이야기한다. 이제 그 목소리가 같은 부두에 닿는다. 배 한 척이 짧게 기적을 울린다. 건너편 윤서의 호출은 끝내 응답을 얻지 못한다.',
    follow: '다음 밤에는 옥상 수신 기록을 찾아보세요. 건너편 윤서는 몇 시에 다시 부를까요?',
    clip: 'voices',
    transcript: '“아버지는 큰비가 오면 부두에 나와 이 방송을 들었어요. 아버지, 저 돌아왔어요.”',
  },
  signal: {
    title: '건너편의 응답',
    story: '당신은 마이크를 누른다. “여기도 한려 FM이에요. 듣고 있어요.” 긴 잡음 뒤에 윤서가 웃는다. “그럼 이번 밤은 혼자 끝내지 않아도 되겠네요.” 건너편과 작별하는 동안 이쪽의 인터뷰 순서가 조용히 지나간다.',
    follow: '다음 밤에는 인터뷰도 전파에 실을 수 있습니다. 자료실에서 두 장소를 한 번에 연결할 방법을 살펴보세요.',
    clip: 'signal',
    transcript: '“듣고 있어요. 여기도 한려 FM이에요.”\n“그럼 이번 밤은 혼자 끝내지 않아도 되겠네요.”',
  },
  both: {
    title: '두 밤의 방송',
    story: '옥상의 교신과 방송실의 테이프가 같은 순간에 열린다. 순임의 목소리가 두 밤의 항구에 번지고, 건너편 윤서가 답한다. 마침내 두 방송실에서 같은 이야기를 듣는다.',
    follow: '같은 밤을 다시 돌려 다른 선택이 남긴 방송도 들어 볼 수 있습니다.',
    clip: 'both',
    transcript: '“아버지, 저 돌아왔어요.”\n“한려 FM입니다. 우리 쪽 항구에도 그 목소리가 닿았어요.”',
  },
};

const newRun = () => ({
  elapsed: 0, room: 'studio', phase: 'play', message: '', speaker: '', event: '', clip: '',
  tape: '', courier: false, dj: false, tuneAt: 0, linked: false, used: [], ending: '',
  review: false, console: '', consoleReady: false, syncMissed: false, log: [],
});

function loadGame() {
  const requested = new URLSearchParams(location.search).get('lang');
  const fresh = { version: 4, loop: 1, known: ['echo'], unlocked: [], sound: false,
    language: requested === 'en' ? 'en' : 'ko', hypothesis: '', matches: [], run: newRun() };
  try {
    const old = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!old || !Array.isArray(old.known) || !Array.isArray(old.unlocked)) return fresh;
    fresh.known = [...new Set(['echo', ...old.known.filter((id) => Object.hasOwn(clues, id))])];
    fresh.unlocked = [...new Set(old.unlocked.filter((id) => Object.hasOwn(endings, id)))];
    fresh.loop = Number.isSafeInteger(old.loop) && old.loop > 0 ? old.loop : 1;
    fresh.sound = Boolean(old.sound);
    if (!requested && old.language === 'en') fresh.language = 'en';
    if (Object.hasOwn(hypotheses, old.hypothesis)) fresh.hypothesis = old.hypothesis;
    if (Array.isArray(old.matches)) fresh.matches = [...new Set(old.matches.filter((id) => ['bell', 'onAir'].includes(id)))];
    const previous = old.run;
    if (old.version >= 2 && previous && Object.hasOwn(rooms, previous.room)
      && Number.isInteger(previous.elapsed) && previous.elapsed >= 0 && previous.elapsed <= LIMIT
      && ['play', 'expired', 'ending'].includes(previous.phase) && Array.isArray(previous.used)
      && (previous.phase !== 'ending' || Object.hasOwn(endings, previous.ending))) {
      fresh.run = { ...newRun(), ...previous };
      if (!Array.isArray(fresh.run.log)) fresh.run.log = [];
      if (old.version === 2 && previous.phase === 'play') {
        fresh.run.message = '진행 중인 밤을 이어받았습니다. 옥상 교신은 수첩의 두 시계에서 예약할 수 있습니다.';
        fresh.run.speaker = '';
        fresh.run.event = '';
        fresh.run.clip = '';
      }
      if (previous.phase === 'ending') {
        fresh.run.clip = endings[previous.ending].clip;
        fresh.run.message = endings[previous.ending].story;
      }
    }
    if (!old.version && previous?.elapsed > 0) {
      fresh.run.message = '새로운 방송 회차가 시작됩니다. 이전 단서와 결말 기록을 이어받았습니다.';
    }
  } catch { /* A blocked or unavailable save store still allows this session to play. */ }
  return fresh;
}

const game = loadGame();
const $ = (id) => document.getElementById(id);
const t = (value) => game.language === 'en'
  ? value.split('\n').map((line) => GAME_EN[line] ?? line).join('\n') : value;
const fmt = (value, ...args) => t(value).replace(/\{(\d+)\}/g, (_, index) => args[index]);
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
  let cue = '';
  const events = [];
  if (r.elapsed === CART_ARRIVES) {
    learn('bell');
    events.push('높은 종, 낮은 종. 23:54에 재호의 수레가 들어온다.');
    cue = 'bell';
  }
  if (r.elapsed === 3) {
    learn('onAir');
    events.push('방송실의 붉은 불이 켜진다. 윤서 “비 오는 항구의 밤입니다.”');
    r.clip = 'onAir';
  }
  if (r.elapsed === CART_LEAVES) {
    learn('departure');
    if (r.courier) {
      r.tape = 'delivered';
      events.push('재호의 무전 “윤서 씨한테 원본 전달했어요. 이제 옥상만 남았죠?”');
      r.clip = 'delivery';
    } else {
      events.push('재호가 남은 상자를 차에 싣는다. 복도가 비었다.');
    }
  }
  if (r.tuneAt === r.elapsed) {
    r.linked = r.elapsed === REPLY_WINDOW;
    events.push(r.linked ? '예약한 시각에 건너편 채널이 열렸다.' : '예약 시각에 잡음만 들린다. 건너편 교신은 이미 지나갔다.');
    if (r.linked) {
      events.push(callWords);
      r.clip ||= 'call';
    }
  }
  if (r.elapsed === REPLY_WINDOW + 1 && r.linked && r.dj && r.tape === 'delivered' && !r.consoleReady) {
    r.syncMissed = true;
    events.push('동시 송출 신호를 보낼 순간이 지났다. 열린 교신에 답할 시간은 남아 있다.');
  }
  if (r.elapsed === LIMIT) {
    r.phase = 'expired';
    events.push('송출 종료. 붉은 불이 꺼지고 모든 주파수가 조용해진다.');
  }
  r.event = events.join('\n');
  events.forEach(observe);
  return cue;
}

function observe(text) {
  game.run.log.push({ minute: game.run.elapsed, text });
}

function step(message, speaker = '', observeAction = false) {
  const r = game.run;
  r.message = message;
  r.speaker = speaker;
  r.event = '';
  r.clip = '';
  r.elapsed += 1;
  if (observeAction) observe(message);
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
  observe(ending.transcript);
  update();
}

function reviewNight() {
  if (!game.run.elapsed) return;
  if (game.run.phase === 'play' && !game.run.console && !game.run.review) {
    game.run.review = true;
    update();
  }
  $('recap').scrollIntoView({ block: 'start' });
  $('recap').focus({ preventScroll: true });
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
  if (game.run.phase !== 'play' || game.run.elapsed === 0) {
    document.querySelector('main').scrollTop = 0;
    window.scrollTo(0, 0);
    return;
  }
  const top = $('narration').getBoundingClientRect().top;
  const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
  if (top < Math.max(0, hudBottom) || top > window.innerHeight - 120) {
    $('narration').scrollIntoView({ block: 'nearest' });
  }
}

function openConsole(mode) {
  game.run.console = mode;
  game.run.consoleReady = false;
  update();
  focusConsoleControl();
}

function focusConsoleControl() {
  const button = $('actions').querySelector('button');
  button.scrollIntoView({ block: 'nearest' });
  button.focus({ preventScroll: true });
}

function consoleActions() {
  const r = game.run;
  const actions = [];
  if (r.console === 'both' && !r.consoleReady) {
    actions.push({ title: '동시 송출 신호 보내기', detail: '원본 전달과 교신이 겹친 지금, 윤서에게 재생 큐를 보냅니다.', cost: '1행동', primary: true, run: () => {
      r.consoleReady = true;
      update(step('두 레벨 미터가 동시에 움직인다. 윤서가 원본 위에 손을 얹고 송출 신호를 기다린다.', '', true));
      focusConsoleControl();
    } });
  } else {
    const control = {
      voices: ['테이프 재생하기', '재생기를 돌려 주민 인터뷰를 송출합니다.', '재생 버튼이 내려간다. 테이프가 돌아가고 첫 목소리가 전파를 탄다.'],
      signal: ['마이크 열기', '건너편 윤서에게 당신의 목소리를 보냅니다.', '마이크에 붉은 불이 켜진다. 건너편의 잡음이 잦아든다.'],
      both: ['마이크 열고 함께 송출', '연결된 두 채널로 목소리와 인터뷰를 보냅니다.', '옥상의 마이크가 켜지고 방송실의 테이프가 동시에 돌아간다.'],
    }[r.console];
    actions.push({ title: control[0], detail: control[1], cost: '1행동', primary: true, run: () => {
      step(control[2], '', true);
      finish(r.console);
    } });
  }
  if (!r.consoleReady) {
    actions.push({ title: '돌아가기', detail: '송출 선택을 다시 고릅니다.', cost: '시간 유지', run: () => {
      r.console = '';
      update();
    } });
  }
  return actions;
}

function choices() {
  const r = game.run;
  if (r.console) return consoleActions();
  const actions = [];
  const offer = (id, title, detail, run, primary = false, cost = '1행동') => {
    if (!r.used.includes(id)) actions.push({ id, title, detail, run, primary, cost });
  };
  const scene = (id, title, detail, clue, message, speaker = '', primary = false, change) => {
    offer(id, title, detail, () => {
      if (clue) learn(clue);
      if (change) change();
      if (id !== 'wait') r.used.push(id);
      update(step(message, speaker, Boolean(clue || speaker || id === 'enable-relay')));
    }, primary);
  };
  const finalChoice = (id, title, detail, primary) =>
    offer(id, title, detail, () => openConsole(id), primary, '콘솔 열기');
  const canJoin = r.dj && r.tape === 'delivered' && r.linked && r.elapsed === REPLY_WINDOW;

  if (r.room === 'studio') {
    if (r.elapsed <= 1) {
      offer('go-hall', '복도로 가서 수레 확인', '운반 상자에 원본이 섞였을지도 모릅니다.', () => enter('hall'), true);
    }
    scene('ask-dj', '윤서에게 목소리 확인', '눈앞의 윤서도 방금 그 소리를 들었을까요?', 'rundown',
      '“저도 들었어요. 여기선 아직 순임 씨의 인터뷰 순서가 남았어요. 아버지가 기다리던 부두에 자기 목소리를 전하고 싶대요.”', '윤서');
    if (knows('routing')) {
      scene('assign-dj', '윤서에게 방송실 맡기기', '테이프가 도착하면 보내 줄 사람이 필요합니다.', null,
        '“좋아요. 원본이 들어오면 제가 준비해 둘게요. 당신이 옥상에서 신호를 주면 돼요.”', '윤서', r.elapsed === 0 && game.loop > 1,
        () => { r.dj = true; });
    }
    if (r.tape) {
      finalChoice('voices', '주민 인터뷰 방송하기', '테이프를 틀고 마을의 목소리로 방송을 닫습니다.', !canJoin);
    }
    if (canJoin) {
      finalChoice('both', '두 방송을 잇기', '옥상 채널과 주민 인터뷰를 함께 보냅니다. 2행동이 필요합니다.', true);
    }
  }

  if (r.room === 'hall') {
    if (cartHere(r.elapsed) && !r.tape && !r.courier) {
      scene('search-cart', '수레의 상자 확인', '‘빈 상자’ 라벨 밑으로 파란 스티커가 보입니다.', 'label',
        '파란 스티커 아래 주민 인터뷰 원본이 있다. 순임의 메모가 붙어 있다. “아버지가 기다리던 부두에 제 목소리를 들려주세요.”', '', !knows('label'),
        () => { r.tape = 'carried'; learn('sunim'); });
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
    scene('read-airlog', '건너편 방송 일지 읽기', '빗속 항구의 방송 시작 멘트가 다른 시계에 기록돼 있습니다.', 'airlog',
      '건너편 방송 일지 23:56. 윤서의 첫 멘트가 적혀 있다. “비 오는 항구의 밤입니다.”');
  }

  if (r.room === 'roof') {
    scene('inspect-relay', '건너편 수신 기록 조사', '같은 주파수에서 잡힌 녹음과 시각을 확인합니다.', 'relay',
      '녹음에는 높은 종소리 뒤 낮은 종소리가 이어진다. 건너편 시각은 23:55. 녹음 끝에 다음 교신 시각이 남아 있다. 건너편 23:58.', '', !knows('relay'));
    if (knows('relay') && !r.tuneAt) {
      const hypothesis = game.matches.length ? hypotheses[game.hypothesis] : null;
      if (!hypothesis) {
        offer('compare', '수첩에서 증거 연결하기', '두 시계에서 같은 사건을 찾고 시차 가설을 세웁니다.', openJournal, true, '시간 유지');
      } else if (r.elapsed < hypothesis.local) {
        scene('enable-relay', '보조 채널 예약하기', fmt('이쪽 시계 {0}에 연결을 시도합니다.', time(hypothesis.local)), null,
          '채널을 예약했다. 송신기가 그 시각에 건너편 주파수를 찾는다.', '', true,
          () => { r.tuneAt = hypothesis.local; });
      } else {
        offer('review-clocks', '수첩에서 시각 다시 확인', '이번 밤의 예약 시각을 지났습니다.', openJournal, false, '시간 유지');
      }
    }
    if (r.linked) {
      finalChoice('signal', '건너편 윤서에게 응답', '옥상에서 그 목소리에 남은 방송 시간을 씁니다.', !canJoin);
    }
    if (canJoin) {
      finalChoice('both', '두 방송을 잇기', '두 채널로 인터뷰와 응답을 함께 보냅니다. 2행동이 필요합니다.', true);
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
    if (r.linked) return ['건너편 호출 중', '헤드폰 너머로 누군가 같은 주파수를 부르고 있다.'];
    if (r.tuneAt > r.elapsed) return [fmt('{0} 교신 예약', time(r.tuneAt)), rooms.roof.arrival];
    if (r.tuneAt) return ['교신 실패', '수신기에 잡음만 남아 있다.'];
    return ['수신 대기', rooms.roof.arrival];
  }
  return ['폐국 정리 중', rooms.archive.arrival];
}

function objective() {
  const r = game.run;
  if (r.review) return '이번 밤을 돌아보고 다음 시도를 정한다';
  if (r.console && r.phase === 'play') return '송출 콘솔에서 마지막 방송을 준비한다';
  if (r.phase === 'expired') return '23:52로 돌아가 다음 시도를 시작한다';
  if (r.phase === 'ending') return '오늘 밤의 방송이 끝났다';
  if (r.dj && r.courier && !r.syncMissed) return r.linked && r.tape === 'delivered'
    ? '지금 윤서에게 동시 송출 신호를 보낸다' : '옥상에서 두 시계를 비교해 교신을 예약한다';
  if (r.tape && r.room !== 'roof') return '방송실에서 주민 인터뷰를 송출한다';
  if (r.linked) return '건너편 호출에 응답한다';
  if (r.room === 'roof' && r.tuneAt > r.elapsed) return '예약한 시각까지 교신을 기다린다';
  if (r.room === 'roof' && knows('relay') && !r.tuneAt) return '수첩에서 같은 사건의 기록을 연결한다';
  if (r.room === 'hall' && r.elapsed >= CART_LEAVES && !r.tape) return '다음 회차에 수레를 붙잡을 방법을 찾는다';
  return '자정 전에 주민 인터뷰 원본을 방송한다';
}

function nextPlan() {
  const r = game.run;
  if (r.phase === 'ending') return endings[r.ending].follow;
  if (r.phase === 'expired') {
    if (r.courier && r.dj) return '두 시계로 교신 시각을 계산하고, 송출 콘솔에서 쓸 두 행동도 남겨 보세요.';
    if (r.tape) return '다음엔 원본을 챙기는 즉시 방송실로 돌아가 보세요.';
    return '다음엔 23:57 전에 복도에 도착하면 상자를 살필 수 있습니다.';
  }
  if (r.elapsed === 0 && game.loop > 1) {
    if (knows('label') && knows('routing') && knows('relay')) return '이번에는 두 곳에서 같은 시간에 할 일을 누구에게 맡길지 정할 수 있습니다.';
    if (game.unlocked.includes('voices') && !knows('relay')) return '이번엔 옥상 송신실에서 건너편 수신 기록을 찾아보세요.';
    if (knows('label')) return '재호에게 파란 스티커를 미리 알려 주면, 당신이 다른 곳에 가도 원본이 움직입니다.';
    if (knows('departure')) return '23:57 전에 복도에 도착해 수레 안을 확인하세요.';
  }
  return '';
}

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = t(text);
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
  $('room-floor').textContent = t(r.phase === 'play' ? room.floor : '한려 FM');
  $('room-name').textContent = t(r.phase === 'play' ? room.name
    : r.phase === 'ending' ? endings[r.ending].title : '시간이 다 됐다');
  $('room-state').textContent = t(r.phase === 'play' ? state : '송출 종료');
  $('context').hidden = r.phase !== 'play';
  $('context').textContent = t(setting);

  const story = [];
  if (intro) {
    if (r.message) story.push(spoken({ text: r.message }));
    story.push(...opening.map(spoken));
  } else if (r.message && (r.message !== setting || r.phase !== 'play')) {
    story.push(spoken({ speaker: r.speaker, text: r.message }));
  }
  if (r.phase === 'ending') {
    story.push(spoken({ speaker: '마지막 송출', text: endings[r.ending].transcript, radio: true }));
  }
  $('story').replaceChildren(...story);
  $('event').hidden = !r.event;
  $('event').textContent = t(r.event);
  const clip = intro ? 'opening' : r.clip;
  const replayLabels = { opening: '첫 교신 듣기', delivery: '재호의 무전 듣기', call: '건너편 호출 듣기' };
  replayLabels.onAir = '오프닝 다시 듣기';
  $('replay').replaceChildren(...(clip ? [listenButton(clip, replayLabels[clip] ?? '마지막 송출 다시 듣기')] : []));
  const plan = nextPlan();
  $('plan').hidden = !plan || r.phase !== 'play' || r.review;
  $('plan').textContent = t(plan);
}

function renderBroadcast() {
  const r = game.run;
  $('broadcast').hidden = !r.console || r.review;
  if (!r.console) return;
  const onAir = r.phase === 'ending';
  $('broadcast').dataset.live = String(onAir);
  $('broadcast').dataset.linked = String(r.consoleReady);
  $('broadcast-state').textContent = t(onAir ? '송출 완료' : r.consoleReady ? '두 채널 연결됨' : '송출 대기');
  $('sync-cue').hidden = r.console !== 'both' || onAir || r.consoleReady;
  $('sync-cue').textContent = t('23:57 · 원본 전달 완료 · 건너편 교신 연결');
  const channels = {
    voices: [['순임의 인터뷰', r.tape ? '테이프 장착' : '테이프 대기']],
    signal: [['건너편 윤서', '교신 연결'], ['내 마이크', '마이크 대기']],
    both: [['순임의 테이프', '테이프 장착'], ['건너편 윤서', r.consoleReady ? '두 채널 연결됨' : '채널 연결 대기']],
  }[r.console];
  $('broadcast-channels').replaceChildren(...channels.map(([name, state]) => {
    const line = element('li');
    const meter = element('span', '', 'meter');
    meter.setAttribute('aria-hidden', 'true');
    line.append(element('span', name), element('strong', onAir ? '송출 완료' : state), meter);
    return line;
  }));
}

function renderRecap() {
  const r = game.run;
  const show = r.review || r.phase !== 'play';
  $('recap').hidden = !show;
  if (!show) return;
  const notes = r.log.slice(-4);
  $('observed').replaceChildren(...(notes.length ? notes.map(({ minute, text }) => {
    const line = element('li');
    line.append(element('time', time(minute)), element('span', text));
    return line;
  }) : [element('li', '아직 기록된 사건이 없습니다.')]));

  let missed = '아직 남은 시간에 다른 선택을 해 볼 수 있습니다.';
  if (r.ending === 'voices') missed = '주민 인터뷰는 전했지만 건너편 호출에는 응답하지 못했습니다.';
  else if (r.ending === 'signal') missed = '건너편에 닿았지만 이번 방송에는 주민 인터뷰가 빠졌습니다.';
  else if (r.ending === 'both') missed = '원본과 건너편 목소리가 모두 방송되었습니다.';
  else if (r.syncMissed) missed = '원본 전달과 교신이 겹친 순간에 윤서에게 신호를 보내지 못했습니다.';
  else if (r.tuneAt && !r.linked && r.elapsed >= r.tuneAt) missed = '예약한 시각에 건너편 채널이 닫혀 있었습니다.';
  else if (!r.tape && r.elapsed >= CART_LEAVES) missed = '23:57에 수레가 떠나 원본을 확보하지 못했습니다.';
  else if (r.phase === 'expired') missed = '자정까지 준비한 방송을 송출하지 못했습니다.';
  $('missed').textContent = t(missed);
  let next = '남은 시간에는 어떤 단서를 확인할 수 있을까요?';
  if (r.syncMissed) next = '원본 전달과 건너편 교신이 같은 시각에 오면 무엇을 먼저 해야 할까요?';
  else if (r.tuneAt && !r.linked && r.elapsed >= r.tuneAt) next = '종소리와 방송 오프닝에서 찾은 시차가 같은가요? 자료실 방송 일지에서 확인할 수 있습니다.';
  else if (r.courier && r.dj && r.phase === 'expired') next = '두 곳의 준비를 마친 뒤 콘솔에 몇 행동을 남겨야 할까요?';
  else if (r.ending === 'signal') next = '당신이 옥상에 있는 동안 누가 원본을 방송실로 옮길 수 있을까요?';
  else if (r.ending === 'both') next = '다른 선택을 했다면 어떤 목소리가 방송에 남을까요?';
  else if (knows('relay')) next = '같은 종소리가 두 시계에 몇 시로 기록되어 있나요?';
  else if (r.ending === 'voices') next = '옥상에 남은 녹음은 건너편의 다음 교신을 언제로 기록했을까요?';
  else if (r.elapsed >= CART_LEAVES && !r.tape) next = '수레가 나가기 전에 몇 시까지 복도에 도착해야 할까요?';
  $('next-question').textContent = t(next);
}

function renderTimeline() {
  const r = game.run;
  const entries = [
    [0, '마지막 방송 준비'],
    [CART_ARRIVES, knows('bell') ? '현관 종 두 번 · 수레 도착' : '현관에서 어떤 소리가 날까?'],
    [3, '한려 FM 생방송 시작'],
    [CART_LEAVES, r.tape === 'delivered' ? '재호가 방송실에 원본 전달' : knows('departure') ? '재호의 수레 출발' : '다음 사건'],
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
  $('objective').textContent = t(objective());
  $('clock').textContent = time(r.elapsed);
  $('budget').textContent = fmt('남은 행동 {0}회', left);
  document.querySelector('.hud').dataset.urgent = String(left <= 2 && r.phase === 'play');
  $('beats').replaceChildren(...Array.from({ length: LIMIT }, (_, index) => element('span', '', index < left ? 'on' : '')));
  $('cycle').textContent = fmt('{0}회차', game.loop);
  $('journal-count').textContent = game.known.length;
  $('sound').textContent = t(game.sound ? '소리 끄기' : '소리 켜기');
  $('sound').setAttribute('aria-pressed', String(game.sound));
  $('rewind').hidden = r.phase !== 'play' || r.elapsed === 0 || r.review || Boolean(r.console);
  $('quick').hidden = r.elapsed === 0;
  $('quick-review').disabled = r.phase === 'play' && Boolean(r.console);
  $('quick-review').textContent = t(r.review || r.phase !== 'play' ? '회차 기록' : '되감기 검토');
  document.body.classList.toggle('quick-active', r.elapsed > 0);
  renderScene();
  renderTimeline();
  renderBroadcast();
  renderRecap();

  const advanceNight = {
    title: '23:52로 되감기', detail: '발견한 단서와 결말을 가지고 돌아갑니다.', primary: true, cost: '', run: rewind,
  };
  const options = r.review ? [advanceNight, {
    title: '이번 밤 계속하기', detail: '남은 행동을 그대로 이어갑니다.', cost: '시간 유지', run: () => {
      r.review = false;
      update();
    },
  }] : r.phase === 'play' ? choices() : [advanceNight];
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

  $('locations').hidden = r.phase !== 'play' || r.review || Boolean(r.console) || (game.loop === 1 && r.elapsed === 0);
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
      item.append(element('span', fmt('미발견 결말 {0}', index + 1)));
    } else {
      const button = element('button', ending.title, 'ending-link');
      button.type = 'button';
      button.addEventListener('click', () => {
        $('record-title').textContent = t(ending.title);
        $('record-story').textContent = t(ending.story);
        $('record').showModal();
      });
      item.append(button);
    }
    return item;
  }));
}

let selectedEvidence = {};
let pairFeedback = '';

function renderDeduction() {
  const discovered = Object.entries(evidence).filter(([, item]) => knows(item.clue));
  $('deduction').hidden = !discovered.length;
  if ($('deduction').hidden) return;
  $('clock-evidence').replaceChildren(...Object.entries({ local: '이쪽 시계', remote: '건너편 시계' }).map(([side, title]) => {
    const column = element('div', '', 'evidence-column');
    column.append(element('h4', title));
    const available = discovered.filter(([, item]) => item.side === side);
    if (!available.length) column.append(element('p', '아직 발견한 기록이 없습니다.', 'note'));
    for (const [id, item] of available) {
      const paired = game.matches.includes(item.event);
      const card = element('button', '', 'evidence-card');
      card.type = 'button';
      card.dataset.evidence = id;
      card.disabled = paired;
      card.setAttribute('aria-pressed', String(selectedEvidence[side] === id));
      card.append(element('span', item.label), element('strong', item.time), element('small', item.detail));
      if (paired) card.append(element('small', '연결됨', 'paired'));
      card.addEventListener('click', () => {
        selectedEvidence[side] = selectedEvidence[side] === id ? '' : id;
        pairFeedback = '';
        renderDeduction();
        $('clock-evidence').querySelector('[data-evidence="' + id + '"]').focus();
      });
      column.append(card);
    }
    return column;
  }));
  $('pair-evidence').disabled = !selectedEvidence.local || !selectedEvidence.remote;
  $('pair-result').textContent = t(pairFeedback || (game.matches.length === 2
    ? '두 사건 모두 같은 시차를 보여 줍니다.'
    : game.matches.length ? '연결한 기록의 시각으로 가설을 세우세요. 다른 사건으로도 확인할 수 있습니다.' : ''));
  $('hypothesis-stage').hidden = !game.matches.length;
  if (!game.matches.length) return;

  $('hypotheses').replaceChildren(...Object.entries(hypotheses).map(([id, hypothesis]) => {
    const button = element('button', hypothesis.label, 'utility');
    button.type = 'button';
    button.dataset.hypothesis = id;
    button.setAttribute('aria-pressed', String(game.hypothesis === id));
    button.addEventListener('click', () => {
      game.hypothesis = id;
      save();
      render();
      renderDeduction();
      $('hypotheses').querySelector('[aria-pressed="true"]').focus();
    });
    return button;
  }));
  $('hypothesis-result').textContent = game.hypothesis
    ? fmt('가설대로라면 건너편 23:58은 이쪽 {0}입니다. 옥상 송신기에서 시험하세요.', time(hypotheses[game.hypothesis].local))
    : t('건너편의 다음 교신은 23:58입니다. 연결한 기록을 근거로 가설을 고르세요.');
}

function pairEvidence() {
  const local = evidence[selectedEvidence.local];
  const remote = evidence[selectedEvidence.remote];
  if (!local || !remote) return;
  if (local.event !== remote.event) {
    pairFeedback = '서로 다른 사건입니다. 소리나 멘트가 일치하는 기록을 골라 보세요.';
    renderDeduction();
    return;
  }
  if (!game.matches.includes(local.event)) game.matches.push(local.event);
  selectedEvidence = {};
  pairFeedback = local.event === 'bell' ? '두 종소리를 같은 사건으로 연결했습니다.' : '두 방송 오프닝을 같은 사건으로 연결했습니다.';
  if (game.matches.length === 2) pairFeedback += '\n두 사건 모두 같은 시차를 보여 줍니다.';
  save();
  render();
  renderDeduction();
  $('hypotheses').querySelector('[aria-pressed="true"], button').focus();
}

function openJournal() {
  selectedEvidence = {};
  pairFeedback = '';
  renderDeduction();
  $('clues').replaceChildren(...game.known.map((id) => {
    const { title, fact, question, clip } = clues[id];
    const item = element('li');
    item.append(element('h3', title), element('p', fact), element('p', question, 'question'));
    if (clip) {
      const labels = { opening: '첫 교신 다시 듣기', distantBell: '기록된 종소리 듣기', onAir: '오프닝 다시 듣기' };
      item.append(listenButton(clip, labels[clip]));
    }
    return item;
  }));
  $('journal').showModal();
}

const shareMedia = {
  ko: { poster: './media/share-ko.jpg', video: './media/intro-ko.mp4' },
  en: { poster: './media/share-en.jpg', video: './media/intro-en.mp4' },
};

function openShare() {
  const language = game.language;
  const media = shareMedia[language];
  const target = new URL(language === 'en' ? '/en/' : '/?lang=ko', 'https://eight-minutes-to-air.asdad123asd.chatgpt.site/');
  $('share-url').value = target.href;
  $('share-result').textContent = '';
  $('download-card').href = media.poster;
  $('download-card').download = '8-minutes-to-air-' + language + '.jpg';
  const video = $('intro-video');
  video.poster = media.poster;
  const videoSource = location.hostname === target.hostname
    ? new URL(media.video, 'https://gmlduqzhd123-lab.github.io/Last-Broad/').href : media.video;
  if (video.getAttribute('src') !== videoSource) video.setAttribute('src', videoSource);
  $('share').showModal();
}

$('pair-evidence').addEventListener('click', pairEvidence);
$('share-open').addEventListener('click', openShare);
$('share-close').addEventListener('click', () => $('share').close());
$('share').addEventListener('close', () => $('intro-video').pause());
$('copy-link').addEventListener('click', async () => {
  const field = $('share-url');
  try {
    await navigator.clipboard.writeText(field.value);
    $('share-result').textContent = t('플레이 링크를 복사했습니다.');
  } catch {
    field.focus();
    field.select();
    $('share-result').textContent = t('선택된 링크를 복사해 주세요.');
  }
});
$('journal-open').addEventListener('click', openJournal);
$('quick-journal').addEventListener('click', openJournal);
$('quick-review').addEventListener('click', reviewNight);
$('journal-close').addEventListener('click', () => $('journal').close());
$('record-close').addEventListener('click', () => $('record').close());
$('rewind').addEventListener('click', reviewNight);
$('language').addEventListener('click', () => {
  game.language = game.language === 'en' ? 'ko' : 'en';
  if (location.protocol !== 'file:') {
    const url = new URL(location.href);
    url.searchParams.set('lang', game.language);
    history.replaceState(null, '', url);
  }
  save();
  renderLanguage();
  render();
});
$('sound').addEventListener('click', () => {
  game.sound = !game.sound;
  save();
  $('sound').textContent = t(game.sound ? '소리 끄기' : '소리 켜기');
  $('sound').setAttribute('aria-pressed', String(game.sound));
  if (!game.sound) stopClip();
  else if (game.run.elapsed === 0) playClip('opening');
  else if (game.run.clip) playClip(game.run.clip);
});

function renderLanguage() {
  document.documentElement.lang = game.language;
  document.title = t('마지막 방송까지 8분');
  const english = game.language === 'en';
  $('language').textContent = english ? '한국어' : 'EN';
  $('language').lang = english ? 'ko' : 'en';
  $('language').setAttribute('aria-label', english ? '한국어로 전환' : 'Switch to English');
  document.querySelectorAll('[data-text]').forEach((node) => { node.textContent = t(node.dataset.text); });
  document.querySelectorAll('[data-label]').forEach((node) => { node.setAttribute('aria-label', t(node.dataset.label)); });
}

save();
renderLanguage();
render();
