'use strict';

const LIMIT = 8;
const SAVE_KEY = 'haemun-fm-eight-minutes-v1';
const START_MESSAGE = '한려 FM의 마지막 밤. 주민들의 목소리를 담은 테이프가 사라졌다. 자정 전에 찾아 마지막 방송을 내보내자.';

const rooms = {
  studio: { name: '방송실', floor: '2층', description: '진행자 윤서가 마지막 방송 순서를 맞추고 있다. 창 너머로 부두의 불빛이 흔들린다.' },
  hall: { name: '복도', floor: '1층', description: '현관 종이 매달려 있다. 운반 담당 재호가 방송국에서 내보낼 상자들을 점검한다.' },
  archive: { name: '자료실', floor: '1층', description: '미라가 다 비어 가는 선반 앞에 앉아 있다. 마지막 방송에 남겨 놓으려던 목소리만 여기 없다.' },
  roof: { name: '옥상 송신실', floor: '옥상', description: '빗소리 사이로 수신기의 잡음이 들린다. 유리창 밑에는 오래된 보조 송신기가 놓여 있다.' },
};

const clues = {
  rundown: { title: '마지막 편성표', detail: '23:52부터 자정까지 8분. 마지막 순서는 주민 인터뷰다. 원본을 찾으면 방송실에서 재생할 수 있다.' },
  bell: { title: '종소리 두 번', detail: '23:54, 현관 종이 두 번 울린다. 재호의 수레는 23:54부터 23:56까지 복도에 서 있다.' },
  label: { title: '뒤바뀐 라벨', detail: '인터뷰 테이프는 ‘빈 상자’에 있다. 다음 회차에는 재호가 수레를 떠나기 전에 상자를 맡겨 두라고 부탁할 수 있다.' },
  routing: { title: '두 채널 연결표', detail: '자료실의 연결표에 따르면 방송실에서 두 채널을 함께 열 수 있다. 윤서가 전환을 맡고, 재호가 테이프를 가져오고, 옥상에서 보조 채널을 열어야 한다.' },
  echo: { title: '다른 밤의 목소리', detail: '수신기에 잡힌 목소리는 윤서였다. “여긴 한려 FM. 방송이 끝났는데도 시계가 23시 56분에 멈춰 있어요.”' },
  relay: { title: '보조 송신기', detail: '수신기에 잡힌 채널로 응답할 수 있다. 옥상에서 채널을 열면 직접 응답하거나, 방송실로 돌아가 윤서와 함께 두 채널을 쓸 수 있다.' },
};

const endings = {
  voices: {
    title: '마을의 목소리',
    story: '“처음 이 동네에 온 날이요? 바다가 집 안에서도 들렸죠.” 마지막 전파에 주민들의 웃음이 실린다. 부두의 어선 한 척이 기적을 울린다. 옥상 수신기에 남은 질문은 끝내 잡음에 묻혔다.',
  },
  signal: {
    title: '건너편의 응답',
    story: '“듣고 있어요. 여기도 한려 FM이에요.” 잡음 뒤에서 윤서가 짧게 웃는다. “그래요. 그럼 우리 둘 다 방송을 끝낼 수 있겠네요.” 자정이 오고, 주민 인터뷰 순서만 편성표에 남는다.',
  },
  both: {
    title: '두 밤의 방송',
    story: '재호가 가져온 테이프를 돌리자 두 방송국에 같은 목소리가 퍼진다. 이쪽 윤서가 마이크를 넘긴다. 건너편 윤서가 주민의 이야기 사이로 인사한다. “한려 FM입니다. 여기서도 잘 들립니다.” 두 세계의 시계가 함께 자정을 지난다.',
  },
};

const newRun = () => ({
  elapsed: 0,
  room: 'studio',
  tape: false,
  delivery: false,
  dj: false,
  channel: false,
  used: [],
  phase: 'play',
  message: START_MESSAGE,
  tone: '',
});

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && Object.hasOwn(rooms, saved.run?.room) && Number.isInteger(saved.run.elapsed)
        && saved.run.elapsed >= 0 && saved.run.elapsed <= LIMIT && Number.isInteger(saved.loop)
        && saved.loop > 0 && Array.isArray(saved.known) && Array.isArray(saved.unlocked)
        && Array.isArray(saved.run.used) && ['play', 'expired', 'ending'].includes(saved.run.phase)) {
      saved.run.message = saved.run.message.replaceAll('해문 FM', '한려 FM');
      return saved;
    }
  } catch {
    // Browsers that block storage can still play for the current session.
  }
  return { loop: 1, known: [], unlocked: [], sound: false, run: newRun() };
}

const game = loadGame();
const $ = (id) => document.getElementById(id);
const ui = {};
for (const id of [
  'room-name', 'room-description', 'clock-readout', 'message', 'actions',
  'places', 'map', 'loop', 'timer-display', 'minute-track', 'journal-count', 'clue-count',
  'clue-list', 'dialog-clues', 'journal-dialog', 'journal-open', 'journal-close',
  'ending-count', 'ending-list', 'sound', 'rewind', 'station-state',
]) {
  ui[id] = $(id);
}

const knows = (id) => game.known.includes(id);
const learn = (id) => { if (!knows(id)) game.known.push(id); };
const timeLabel = (elapsed) => elapsed === LIMIT ? '00:00' : '23:' + (52 + elapsed);

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* In-memory play still works. */ }
}

let audioContext;
function sound(kind) {
  if (!game.sound) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    audioContext ||= new Audio();
    const start = audioContext.currentTime + 0.025;
    const notes = kind === 'bell' ? [660, 525] : kind === 'ending' ? [262, 330, 392]
      : kind === 'rewind' ? [440, 350, 275] : [370];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + index * 0.135;
      oscillator.type = kind === 'bell' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.065, at + 0.024);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.205);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.22);
    });
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch {
    // Sound is optional.
  }
}

function offerActions() {
  const r = game.run;
  const offers = [];
  const offer = (id, title, detail, perform, primary = false) => {
    if (!r.used.includes(id)) offers.push({ id, title, detail, perform, primary });
  };
  const inspect = (id, title, detail, clue, message) => offer(id, title, detail, () => {
    learn(clue);
    return message;
  });

  if (r.room === 'studio') {
    inspect('rundown', '편성표 읽기', '남은 방송 순서를 살핍니다.', 'rundown',
      '마지막 순서에 ‘주민 인터뷰 원본’이라고 적혀 있다. 자정이 오기 전에 테이프를 방송실로 가져와야 한다.');
    offer('ask-dj', '윤서에게 묻기', '윤서와 테이프 이야기를 나눕니다.', () =>
      '윤서 “미라 씨가 자료실에 원본을 뒀대요. 오늘 상자 정리는 재호 씨가 맡았고요. 혹시 복도부터 확인해 볼래요?”');
    if (knows('routing')) {
      offer('assign-dj', '윤서에게 두 채널을 부탁하기', '윤서가 방송 중 채널 전환을 맡습니다.', () => {
        r.dj = true;
        return '윤서가 연결표를 접어 콘솔 옆에 놓는다. “두 채널 전환은 제가 맡을게요. 재호 씨에게 원본을 가져다 달라고 부탁하고 옥상 채널을 열어 주세요.”';
      });
    }
    if (r.tape) {
      offer('tape-ending', '주민 인터뷰 방송하기', '테이프의 목소리를 마지막 전파에 싣습니다.', () => finish('voices'), true);
    }
    if (r.tape && r.delivery && r.dj && r.channel) {
      offer('both-ending', '두 채널로 방송하기', '주민 인터뷰를 보내며 건너편에도 응답합니다.', () => finish('both'), true);
    }
  }

  if (r.room === 'hall') {
    if (r.elapsed >= 2 && r.elapsed <= 4) {
      offer('open-cart', '수레의 상자 열어 보기', '재호의 수레가 잠시 멈춰 있습니다.', () => {
        r.tape = true;
        learn('label');
        return '‘빈 상자’라는 라벨 아래 주민 인터뷰 테이프가 있다. 재호가 상자를 들어 보이며 말한다. “다음엔 먼저 알려 줘요. 방송실에 가져다줄게요.”';
      }, true);
    }
    if (knows('label') && r.elapsed <= 4) {
      offer('assign-courier', '재호에게 원본 배달 부탁하기', '재호가 원본을 찾아 방송실로 가져갑니다.', () => {
        r.delivery = true;
        r.tape = true;
        return '재호 “빈 상자 뒤쪽이요? 알겠어요. 테이프는 윤서 씨한테 가져다줄게요.” 이제 옥상으로 바로 갈 수 있다.';
      });
    }
    offer('ask-courier', '재호에게 동선 묻기', '수레가 언제 돌아오는지 알아봅니다.', () =>
      r.elapsed >= 5
        ? '재호 “상자들은 방금 차에 실었어요. 다음에 찾으려면 23시 54분에 와요. 현관 종을 두 번 울리고 수레를 세우거든요.”'
        : '재호 “23시 54분에 종을 두 번 울리고 수레를 세워요. 23시 57분엔 상자를 차로 옮기니까 그전에 오세요.”');
  }

  if (r.room === 'archive') {
    offer('ask-mira', '미라에게 원본 묻기', '테이프를 마지막으로 본 사람에게 묻습니다.', () =>
      '미라 “원본에 파란 스티커를 붙였어요. 포장할 때 상자가 섞였나 봐요. 복도 수레에 올라갔을지도 몰라요.”');
    inspect('routing', '두 채널 연결표 펼치기', '선반에 놓인 송신 연결표를 읽습니다.', 'routing',
      '미라 “보조 채널을 열면 방송실에서도 두 채널을 쓸 수 있어요. 윤서가 전환을 맡고, 재호가 원본을 가져오면 해 볼 만해요.”');
  }

  if (r.room === 'roof') {
    inspect('echo', '잡음 속 목소리 듣기', '수신기의 볼륨을 올립니다.', 'echo',
      '“여긴 한려 FM. 방송은 끝났는데… 시계가 23시 56분에 멈춰 있어요.” 매일 듣던 윤서의 목소리다. 윤서는 지금 방송실에 있을 텐데.');
    inspect('relay', '보조 송신기 살펴보기', '수신 채널에 응답할 방법을 찾습니다.', 'relay',
      '보조 송신기는 수신한 주파수로 답할 수 있다. 채널을 열어 둔 뒤 방송실로 돌아가면 윤서도 이 회선에 접속할 수 있다.');
    if (knows('echo') && knows('relay')) {
      offer('tune', '보조 채널 열기', '건너편 방송국과 통화할 회선을 엽니다.', () => {
        r.channel = true;
        return '수신기의 잡음이 잦아든다. “누구든 듣고 있으면 답해 주세요.” 이곳에서 답하거나, 방송실로 돌아가 두 채널을 함께 열 수 있다.';
      }, true);
    }
    if (r.channel) {
      offer('answer-ending', '건너편에 응답하기', '옥상에서 그 목소리에 마지막 전파를 보냅니다.', () => finish('signal'), true);
    }
  }

  offers.push({ id: 'wait', title: '1분 기다리기', detail: '현재 위치에서 시간을 보냅니다.', perform: () =>
    r.room === 'hall' && r.elapsed === 4
      ? '재호가 상자들을 차로 옮기기 시작한다. 수레 위가 텅 비었다.'
      : '벽시계의 분침이 움직인다.' });
  return offers;
}

function finish(id) {
  if (!game.unlocked.includes(id)) game.unlocked.push(id);
  const ending = endings[id];
  Object.assign(game.run, {
    phase: 'ending',
    elapsed: LIMIT,
    tone: 'end',
    message: ending.title + '\n' + ending.story,
  });
}

function advance(message, newClue) {
  const r = game.run;
  r.elapsed += 1;
  r.tone = newClue ? 'clue' : '';
  let cue = 'step';
  if (r.elapsed === 2) {
    const firstBell = !knows('bell');
    learn('bell');
    r.tone ||= firstBell ? 'clue' : '';
    message += '\n딩, 딩. 현관 종이 두 번 울린다.';
    cue = 'bell';
  }
  if (r.elapsed === LIMIT) {
    r.phase = 'expired';
    r.tone = 'end';
    message += '\n\n자정. 스피커가 조용해진다. 다시 눈을 뜨면 시계는 23:52를 가리킬 것이다.';
  }
  r.message = message;
  return cue;
}

function takeAction(action) {
  if (game.run.phase !== 'play') return;
  const count = game.known.length;
  const result = action.perform();
  if (action.id !== 'wait') game.run.used.push(action.id);
  const cue = game.run.phase === 'ending' ? 'ending' : advance(result, game.known.length > count);
  update(cue);
}

function travel(id) {
  if (game.run.phase !== 'play' || game.run.room === id) return;
  game.run.room = id;
  const arrival = {
    studio: '방송실에 돌아왔다. 윤서가 콘솔 너머로 고개를 든다.',
    hall: '복도로 들어섰다. 문 가까이에서 바퀴 구르는 소리가 난다.',
    archive: '자료실에 들어왔다. 미라가 책상 위의 종이를 정리한다.',
    roof: '옥상 송신실에 올라왔다. 수신기에 약한 신호가 잡힌다.',
  };
  update(advance(arrival[id], false));
}

function rewind() {
  if (!game.run.elapsed) return;
  game.loop += 1;
  game.run = newRun();
  game.run.message = '다시 23:52. 윤서는 처음 보는 얼굴처럼 말을 건넨다. 수첩에 적은 단서는 그대로다.';
  update('rewind');
}

function update(cue) {
  save();
  render();
  sound(cue);
  ui.message.focus({ preventScroll: true });
  if (ui.message.getBoundingClientRect().top < 0) {
    ui.message.scrollIntoView({ block: 'center' });
  }
}

function make(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderClues(list) {
  if (!game.known.length) {
    list.replaceChildren(make('li', '편성표를 읽거나 사람에게 말을 걸어 보세요. 발견한 단서가 여기에 기록됩니다.', 'empty'));
    return;
  }
  list.replaceChildren(...game.known.map((id) => {
    const clue = clues[id];
    const row = make('li', '', 'found');
    row.append(make('strong', clue.title), make('p', clue.detail));
    return row;
  }));
}

function render() {
  const r = game.run;
  const left = LIMIT - r.elapsed;
  const isPlaying = r.phase === 'play';
  ui['room-name'].textContent = r.phase === 'ending' ? '마지막 방송' : rooms[r.room].name;
  ui['room-description'].textContent = isPlaying ? rooms[r.room].description : '';
  ui['room-description'].hidden = !isPlaying;
  ui['station-state'].replaceChildren(make('span'), document.createTextNode(left ? ' 폐국까지' : ' 송출 종료'));
  ui['clock-readout'].textContent = timeLabel(r.elapsed);
  ui.message.textContent = r.message;
  ui.message.dataset.tone = r.tone;
  ui.loop.textContent = game.loop + '회차';
  ui['timer-display'].replaceChildren(document.createTextNode(String(left).padStart(2, '0')), make('span', ':'), document.createTextNode('00'));
  ui['minute-track'].setAttribute('role', 'img');
  ui['minute-track'].setAttribute('aria-label', '남은 시간 ' + left + '분');
  ui['minute-track'].replaceChildren(...Array.from({ length: LIMIT }, (_, i) => make('span', '', i < left ? 'remaining' : '')));
  ui['journal-count'].textContent = game.known.length;
  ui['clue-count'].textContent = game.known.length + ' / ' + Object.keys(clues).length;
  ui['ending-count'].textContent = game.unlocked.length + ' / ' + Object.keys(endings).length;
  ui['ending-list'].replaceChildren(...Object.entries(endings).map(([id, info], index) =>
    game.unlocked.includes(id) ? make('li', '✓ ' + info.title, 'unlocked') : make('li', '결말 ' + (index + 1) + ' · 미발견')));
  renderClues(ui['clue-list']);
  renderClues(ui['dialog-clues']);
  ui.sound.setAttribute('aria-pressed', String(game.sound));
  ui.sound.textContent = game.sound ? '효과음 켬' : '효과음 끔';
  ui.rewind.disabled = !r.elapsed;
  ui.rewind.hidden = !isPlaying;
  ui.map.hidden = !isPlaying;
  ui['places'].replaceChildren(...Object.entries(rooms).map(([id, room]) => {
    const button = make('button', room.name, 'place');
    button.type = 'button';
    if (id === r.room) button.setAttribute('aria-current', 'location');
    button.disabled = id === r.room || !isPlaying;
    button.append(make('small', id === r.room ? '현재 위치' : room.floor));
    button.addEventListener('click', () => travel(id));
    return button;
  }));
  const actions = isPlaying ? offerActions() : [{
    title: r.phase === 'ending' ? '다른 결말 찾아보기' : '8분 전으로 되감기',
    detail: '발견한 단서를 가지고 23:52로 돌아갑니다.',
    primary: true,
  }];
  ui.actions.replaceChildren(...actions.map((action) => {
    const button = make('button', action.title, action.primary ? 'action primary' : 'action');
    button.type = 'button';
    button.append(make('small', isPlaying && !action.id.endsWith('-ending') && action.id !== 'wait'
      ? action.detail + ' · 1분' : action.detail));
    button.addEventListener('click', () => isPlaying ? takeAction(action) : rewind());
    return button;
  }));
}

ui['journal-open'].addEventListener('click', () => ui['journal-dialog'].showModal());
ui['journal-close'].addEventListener('click', () => ui['journal-dialog'].close());
ui.rewind.addEventListener('click', rewind);
ui.sound.addEventListener('click', () => {
  game.sound = !game.sound;
  save();
  render();
  ui.sound.focus();
  sound('step');
});
render();
