'use strict';

const LIMIT = 8;
const CART_ARRIVES = 2;
const ON_AIR = 3;
const CART_LEAVES = 5;
const REPLY_WINDOW = 5;
const TRANSMISSION_CUT = 1500;
const TRANSMISSION_LENGTH = 7600;
const CALL_QUESTION_START = 4.6145625; // The full call ends at 4.3745625 s, followed by 240 ms of static.
const CALL_LEAD_LENGTH = 3600;
const SAVE_KEY = 'haemun-fm-eight-minutes-v1';
const AUDIO_CACHE = 'last-broad-audio-v1';
const DEFAULT_MIX = { speech: 100, effects: 65, ambience: 25 };
const PROLOGUE_LENGTH = 20000;
const PIER_LIMIT = 4;
const routeSources = { tape: '순임의 테이프', relay: '건너편 교신' };
const routeDestinations = { main: '한려 FM', aux: '보조 채널' };
const correctRoutes = { tape: 'main', relay: 'aux' };
const emptyRoutes = () => ({ tape: '', relay: '' });
const routesReady = (routes) => routes.tape === correctRoutes.tape && routes.relay === correctRoutes.relay;
const cartArrived = '높은 종, 낮은 종. 23:54에 재호의 수레가 들어온다.';
const cartDeparted = '재호가 남은 상자를 차에 싣는다. 복도가 비었다.';
const tapeDelivered = '재호의 무전 “윤서 씨한테 원본 전달했어요. 이제 옥상만 남았죠?”';
const contactOpened = '예약한 시각에 건너편 채널이 열렸다.';
const contactMissed = '예약 시각에 잡음만 들린다. 건너편 교신은 이미 지나갔다.';
const syncMissed = '동시 송출 신호를 보낼 순간이 지났다. 열린 교신에 답할 시간은 남아 있다.';
const loopMarkers = {
  cartArrived: [cartArrived, '현관 종 두 번 · 수레 도착', 'movement'],
  movement: ['이동 · {0}', '방송국 안에서 이동', 'movement'],
  cartDeparted: [cartDeparted, '재호의 수레 출발', 'tape'],
  tapeDelivered: [tapeDelivered, '재호가 방송실에 원본 전달', 'tape'],
  tapeFound: ['수레의 상자 확인', '수레에서 원본을 찾았다', 'tape'],
  radio: ['무전으로 재호에게 부탁', '재호에게 무전', 'tape'],
  courier: ['재호에게 원본 운반 부탁', '복도에서 재호에게 원본을 맡겼다', 'tape'],
  interview: ['테이프 재생하기', '순임의 인터뷰를 송출했다', 'tape'],
  reserve: ['교신 예약 확정 · {0}', '옥상에 교신을 예약했다', 'contact'],
  reschedule: ['교신 예약 변경 · {0} → {1}', '옥상 교신 예약을 바꿨다', 'contact'],
  contactOpened: [contactOpened, '건너편 교신이 열렸다', 'contact'],
  contactMissed: [contactMissed, '예약한 시각에 잡음만 들렸다', 'contact'],
  cue: ['동시 송출 신호 보내기', '두 방송에 신호를 보냈다', 'contact'],
  syncMissed: [syncMissed, '동시 송출 신호를 놓쳤다', 'contact'],
  exchange: ['', '원본 도착 · 건너편 호출', 'contact'],
  wait: ['1분 기다리기', '방송을 기다렸다', 'fallback'],
  voices: ['', '순임의 인터뷰를 송출했다'],
  signal: ['', '건너편 윤서에게 응답했다'],
  both: ['', '원본과 건너편 목소리를 송출했다'],
};

const markerByEvent = new Map(Object.entries(loopMarkers).filter(([, [event]]) => event).map(([id, [event]]) => [event, id]));
const receiverBands = [
  { label: '한려 FM', state: '방송 대기', caption: '[낮은 전기음] 한려 FM. 마지막 방송을 준비하고 있습니다.', wave: [21, 35, 24, 40, 54, 25, 33, 20] },
  { label: '직원 무전', state: '무전 수신', caption: '[짧은 잡음] 재호입니다. 호출할 땐 “현관, 응답”이라고 해 주세요.', wave: [12, 48, 22, 55, 28, 65, 19, 36] },
  { label: '미확인 신호', state: '미확인 신호 포착', caption: '[높은 종] [낮은 종] 윤서 “거기서도 이 종소리 들려요?”', wave: [15, 87, 58, 17, 60, 39, 15, 23] },
];
const hypotheses = {
  equal: { label: '두 시계가 같다', local: 6 },
  slower: { label: '건너편이 1분 느리다', local: 7 },
  faster: { label: '건너편이 1분 빠르다', local: 5 },
};
const evidence = {
  localBell: { clue: 'bell', side: 'local', event: 'bell', time: '23:54', label: '복도 현관 종', detail: '[높은 종 → 낮은 종]', clip: 'localBell', replay: '현관 종 재생' },
  localOpening: { clue: 'onAir', side: 'local', event: 'onAir', time: '23:55', label: '방송실 오프닝', detail: '“비 오는 항구의 밤입니다.”' },
  remoteBell: { clue: 'relay', side: 'remote', event: 'bell', time: '23:55', label: '건너편 수신 녹음', detail: '[높은 종 → 낮은 종]', clip: 'distantBell', replay: '수신 녹음 재생' },
  remoteOpening: { clue: 'airlog', side: 'remote', event: 'onAir', time: '23:56', label: '건너편 방송 일지', detail: '“비 오는 항구의 밤입니다.”' },
};
const voices = {
  prologue: './audio/prologue-signal.wav',
  openingEcho: './audio/opening-echo.wav',
  opening: './audio/opening.wav',
  call: './audio/call.wav',
  delivery: './audio/delivery.wav',
  distantBell: './audio/distant-bell.wav',
  localBell: './audio/local-bell.wav',
  onAir: './audio/harbor-opening.wav',
  voices: './audio/sunim.wav',
  signal: './audio/ending-signal.wav',
  both: './audio/two-nights.wav',
  receiverStatic: './audio/receiver-static.wav',
  receiverStaff: './audio/receiver-staff.wav',
  receiverEcho: './audio/receiver-echo.wav',
  pierSignoff: './audio/pier-signoff.wav',
  callWithQuestion: './audio/call-with-question.wav',
  signalRevealed: './audio/ending-signal-revealed.wav',
  bothRevealed: './audio/two-nights-revealed.wav',
  epilogue: './audio/epilogue.wav',
  pierCall: './audio/pier-call.wav',
  pierAnswer: './audio/pier-answer.wav',
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
  receiver: { title: '미확인 신호의 종소리', fact: '탁상 수신기 속에서 높은 종 뒤에 낮은 종이 울렸다. 건너편 윤서도 이 소리를 들었다.', question: '한려 FM의 어디에서 같은 소리가 날까?', clip: 'receiverEcho' },
  staffCall: { title: '직원 무전 호출', fact: '직원 무전에서 재호가 호출 문구 “현관, 응답”을 알려 줬다.', question: '파란 스티커의 의미를 알면 방송실에서도 운반을 부탁할 수 있겠다.', clip: 'receiverStaff' },
  rundown: { title: '마지막 편성표', fact: '마지막 편성은 주민 인터뷰. 좋은 날에 들려주겠다던 어부와 상인의 이야기가 들어 있다.', question: '원본은 방송실에 어떻게 돌아올까?' },
  bell: { title: '복도의 종소리', fact: '이쪽 시계 23:54. 높은 종소리 뒤에 낮은 종소리가 울렸다. 수레가 현관에 들어왔다.', question: '건너편 녹음에도 같은 소리가 있을까?' },
  departure: { title: '수레의 출발 시각', fact: '재호는 23:57에 남은 짐을 차에 싣는다.', question: '그 전에 상자 안을 확인하거나, 누군가에게 맡길 수 있을까?' },
  label: { title: '파란 스티커', fact: '‘빈 상자’ 라벨 아래에 미라가 붙인 파란 스티커가 있다. 주민 인터뷰 원본이 그 안에 들어 있었다.', question: '라벨이 틀렸다는 걸 더 일찍 알려 주면?' },
  routing: { title: '두 곳에서 하는 일', fact: '방송실에서 테이프를 큐에 올리고 옥상에서 수신 채널을 연다. 연결표에는 테이프는 한려 FM, 건너편 교신은 보조 채널로 표시돼 있다.', question: '두 곳의 작업을 같은 시간에 맡길 방법은?' },
  relay: { title: '건너편 수신 기록', fact: '건너편 시계 23:55. 높은 종소리 뒤에 낮은 종소리가 들어 있다. 다음 교신은 건너편 시계 23:58에 열린다.', question: '이쪽 시계로는 몇 시에 보조 채널을 열어야 할까?', clip: 'distantBell' },
  onAir: { title: '윤서의 오프닝', fact: '이쪽 시계 23:55. 윤서가 “비 오는 항구의 밤입니다”라고 방송을 시작했다.', question: '건너편 방송 일지에는 이 멘트가 언제 찍혔을까?', clip: 'onAir' },
  airlog: { title: '건너편 방송 일지', fact: '자료실의 자동 수신 일지에 “비 오는 항구의 밤입니다”가 건너편 시계 23:56으로 기록돼 있다.', question: '종소리에서 찾은 시차와도 일치할까?', clip: 'onAir' },
  remoteSlot: { title: '건너편 편성표의 빈칸', fact: '방송 일지 뒷면의 편성표에서 ‘순임 인터뷰’ 칸이 비어 있다. 다음 줄은 폐국 안내다.', question: '건너편 윤서는 이 칸을 두고 무슨 말을 했을까?' },
  remoteRequest: { title: '23:57 · 건너편 윤서의 부탁', fact: '교신이 열리자 건너편 윤서가 “그쪽엔 순임 씨 원본이 아직 있어요?”라고 물었다.', question: '왜 윤서는 우리 쪽에 남아 있는 원본을 찾을까?', clip: 'callWithQuestion' },
  sunim: { title: '순임이 남긴 부탁', fact: '테이프에 순임의 메모가 붙어 있다. 아버지는 큰비가 온 밤마다 라디오로 귀항 소식을 확인하며 부두에서 기다렸다.', question: '순임은 마지막 방송을 누가 듣길 바랐을까?' },
};
const callWords = '“여기는 한려 FM. 아직 듣고 있는 사람 있나요?”';
const callQuestion = '건너편 윤서 “그쪽엔 순임 씨 원본이 아직 있어요?”';
const exchangeLines = [
  { clip: 'delivery', channel: '직원 무전', live: '재호 “윤서 씨한테 원본 전달했어요.”', caption: tapeDelivered },
  { clip: 'callWithQuestion', channel: '보조 채널', live: callQuestion, caption: `${callWords}\n${callQuestion}` },
];
const epilogueTranscript = '“거긴 아직 23시 52분이죠? 여기선 마지막 방송이 이미 끝났어요.”\n[잡음이 걷힌다.]\n“그쪽엔 아직 시간이 있죠? 순임 씨 목소리, 그 방송에 실어 줘요.”';
const mysteryEvidence = ['remoteSlot', 'remoteRequest'];
const pierOpening = '자정이 지난 선착장. 마지막 방송을 듣던 당신 곁에는 휴대용 라디오와 대합실 스피커가 있다.';
const pierCall = '라디오에서 순임의 마지막 인사가 흐른다. 기척도 없는 부두에서 두 번째 목소리가 들린다.\n“아직 여기서 듣고 있어요.”';
const pierObservations = {
  radio: ['라디오를 꺼 보기', '라디오 화면이 어두워진 뒤에도 “아직 듣고 있어요”가 한 번 더 들린다. 목소리는 대합실 쪽에서 가까워진다.'],
  intercom: ['대합실 인터폰 확인', '대합실 스피커의 녹색 수신등이 깜박인다. 옆 당직표에는 오늘 선착장 당직자 이름이 적혀 있다. 은주.'],
  boat: ['정박한 배 살피기', '배에서는 두 줄의 계류 밧줄 사이로 물결 소리만 들린다. 무전 장치와 조타실 화면은 꺼져 있다.'],
};
const pierAnswers = {
  intercom: ['대합실 인터폰에 답하기', '당직자 은주가 대합실 인터폰을 들어 올린다.\n“순임 씨 아버님은 비가 오면 늘 이 자리에 계셨어요. 오늘은 제가 그 자리에서 들었어요.”\n은주가 방송실에 전해 달라며 수신 기록에 시각을 적는다. 00:04.'],
  tower: ['옥상 송신기에 답하기', '송신기 쪽 주파수에는 정적만 남아 있다. 그러는 동안 부두 가까이에서 의자 끄는 소리가 들린다.'],
  boat: ['정박한 배에 답하기', '선박 호출에는 답이 오지 않는다. 항구에 남은 목소리의 출처를 다시 살펴볼 수 있다.'],
};
const newPierRun = () => ({ heard: false, checked: [], answer: '', completed: false });

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

const storyEndings = {
  signal: {
    story: '마이크를 열어 건너편 윤서에게 답한다. 순임의 원본 이야기를 꺼내자 짧은 정적이 흐른다. 이 밤의 인터뷰 시간은 지나갔다. 다음 밤에는 무엇을 전할지 알게 됐다.',
    transcript: '“듣고 있어요. 여기도 한려 FM이에요.”\n“원본이 남아 있다면, 다음에는 순임 씨 목소리도 들려줘요.”',
    clip: 'signalRevealed',
  },
  both: {
    story: '순임의 목소리가 두 밤의 항구에 번진다. 건너편 윤서는 비어 있던 인터뷰 시간에 이제 처음으로 순임을 듣는다. 같은 방송을 들으며 두 윤서가 마지막 인사를 건넨다.',
    transcript: '“아버지, 저 돌아왔어요.”\n“이쪽에서도 이제 들려요. 순임 씨 목소리였군요.”',
    clip: 'bothRevealed',
  },
};

const endingFor = (id, revealed) => revealed && storyEndings[id] ? { ...endings[id], ...storyEndings[id] } : endings[id];

const transmissions = {
  voices: { start: '방송실 · 순임의 테이프', scene: '선착장 · 한려 FM 수신 중', art: './pier.webp', clip: 'pierSignoff',
    caption: '“아버지, 저 돌아왔어요.”\n[선착장에 짧은 기적 소리가 울린다.]' },
  signal: { start: '옥상 · 건너편으로 송신', scene: '건너편 송신실 · 윤서의 응답', art: './roof.webp',
    caption: '“듣고 있어요. 여기도 한려 FM이에요.”\n“그럼 이번 밤은 혼자 끝내지 않아도 되겠네요.”' },
  both: { start: '한려 FM · 두 주파수 연결', scene: '두 밤의 항구 · 동시 송출', art: './pier.webp',
    caption: '“아버지, 저 돌아왔어요.”\n“우리 쪽 항구에도 그 목소리가 닿았어요.”' },
};

const newRun = () => ({
  elapsed: 0, room: 'studio', phase: 'play', message: '', speaker: '', event: '', clip: '',
  tape: '', courier: false, dj: false, tuneAt: 0, linked: false, used: [], ending: '',
  review: false, console: '', consoleReady: false, syncMissed: false, log: [], routes: emptyRoutes(),
  receiverBand: 0, receiverTuned: false, courierBriefedEarly: false, courierByRadio: false, storyReply: false,
  intent: '',
  clockReviewed: false,
  onAirAt: 0,
});

function restoreGame(old) {
  const requested = new URLSearchParams(location.search).get('lang');
  const fresh = { version: 12, loop: 1, known: ['echo'], unlocked: [], sound: false, mix: { ...DEFAULT_MIX }, prologueSeen: false,
    storySolved: false, storyReplies: [], epilogueSeen: false,
    previousLoop: null, pier: newPierRun(),
    language: requested === 'en' ? 'en' : 'ko', hypothesis: '', matches: [], nextQuestion: '', run: newRun() };
  try {
    if (!old || !Array.isArray(old.known) || !Array.isArray(old.unlocked)) return fresh;
    fresh.known = [...new Set(['echo', ...old.known.filter((id) => Object.hasOwn(clues, id))])];
    fresh.unlocked = [...new Set(old.unlocked.filter((id) => Object.hasOwn(endings, id)))];
    fresh.storySolved = old.storySolved === true && mysteryEvidence.every((id) => fresh.known.includes(id));
    if (fresh.storySolved && Array.isArray(old.storyReplies)) {
      fresh.storyReplies = [...new Set(old.storyReplies.filter((id) => Object.hasOwn(storyEndings, id) && fresh.unlocked.includes(id)))];
    }
    fresh.epilogueSeen = fresh.unlocked.length === Object.keys(endings).length && old.epilogueSeen === true;
    fresh.loop = Number.isSafeInteger(old.loop) && old.loop > 0 ? old.loop : 1;
    const previousLoop = old.previousLoop;
    if (Number.isSafeInteger(previousLoop?.loop) && previousLoop.loop === fresh.loop - 1 && Array.isArray(previousLoop.moments)) {
      fresh.previousLoop = { loop: previousLoop.loop, intent: ['contact', 'connect'].includes(previousLoop.intent) ? previousLoop.intent : '', moments: previousLoop.moments.filter((moment) =>
        moment && Object.hasOwn(loopMarkers, moment.id) && Number.isInteger(moment.minute) && moment.minute > 0 && moment.minute <= LIMIT).slice(0, 2) };
    }
    if (fresh.epilogueSeen && old.pier) {
      const pier = fresh.pier;
      pier.heard = old.pier.heard === true;
      if (pier.heard && Array.isArray(old.pier.checked)) {
        pier.checked = [...new Set(old.pier.checked.filter((id) => Object.hasOwn(pierObservations, id)))].slice(0, 2);
      }
      if (pier.checked.length === 2 && Object.hasOwn(pierAnswers, old.pier.answer)) pier.answer = old.pier.answer;
      pier.completed = old.pier.completed === true || pier.answer === 'intercom';
    }
    fresh.sound = Boolean(old.sound);
    for (const layer of Object.keys(DEFAULT_MIX)) {
      const volume = old.mix?.[layer];
      if (Number.isFinite(volume)) fresh.mix[layer] = Math.min(100, Math.max(0, Math.round(volume)));
    }
    if (!requested && old.language === 'en') fresh.language = 'en';
    if (Object.hasOwn(hypotheses, old.hypothesis)) fresh.hypothesis = old.hypothesis;
    if (typeof old.nextQuestion === 'string') fresh.nextQuestion = old.nextQuestion;
    if (Array.isArray(old.matches)) fresh.matches = [...new Set(old.matches.filter((id) => ['bell', 'onAir'].includes(id)))];
    const previous = old.run;
    if (old.version >= 2 && previous && Object.hasOwn(rooms, previous.room)
      && Number.isInteger(previous.elapsed) && previous.elapsed >= 0 && previous.elapsed <= LIMIT
      && ['play', 'expired', 'ending'].includes(previous.phase) && Array.isArray(previous.used)
      && (previous.phase !== 'ending' || Object.hasOwn(endings, previous.ending))) {
      fresh.run = { ...newRun(), ...previous };
      if (!['contact', 'connect', 'mystery'].includes(fresh.run.intent)) fresh.run.intent = '';
      fresh.run.clockReviewed = previous.clockReviewed === true;
      if (!['voices', 'signal', 'both'].includes(fresh.run.console)) fresh.run.console = '';
      fresh.run.routes = emptyRoutes();
      if (previous.console === 'both') {
        for (const source of Object.keys(routeSources)) {
          const destination = previous.routes?.[source];
          if (previous.consoleReady === true) fresh.run.routes[source] = correctRoutes[source];
          else if (Object.hasOwn(routeDestinations, destination)) fresh.run.routes[source] = destination;
        }
      }
      if (!Number.isInteger(fresh.run.receiverBand) || !receiverBands[fresh.run.receiverBand]) fresh.run.receiverBand = 0;
      fresh.run.receiverTuned = previous.receiverTuned === true || fresh.run.receiverBand !== 0;
      if (!Array.isArray(fresh.run.log)) fresh.run.log = [];
      if (old.version === 2 && previous.phase === 'play') {
        fresh.run.message = '진행 중인 밤을 이어받았습니다. 옥상 교신은 수첩의 두 시계에서 예약할 수 있습니다.';
        fresh.run.speaker = '';
        fresh.run.event = '';
        fresh.run.clip = '';
      }
      if (previous.phase === 'ending') {
        const finalAction = fresh.run.log.findLast((entry) => entry?.kind === 'action');
        const minute = previous.onAirAt || finalAction?.minute;
        fresh.run.onAirAt = Number.isInteger(minute) && minute > 0 ? Math.min(minute, LIMIT - 1) : LIMIT - 1;
        fresh.run.storyReply = previous.storyReply === true && fresh.storyReplies.includes(previous.ending);
        const ending = endingFor(previous.ending, fresh.run.storyReply);
        fresh.run.clip = ending.clip;
        fresh.run.message = ending.story;
      }
    }
    if (!old.version && previous?.elapsed > 0) {
      fresh.run.message = '새로운 방송 회차가 시작됩니다. 이전 단서와 결말 기록을 이어받았습니다.';
    }
    fresh.prologueSeen = old.prologueSeen === true || fresh.loop > 1 || fresh.run.elapsed > 0
      || fresh.known.length > 1 || fresh.unlocked.length > 0;
  } catch { /* A blocked or unavailable save store still allows this session to play. */ }
  return fresh;
}

function loadGame() {
  try { return restoreGame(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch { return restoreGame(null); }
}

const game = loadGame();
let transmission = null;
let prologue = null;
let hintState = { topic: '', level: 0, open: false };
const $ = (id) => document.getElementById(id);
const t = (value) => game.language === 'en'
  ? value.split('\n').map((line) => GAME_EN[line] ?? line).join('\n') : value;
const fmt = (value, ...args) => t(value).replace(/\{(\d+)\}/g, (_, index) => args[index]);
const knows = (id) => game.known.includes(id);
const learn = (id) => { if (!knows(id)) game.known.push(id); };
const time = (elapsed) => elapsed === LIMIT ? '00:00' : '23:' + (52 + elapsed);
const cartHere = (elapsed) => elapsed >= CART_ARRIVES && elapsed < CART_LEAVES;
const epilogueUnlocked = () => game.unlocked.length === Object.keys(endings).length;
const pierUnlocked = () => game.epilogueSeen && epilogueUnlocked();
const needsMystery = () => knows('remoteRequest') && !game.storySolved;

function reservationPlan() {
  const r = game.run;
  const proposed = game.matches.length ? hypotheses[game.hypothesis]?.local ?? 0 : 0;
  const actual = r.tuneAt;
  const pending = actual > r.elapsed;
  const canApply = r.phase === 'play' && !r.review && !r.console
    && (!actual || pending) && proposed > r.elapsed && proposed !== actual;
  return { proposed, actual, pending, canApply };
}

function latestFailedReservation() {
  const r = game.run;
  if (r.tuneAt && !r.linked && r.elapsed >= r.tuneAt) return r.tuneAt;
  return r.tuneAt ? 0 : game.previousLoop?.moments.find(({ id }) => id === 'contactMissed')?.minute ?? 0;
}

function failedReservationMinute() {
  const failed = latestFailedReservation();
  const r = game.run;
  return r.tuneAt || !r.clockReviewed || reservationPlan().proposed === failed ? failed : 0;
}

function clockRetryIntent() {
  if (game.run.intent === 'connect' || game.previousLoop?.intent === 'connect') return 'connect';
  if (game.run.intent === 'contact' || game.previousLoop?.intent === 'contact') return 'contact';
  return knows('routing') && game.unlocked.includes('signal') && !game.unlocked.includes('both') ? 'connect' : 'contact';
}

const canRadioCourier = () => knows('staffCall') && knows('label');

function connectionRoute() {
  const r = game.run;
  const plan = reservationPlan();
  if (r.intent !== 'connect' || r.linked || !knows('routing') || !knows('label') || !plan.proposed) return null;
  const steps = [];
  let room = r.room;
  const move = (target) => {
    if (room === target) return;
    steps.push({ id: `plan-${target}`, room: target });
    room = target;
  };
  const radio = canRadioCourier();
  const canAskHere = room === 'hall' && !radio && !r.courier;
  if (canAskHere) steps.push({ id: 'assign-courier' });
  if (!r.dj) {
    move('studio');
    steps.push({ id: 'assign-dj' });
  }
  if (!r.courier && !canAskHere) {
    move(radio ? 'studio' : 'hall');
    steps.push({ id: radio ? 'radio-courier' : 'assign-courier' });
  }
  if (!plan.actual || plan.canApply) {
    move('roof');
    steps.push({ id: 'reserve-relay' });
  } else if (room !== 'roof' && room !== 'studio') move('roof');
  return { next: steps[0], feasible: r.elapsed + steps.length <= REPLY_WINDOW };
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    return true;
  } catch { return false; }
}

let soundContext;
let speaking;
let voiceId = '';
let heardCallRun;
let playback = 0;
let activeExchangeLine = -1;
let audioLevels;
let ambience;
const recordings = new Map();
const effects = new Set();
const ambienceBuffers = new Map();
const ambienceProfiles = {
  studio: { noise: .12, smooth: .04, hum: .075, frequency: 120, swell: .16 },
  hall: { noise: .25, smooth: .30, hum: 0, frequency: 1, swell: .18 },
  archive: { noise: .15, smooth: .13, hum: .04, frequency: 60, swell: .21 },
  roof: { noise: .32, smooth: .09, hum: .015, frequency: 155, swell: .65 },
  pier: { noise: .23, smooth: .12, hum: .014, frequency: 55, swell: .55 },
};

function audioContext() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  if (!soundContext) {
    soundContext = new Audio();
    audioLevels = Object.fromEntries(Object.keys(DEFAULT_MIX).map((layer) => {
      const gain = soundContext.createGain();
      gain.gain.value = game.mix[layer] / 100;
      gain.connect(soundContext.destination);
      return [layer, gain];
    }));
  }
  if (soundContext.state === 'suspended') soundContext.resume().catch(() => {});
  return soundContext;
}

function applyMix() {
  if (!soundContext) return;
  for (const [layer, node] of Object.entries(audioLevels)) {
    const foreground = (speaking && game.mix.speech) || (effects.size && game.mix.effects);
    const duck = layer === 'ambience' && foreground ? .22 : 1;
    const volume = game.mix[layer] / 100 * duck;
    node.gain.setTargetAtTime(volume, soundContext.currentTime, .035);
  }
}

function stopClip() {
  playback += 1;
  const previous = speaking;
  speaking = null;
  voiceId = '';
  if (previous) {
    try { previous.stop(); } catch { /* An unavailable audio node must not block play. */ }
  }
  if (activeExchangeLine !== -1) setExchangeLine(-1);
  applyMix();
}

function recording(context, id) {
  if (!recordings.has(id)) {
    recordings.set(id, fetch(voices[id]).then((response) => {
      if (!response.ok) throw new Error('Audio unavailable');
      return response.arrayBuffer();
    }).then((bytes) => context.decodeAudioData(bytes)).catch((error) => {
      recordings.delete(id);
      throw error;
    }));
  }
  return recordings.get(id);
}

async function playClip(id, startAt = null, exchangeIndex = -1) {
  let thisPlayback;
  const next = exchangeIndex === 0 ? exchangeLines[1].clip : '';
  const continueExchange = () => {
    if (next && thisPlayback === playback && hadRadioExchange() && !transmission) playClip(next, null, 1);
  };
  try {
    if (document.hidden) return;
    const context = audioContext();
    if (!context || !voices[id]) return false;
    stopClip();
    thisPlayback = playback;
    voiceId = id;
    const audio = recording(context, id);
    if (next) recording(context, next).catch(() => {});
    const buffer = await audio;
    if (thisPlayback !== playback || document.hidden) return;
    const offset = startAt ? startAt() : 0;
    if (offset >= buffer.duration) {
      voiceId = '';
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(audioLevels.speech);
    speaking = source;
    source.onended = () => {
      source.disconnect();
      if (speaking === source) {
        speaking = null;
        voiceId = '';
        if (id === 'callWithQuestion' && game.mix.speech > 0 && context.state === 'running') heardCallRun = game.run;
        if (exchangeIndex >= 0) setExchangeLine(-1);
        applyMix();
      }
      continueExchange();
    };
    applyMix();
    source.start(0, offset);
    if (exchangeIndex >= 0) setExchangeLine(exchangeIndex);
    return true;
  } catch {
    if (thisPlayback === playback) voiceId = '';
    continueExchange();
    return false;
  }
}

function playEffect(id) {
  if (!game.sound || document.hidden || !game.mix.effects) return;
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
      level.connect(audioLevels.effects);
      effects.add(note);
      note.onended = () => {
        effects.delete(note);
        note.disconnect();
        level.disconnect();
        applyMix();
      };
      note.start(at);
      note.stop(at + .31);
    });
    if (id === 'bell' && game.run.room === 'hall') {
      const wheels = context.createBufferSource();
      const sample = context.createBuffer(1, 12000, 16000);
      const samples = sample.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1) {
        const phase = i / samples.length;
        const envelope = Math.sin(Math.PI * phase) * (.45 + .55 * Math.sin(phase * Math.PI * 5) ** 2);
        samples[i] = envelope * (.025 * Math.sin(i * .039) + .035 * (Math.random() * 2 - 1));
      }
      wheels.buffer = sample;
      wheels.connect(audioLevels.effects);
      effects.add(wheels);
      wheels.onended = () => {
        effects.delete(wheels);
        wheels.disconnect();
        applyMix();
      };
      wheels.start(context.currentTime + .46);
    }
    applyMix();
  } catch { /* Audio never controls access to clues. */ }
}

function stopSceneAudio() {
  stopClip();
  for (const effect of effects) {
    try { effect.stop(); } catch { /* An effect may already have ended. */ }
  }
  effects.clear();
  applyMix();
}

function ambienceBuffer(context, room) {
  if (ambienceBuffers.has(room)) return ambienceBuffers.get(room);
  const profile = ambienceProfiles[room];
  const rate = 16000;
  const seconds = 4;
  const buffer = context.createBuffer(1, rate * seconds, rate);
  const samples = buffer.getChannelData(0);
  let seed = 73;
  let smooth = 0;
  for (let i = 0; i < samples.length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const t = i / rate;
    smooth += (seed / 2147483648 - 1 - smooth) * profile.smooth;
    const gust = 1 - profile.swell / 2 + Math.sin(2 * Math.PI * t / seconds) * profile.swell / 2;
    const edge = Math.min(t / .05, (seconds - t) / .05, 1);
    samples[i] = edge * (smooth * profile.noise * gust + Math.sin(2 * Math.PI * profile.frequency * t) * profile.hum);
  }
  ambienceBuffers.set(room, buffer);
  return buffer;
}

function stopAmbience() {
  if (!ambience) return;
  const { source } = ambience;
  ambience = null;
  try { source.stop(); } catch { /* An unavailable audio node must not block play. */ }
}

function syncAmbience() {
  const r = game.run;
  const blockingDialog = document.querySelector('dialog[open]:not(#settings):not(#pier):not(#places-dialog)');
  const room = $('pier').open ? 'pier' : r.phase === 'play' && !r.review && r.room;
  const next = game.sound && game.mix.ambience > 0 && !document.hidden && !blockingDialog ? room : '';
  if (!next) { stopAmbience(); return; }
  const context = audioContext();
  if (!context || ambience?.room === next) return;
  stopAmbience();
  const source = context.createBufferSource();
  source.buffer = ambienceBuffer(context, next);
  source.loop = true;
  source.connect(audioLevels.ambience);
  source.onended = () => source.disconnect();
  source.start();
  ambience = { room: next, source };
}

function showGameDialog(id) {
  stopSceneAudio();
  $(id).showModal();
  syncAmbience();
}

const prologueShots = [[0, 'dark'], [620, 'harbor'], [5050, 'pier'], [7550, 'studio'], [11000, 'title'], [16000, 'receiver']];
const prologueCaptions = [
  [0, '[낮은 뱃고동]'],
  [850, '여기는 한려 FM입니다.\n자정을 기해 정규 방송을 마칩니다.'],
  [5150, '오늘 마지막 순서는 주민들의 목소리입니다.\n아직 한 편의 이야기가 남았습니다.'],
  [11000, ''],
  [16100, '[꺼진 수신기에서 짧은 잡음]'],
];

function prologueElapsed() {
  return prologue.elapsed + (prologue.startedAt === null ? 0 : performance.now() - prologue.startedAt);
}

function paintPrologue(elapsed) {
  const shot = prologueShots.findLast(([start]) => start <= elapsed)[1];
  const dialog = $('prologue');
  if (dialog.dataset.shot !== shot) {
    dialog.dataset.shot = shot;
    $('prologue-title').hidden = shot !== 'title';
  }
  const caption = t(prologueCaptions.findLast(([start]) => start <= elapsed)[1]);
  if ($('prologue-caption').textContent !== caption) $('prologue-caption').textContent = caption;
  $('prologue-progress').style.transform = `scaleX(${Math.min(elapsed / PROLOGUE_LENGTH, 1)})`;
}

function renderSoundControls() {
  const label = t(game.sound ? '소리 켬' : '소리 끔');
  for (const id of ['sound', 'prologue-sound']) {
    $(id).setAttribute('aria-pressed', String(game.sound));
    $(id).textContent = label;
  }
  $('receiver-audio-status').textContent = label;
}

function playPrologueSound() {
  if (!game.sound || !prologue || prologue.startedAt === null) return;
  playClip('prologue', () => prologueElapsed() / 1000);
}

function tickPrologue() {
  if (!prologue || prologue.startedAt === null) return;
  const elapsed = prologueElapsed();
  if (elapsed >= PROLOGUE_LENGTH) { finishPrologue(true); return; }
  paintPrologue(elapsed);
  prologue.frame = requestAnimationFrame(tickPrologue);
}

function pausePrologue() {
  if (!prologue || prologue.startedAt === null) return;
  prologue.elapsed = prologueElapsed();
  prologue.startedAt = null;
  cancelAnimationFrame(prologue.frame);
  stopClip();
}

function resumePrologue() {
  if (!prologue || prologue.startedAt !== null || document.hidden) return;
  prologue.startedAt = performance.now();
  playPrologueSound();
  tickPrologue();
}

function openingReceiverHere() {
  const r = game.run;
  return r.phase === 'play' && r.room === 'studio' && r.elapsed === 0 && !r.review && !r.console;
}

function animateReceiverHandoff(from) {
  const sceneImage = $('scene-image');
  const to = sceneImage.getBoundingClientRect();
  if (!sceneImage.animate || !to.width || !to.height) return;
  const cut = document.createElement('img');
  cut.src = sceneImage.src;
  cut.alt = '';
  cut.className = 'receiver-handoff';
  cut.setAttribute('aria-hidden', 'true');
  const frame = ({ left, top, width, height }, opacity) => ({
    left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, opacity,
  });
  document.body.append(cut);
  const motion = cut.animate([frame(from, 1), frame(to, 0)], { duration: 340, easing: 'cubic-bezier(.2,.75,.35,1)', fill: 'both' });
  motion.finished.then(() => cut.remove(), () => cut.remove());
}

function finishPrologue(completed = false) {
  if (!prologue) return;
  const atReceiver = openingReceiverHere();
  const continueVoice = atReceiver && game.sound;
  const from = completed && atReceiver && !matchMedia('(prefers-reduced-motion: reduce)').matches
    ? $('prologue').querySelector('[data-prologue-image="receiver"]').getBoundingClientRect() : null;
  pausePrologue();
  prologue = null;
  game.prologueSeen = true;
  save();
  $('prologue').close();
  document.body.classList.remove('prologue-active');
  if (from) animateReceiverHandoff(from);
  $(atReceiver ? 'receiver-dial' : 'narration').focus({ preventScroll: true });
  if (continueVoice) {
    if (game.run.receiverTuned) listenToBand();
    else playClip('openingEcho');
  }
}

function startPrologue(replay = false) {
  if (prologue || transmission) return;
  for (const art of $('prologue').querySelectorAll('[data-src]')) {
    if (!art.hasAttribute('src')) art.src = art.dataset.src;
  }
  prologue = { elapsed: 0, startedAt: null, frame: 0 };
  $('prologue-start').textContent = t(replay ? '본편으로 돌아가기' : '바로 시작');
  $('prologue-title').hidden = true;
  paintPrologue(0);
  renderSoundControls();
  showGameDialog('prologue');
  document.body.classList.add('prologue-active');
  resumePrologue();
}

function drawSignal(node, levels) {
  node.replaceChildren(...levels.map((level) => {
    const bar = element('i');
    bar.style.setProperty('--level', `${level}%`);
    return bar;
  }));
}

function renderReceiver() {
  const r = game.run;
  const panel = $('receiver');
  const visible = openingReceiverHere();
  $('entry-controls').hidden = !visible;
  $('receiver-replay').hidden = !visible || r.receiverBand !== 2;
  if (!visible) return;
  const band = receiverBands[r.receiverBand];
  const dial = $('receiver-dial');
  dial.value = r.receiverBand;
  dial.setAttribute('aria-valuetext', t(band.label));
  panel.dataset.locked = String(r.receiverBand === 2);
  $('receiver-lock').textContent = t(r.receiverTuned ? band.state : opening[1].speaker);
  $('receiver-caption').textContent = t(r.receiverTuned ? band.caption : opening[1].text);
  drawSignal($('receiver-wave'), band.wave);
}

function listenToBand() {
  if (!game.sound) return;
  playClip(['receiverStatic', 'receiverStaff', 'receiverEcho'][game.run.receiverBand]);
}

function tuneReceiver() {
  if (!openingReceiverHere()) return;
  stopClip();
  const band = Number($('receiver-dial').value);
  game.run.receiverBand = band;
  game.run.receiverTuned = true;
  if (band === 1 && !knows('staffCall')) {
    learn('staffCall');
    observe('직원 무전에서 재호의 호출 문구를 확인했다.');
  }
  if (band === 2 && !knows('receiver')) {
    learn('receiver');
    observe('탁상 수신기에서 두 번의 종소리와 건너편 윤서의 목소리를 들었다.');
  }
  $('journal-count').textContent = game.known.length;
  save();
  renderReceiver();
  listenToBand();
}

function onMinute() {
  const r = game.run;
  let cue = '';
  const events = [];
  if (r.elapsed === CART_ARRIVES) {
    learn('bell');
    events.push(cartArrived);
    if (r.room === 'hall' && knows('receiver')) events.push('탁상 수신기에서 잡은 소리와 같다.');
    cue = 'bell';
  }
  if (r.elapsed === ON_AIR) {
    learn('onAir');
    events.push('방송실의 붉은 불이 켜진다. 윤서 “비 오는 항구의 밤입니다.”');
    r.clip = 'onAir';
  }
  if (r.elapsed === CART_LEAVES) {
    learn('departure');
    if (r.courier) {
      r.tape = 'delivered';
      if (r.courierBriefedEarly) events.push('재호가 파란 스티커가 붙은 상자에서 원본을 꺼내 윤서의 콘솔 위에 놓는다.');
      if (r.courierByRadio) events.push('무전으로 부탁한 원본이 윤서의 콘솔에 도착했다.');
      events.push(tapeDelivered);
      r.clip = 'delivery';
    } else {
      events.push(cartDeparted);
    }
  }
  if (r.tuneAt === r.elapsed) {
    r.linked = r.elapsed === REPLY_WINDOW;
    events.push(r.linked ? contactOpened : contactMissed);
    if (r.linked) {
      learn('remoteRequest');
      events.push(callWords, callQuestion);
      r.clip ||= 'callWithQuestion';
    }
  }
  if (r.elapsed === REPLY_WINDOW + 1 && r.linked && r.dj && r.tape === 'delivered' && !r.consoleReady) {
    r.syncMissed = true;
    events.push(syncMissed);
  }
  if (r.elapsed === LIMIT) {
    r.phase = 'expired';
    events.push('송출 종료. 붉은 불이 꺼지고 모든 주파수가 조용해진다.');
  }
  r.event = events.join('\n');
  events.forEach((event) => observe(event));
  return cue;
}

function observe(text, kind = 'event', args = []) {
  game.run.log.push({ minute: game.run.elapsed, text, kind, args });
}

function step(message, speaker = '', action = '', args = [], logResult = false) {
  const r = game.run;
  stopRewindCut();
  const sendingCue = r.console === 'both' && r.consoleReady && r.elapsed === REPLY_WINDOW;
  if (!sendingCue) stopSceneAudio();
  r.message = message;
  r.speaker = speaker;
  r.event = '';
  r.clip = '';
  r.elapsed += 1;
  if (action) observe(action, 'action', args);
  if (logResult) observe(message);
  return onMinute();
}

function enter(id) {
  const r = game.run;
  if (r.phase !== 'play' || r.room === id) return;
  r.room = id;
  const cue = step(rooms[id].arrival, '', '이동 · {0}', [id]);
  if (id === 'hall' && r.elapsed >= CART_LEAVES && !r.tape) learn('departure');
  update(cue, true);
}

function renderPlaces(id, travel, inSheet = false) {
  $(id).replaceChildren(...Object.entries(rooms).map(([roomId, room]) => {
    const current = game.run.room === roomId;
    const button = element('button', '', 'place');
    button.append(element('span', room.name), element('small', current ? '현재 위치' : inSheet ? fmt('{0} · 1행동', t(room.floor)) : room.floor));
    button.type = 'button';
    button.disabled = current;
    button.dataset.room = roomId;
    if (current) button.setAttribute('aria-current', 'location');
    button.addEventListener('click', () => travel(roomId));
    return button;
  }));
}

let placeChoice = '';
let placeScroll;

function openPlaces() {
  if ($('locations').hidden || $('places-dialog').open) return;
  const main = document.querySelector('main');
  placeScroll = { main: main.scrollTop, page: window.scrollY };
  renderPlaces('sheet-places', (id) => {
    placeChoice = id;
    $('places-dialog').close();
  }, true);
  $('places-dialog').showModal();
}

function finish(id, lead = {}) {
  if (!game.unlocked.includes(id)) game.unlocked.push(id);
  const storyReply = game.storySolved && Object.hasOwn(storyEndings, id);
  if (storyReply && !game.storyReplies.includes(id)) game.storyReplies.push(id);
  const ending = endingFor(id, storyReply);
  const onAirAt = Math.min(game.run.elapsed, LIMIT - 1);
  Object.assign(game.run, {
    ending: id, storyReply, onAirAt, elapsed: LIMIT, phase: 'ending', message: ending.story, speaker: '', event: '', clip: ending.clip,
  });
  observe(ending.transcript);
  save();
  startTransmission(lead);
}

function transmissionClip() {
  const r = game.run;
  return transmissions[r.ending].clip || endingFor(r.ending, r.storyReply).clip;
}

function renderTransmission() {
  const stage = $('transmission');
  stage.hidden = !transmission;
  $('narration').hidden = Boolean(transmission);
  if (!transmission) return;
  const { id, cut, recall } = transmission;
  const scene = transmissions[id];
  const image = $('transmission-image');
  const art = cut ? scene.art : id === 'signal' ? rooms.roof.art : rooms.studio.art;
  if (image.getAttribute('src') !== art) image.setAttribute('src', art);
  stage.dataset.mode = id;
  stage.dataset.cut = String(cut);
  stage.dataset.recall = String(Boolean(recall));
  $('transmission-title').textContent = t(recall ? '건너편 윤서의 마지막 호출' : cut ? scene.scene : scene.start);
  const caption = game.run.storyReply ? storyEndings[id].transcript : scene.caption;
  $('transmission-caption').textContent = t(recall ? callQuestion : cut ? caption : '마지막 송출을 시작합니다.');
}

function closeTransmission(stopAudio = false) {
  if (!transmission) return;
  clearTimeout(transmission.cutTimer);
  clearTimeout(transmission.endTimer);
  clearTimeout(transmission.callTimer);
  const restoreFocus = $('transmission').contains(document.activeElement);
  transmission = null;
  if (stopAudio) stopClip();
  render();
  if (restoreFocus) $('recap').focus({ preventScroll: true });
  scrollGameToStart();
}

function playTransmissionVoice() {
  const sequence = transmission;
  if (!sequence.recall) {
    playClip(transmissionClip());
    return;
  }
  playClip('callWithQuestion', () => CALL_QUESTION_START).then((played) => {
    if (!played || transmission !== sequence || !sequence.recall) return;
    clearTimeout(sequence.callTimer);
    sequence.callTimer = setTimeout(beginFinalBroadcast, CALL_LEAD_LENGTH);
  });
}

function beginFinalBroadcast() {
  const sequence = transmission;
  sequence.recall = false;
  sequence.cut = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!sequence.cut) {
    new Image().src = transmissions[sequence.id].art;
    sequence.cutTimer = setTimeout(() => {
      sequence.cut = true;
      renderTransmission();
    }, TRANSMISSION_CUT);
  }
  sequence.endTimer = setTimeout(closeTransmission, TRANSMISSION_LENGTH);
  renderTransmission();
  if (game.sound) playTransmissionVoice();
  else stopClip();
}

function startTransmission({ recall = false, audible = false } = {}) {
  if (transmission || game.run.phase !== 'ending') return;
  stopSceneAudio();
  syncAmbience();
  transmission = { id: game.run.ending, cut: false, recall };
  render();
  $('transmission-title').focus({ preventScroll: true });
  $('transmission-title').scrollIntoView({ block: 'nearest' });
  if (recall) {
    transmission.callTimer = setTimeout(beginFinalBroadcast, CALL_LEAD_LENGTH);
    if (audible) playTransmissionVoice();
  } else beginFinalBroadcast();
}

function reviewNight() {
  if (!game.run.elapsed || transmission) return;
  if (game.run.phase === 'play' && !game.run.console && !game.run.review) {
    game.run.review = true;
    stopSceneAudio();
    update();
  }
  $('recap').scrollIntoView({ block: 'start' });
  $('recap').focus({ preventScroll: true });
}

function loopMoments(run) {
  const byTopic = {};
  for (const entry of run.log) {
    const id = markerByEvent.get(entry?.text);
    if (!id || !Number.isInteger(entry.minute) || entry.minute < 1 || entry.minute > LIMIT) continue;
    byTopic[loopMarkers[id][2]] = { id, minute: entry.minute };
  }
  if (byTopic.tape?.id === 'tapeDelivered' && byTopic.contact?.id === 'contactOpened'
    && byTopic.tape.minute === byTopic.contact.minute) {
    byTopic.contact = { id: 'exchange', minute: byTopic.tape.minute };
    delete byTopic.tape;
  }
  const meaningful = [byTopic.tape, byTopic.contact].filter(Boolean);
  if (run.phase === 'ending' && Object.hasOwn(endings, run.ending)) meaningful.push({ id: run.ending, minute: LIMIT });
  const fallback = byTopic.movement || byTopic.fallback;
  return (meaningful.length ? meaningful : [fallback].filter(Boolean)).sort((a, b) => a.minute - b.minute).slice(-2);
}

let rewindTimer;

function stopRewindCut() {
  clearTimeout(rewindTimer);
  $('rewind-cut').hidden = true;
}

function animateRewind(from) {
  stopRewindCut();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cut = $('rewind-cut');
  let minute = from;
  function tick() {
    $('rewind-clock').textContent = time(minute);
    cut.dataset.departing = String(minute === from);
    if (minute > 0) {
      minute -= 1;
      rewindTimer = setTimeout(tick, minute === from - 1 ? 180 : 85);
    } else {
      rewindTimer = setTimeout(stopRewindCut, 280);
    }
  }
  tick();
  cut.hidden = false;
}

function rewind(nextIntent) {
  if (!game.run.elapsed) return;
  const run = game.run;
  const from = run.elapsed;
  stopSceneAudio();
  stopAmbience();
  game.nextQuestion = reviewQuestion();
  const intent = run.intent === 'connect' || (run.dj && run.courier) ? 'connect' : run.intent === 'contact' ? 'contact' : '';
  game.previousLoop = { loop: game.loop, intent, moments: loopMoments(run) };
  game.loop += 1;
  game.run = newRun();
  if (nextIntent === 'mystery') game.run.intent = 'mystery';
  $('recap-details').open = false;
  $('action-history').open = false;
  update('rewind');
  animateRewind(from);
}

function hadRadioExchange() {
  return game.run.elapsed >= REPLY_WINDOW && game.run.tape === 'delivered' && game.run.linked;
}

function hasRadioExchange() {
  const r = game.run;
  return hadRadioExchange() && r.phase === 'play' && !r.review &&
    (r.elapsed === REPLY_WINDOW || (r.console === 'both' && r.consoleReady));
}

function hasLiveCall() {
  const r = game.run;
  return r.phase === 'play' && !r.review && r.linked;
}

function scrollGameToStart() {
  document.querySelector('main').scrollTop = 0;
  window.scrollTo(0, 0);
}

function replayExchange() {
  if (hadRadioExchange() && !transmission) playClip(exchangeLines[0].clip, null, 0);
}

function playSceneVoice() {
  if (hasRadioExchange()) replayExchange();
  else if (game.run.clip) playClip(game.run.clip);
}

function update(cue = '', playSceneClip = false) {
  save();
  render();
  syncAmbience();
  if (cue) playEffect(cue);
  if (playSceneClip && game.sound && game.run.clip) playSceneVoice();
  const lead = document.querySelector('#opening-action button, #featured-action button, #console-action button');
  (lead && !lead.disabled ? lead : $('narration')).focus({ preventScroll: true });
  if (game.run.phase !== 'play' || game.run.elapsed === 0 || (hasLiveCall() && lead)) {
    scrollGameToStart();
    return;
  }
  if (lead) {
    revealAction(lead);
    return;
  }
  const top = $('narration').getBoundingClientRect().top;
  const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
  if (top < Math.max(0, hudBottom) || top > window.innerHeight - 120) {
    $('narration').scrollIntoView({ block: 'nearest' });
  }
}

function openConsole(mode) {
  if (!hasRadioExchange()) stopSceneAudio();
  game.run.console = mode;
  game.run.consoleReady = false;
  game.run.routes = emptyRoutes();
  update();
  if (mode === 'both') $('routing-title').focus({ preventScroll: true });
  else focusConsoleControl();
}

function revealAction(control) {
  const { top, bottom } = control.getBoundingClientRect();
  const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
  const quick = $('quick');
  const limit = quick.getBoundingClientRect().height ? quick.getBoundingClientRect().top : window.innerHeight;
  if (top < hudBottom || bottom > limit) control.scrollIntoView({ block: 'center' });
}

function focusConsoleControl(control = $('console-action').querySelector('button')) {
  if (!hasLiveCall()) revealAction(control);
  control.focus({ preventScroll: true });
}

function consoleActions() {
  const r = game.run;
  const actions = [];
  if (r.console === 'both' && !r.consoleReady) {
    actions.push({ id: 'send-cue', title: '동시 송출 신호 보내기', detail: cueDetail(), cost: '1행동', primary: true,
      disabled: !routesReady(r.routes), run: () => {
      if (!routesReady(r.routes) || r.phase !== 'play' || r.consoleReady || r.elapsed !== REPLY_WINDOW) return;
      r.consoleReady = true;
      update(step('두 레벨 미터가 동시에 움직인다. 윤서가 원본 위에 손을 얹고 송출 신호를 기다린다.', '', '동시 송출 신호 보내기'), true);
      focusConsoleControl();
    } });
  } else {
    const control = {
      voices: ['테이프 재생하기', '재생기를 돌려 주민 인터뷰를 송출합니다.', '재생 버튼이 내려간다. 테이프가 돌아가고 첫 목소리가 전파를 탄다.'],
      signal: ['마이크 열기', '건너편 윤서에게 당신의 목소리를 보냅니다.', '마이크에 붉은 불이 켜진다. 건너편의 잡음이 잦아든다.'],
      both: ['마이크 열고 함께 송출', '연결된 두 채널로 목소리와 인터뷰를 보냅니다.', '옥상의 마이크가 켜지고 방송실의 테이프가 동시에 돌아간다.'],
    }[r.console];
    actions.push({ id: 'finish-broadcast', title: control[0], detail: control[1], cost: '1행동', primary: true, run: () => {
      const recall = r.console !== 'voices' && r.linked && heardCallRun !== r;
      const audible = game.sound || voiceId === 'delivery' || voiceId === 'callWithQuestion';
      step(control[2], '', control[0]);
      finish(r.console, { recall, audible });
    } });
  }
  if (!r.consoleReady) {
    actions.push({ title: '돌아가기', detail: '송출 선택을 다시 고릅니다.', cost: '시간 유지', run: () => {
      r.console = '';
      r.routes = emptyRoutes();
      update();
    } });
  }
  return actions;
}

function cueDetail() {
  return routesReady(game.run.routes) ? '23:57에 지금 연결한 두 채널로 신호를 보냅니다.' : '두 송출선을 연결하면 신호를 보낼 수 있습니다.';
}

function reserveRelay() {
  const r = game.run;
  const plan = reservationPlan();
  if (r.room !== 'roof' || !plan.canApply) return;
  r.tuneAt = plan.proposed;
  update(step(plan.pending ? '송신기의 실제 예약을 바꿨다.' : '채널을 예약했다. 송신기가 그 시각에 건너편 주파수를 찾는다.',
    '', plan.pending ? '교신 예약 변경 · {0} → {1}' : '교신 예약 확정 · {0}',
    plan.pending ? [time(plan.actual), time(plan.proposed)] : [time(plan.proposed)]), true);
}

const waitAction = '1분 기다리기';
const waitMessage = '시계의 분침이 한 칸 움직인다.';

function nextReservationEvent() {
  const r = game.run;
  if (r.room !== 'roof' || r.tuneAt <= r.elapsed) return 0;
  return Math.min(...[CART_ARRIVES, ON_AIR, CART_LEAVES, r.tuneAt, LIMIT].filter((minute) => minute > r.elapsed));
}

function waitUntilEvent() {
  const minute = nextReservationEvent();
  let cue = '';
  while (game.run.elapsed < minute) cue = step(waitMessage, '', waitAction);
  update(cue, true);
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
      update(step(message, speaker, title, [], Boolean(clue || speaker)), true);
    }, primary);
  };
  const finalChoice = (id, title, detail, primary) =>
    offer(id, title, detail, () => openConsole(id), primary, '콘솔 열기');
  const canJoin = r.dj && r.tape === 'delivered' && r.linked && r.elapsed === REPLY_WINDOW;
  const joinDetail = '23:57에 신호를 보내세요. 마지막 송출까지 2행동이 필요합니다.';
  const directReply = r.syncMissed && r.linked && r.room !== 'roof' && r.elapsed < LIMIT - 1;
  const failed = failedReservationMinute();
  if (failed) offer('recheck-clock', '수첩에서 시차 다시 비교', fmt('지난 {0} 예약을 종소리 기록과 비교합니다.', time(failed)), openClockReview, true, '시간 유지');
  const route = connectionRoute();
  if (route?.feasible && route.next?.room) {
    const titles = { hall: '복도로 이동해 재호 찾기', studio: '역할을 나누러 방송실로', roof: '예약하러 옥상 송신실로' };
    const { id, room } = route.next;
    offer(id, titles[room], '', () => enter(room), true);
  }
  if (route && !route.feasible) {
    const next = canRadioCourier() ? '연결표 확보. 다음 회차에는 무전으로 재호에게 원본을 맡기세요.'
      : '연결표 확보. 다음 회차에는 윤서에게 방송실을 먼저 맡기세요.';
    offer('prepare-rewind', '다음 회차 준비하기', next, reviewNight, true, '시간 유지');
  }
  if (r.intent === 'mystery' && needsMystery() && knows('remoteSlot')) {
    offer('review-mystery', '편성표와 호출 대조하기', '두 단서를 수첩에서 나란히 확인합니다.', openMystery, true, '시간 유지');
  }
  if (r.intent === 'mystery' && game.storySolved && r.room !== 'roof' && r.elapsed < REPLY_WINDOW - 1) {
    offer('hear-reply-roof', '달라진 응답을 들으러 옥상으로', '옥상에서 건너편 교신을 예약합니다.', () => {
      r.intent = 'contact';
      enter('roof');
    }, true);
  }

  if (r.room === 'studio') {
    if (r.elapsed === 1 && route?.next?.id !== 'plan-hall') {
      offer('go-hall', '복도로 가서 수레 확인', '운반 상자에 원본이 섞였을지도 모릅니다.', () => enter('hall'), true);
    }
    scene('ask-dj', '윤서에게 목소리 확인', '눈앞의 윤서도 방금 그 소리를 들었을까요?', 'rundown',
      '“저도 들었어요. 여기선 아직 순임 씨의 인터뷰 순서가 남았어요. 아버지가 기다리던 부두에 자기 목소리를 전하고 싶대요.”', '윤서');
    if (knows('routing')) {
      scene('assign-dj', '윤서에게 방송실 맡기기', '테이프가 도착하면 보내 줄 사람이 필요합니다.', null,
        '“좋아요. 원본이 들어오면 제가 준비해 둘게요. 당신이 옥상에서 신호를 주면 돼요.”', '윤서', r.elapsed === 0 && game.loop > 1,
        () => { r.dj = true; });
    }
    if (canRadioCourier() && r.elapsed < CART_LEAVES && !r.courier && !r.tape) {
      scene('radio-courier', '무전으로 재호에게 부탁', '방송실에서 파란 스티커의 원본 운반을 맡깁니다. 23:57에 도착합니다.', null,
        '“현관, 응답. 파란 스티커 붙은 상자죠? 찾아서 윤서 씨 콘솔에 올려 둘게요.”', '재호 · 직원 무전', false,
        () => { r.courier = true; r.courierByRadio = true; });
    }
    if (r.tape) {
      finalChoice('voices', '주민 인터뷰 방송하기', '테이프를 틀고 마을의 목소리로 방송을 닫습니다.', !canJoin && !directReply);
    }
    if (canJoin) {
      finalChoice('both', '두 방송을 잇기', joinDetail, true);
    }
  }

  if (r.room === 'hall') {
    if (r.tape === 'carried') {
      offer('carry-to-studio', '원본을 들고 방송실로', '윤서가 기다리는 콘솔로 이동합니다.', () => enter('studio'), true);
    }
    if (cartHere(r.elapsed) && !r.tape && !r.courier) {
      scene('search-cart', '수레의 상자 확인', '‘빈 상자’ 라벨 밑으로 파란 스티커가 보입니다.', 'label',
        '파란 스티커 아래 주민 인터뷰 원본이 있다. 순임의 메모가 붙어 있다. “아버지가 기다리던 부두에 제 목소리를 들려주세요.”', '', !knows('label'),
        () => { r.tape = 'carried'; learn('sunim'); });
    }
    if (knows('label') && r.elapsed < CART_LEAVES && !r.courier) {
      const early = game.loop > 1 && r.elapsed < CART_ARRIVES;
      scene('assign-courier', '재호에게 원본 운반 부탁', early
        ? '파란 스티커를 미리 알려 주면 재호가 23:57에 원본을 전달합니다.'
        : '재호가 23:57에 원본을 전달합니다. 그동안 다른 곳에 갈 수 있습니다.', null,
      early ? '“아직 상자도 안 들어왔는데, 그걸 어떻게 알았어요? 오면 제가 먼저 빼 둘게요.”'
        : '“빈 상자라고 붙은 데에 파란 스티커요? 찾아서 윤서 씨한테 직접 드릴게요.”', '재호', true,
      () => { r.courier = true; r.courierBriefedEarly = early; r.tape = ''; });
    }
    scene('read-sheet', '운반표 확인', '현관 옆 종이에 수레가 떠날 시각이 적혀 있습니다.', 'departure',
      '운반표의 마지막 줄에 23:57이라고 적혀 있다. 이 시간 이후 남은 상자는 밖으로 나간다.');
    if (r.elapsed < CART_ARRIVES) {
      scene('wait', '현관 종을 기다리기', '복도에 머무르며 한 분을 보냅니다.', null,
        '빗방울이 유리문을 두드린다. 문 옆에서 바퀴 구르는 소리가 가까워진다.', '', true);
      return actions;
    }
  }

  if (r.room === 'archive') {
    scene('ask-mira', '미라에게 원본의 표식 묻기', '포장을 맡았던 사람에게 상자를 구분할 방법을 묻습니다.', 'label',
      '“‘빈 상자’라고 쓰인 라벨 아래 파란 스티커를 붙였어요. 그 안에 주민 인터뷰 원본을 넣었어요.”',
      '미라', false, () => learn('rundown'));
    scene('read-routing', '두 채널 연결표 펼치기', '방송실과 옥상에서 어떤 일을 할 수 있는지 확인합니다.', 'routing',
      '연결표 위에 두 사람이 그려져 있다. 방송실 재생기에서 한려 FM으로, 옥상 교신에서 보조 채널로 선이 이어진다.', '', true);
    scene('read-airlog', '건너편 방송 일지 읽기', '빗속 항구의 방송 시작 멘트가 다른 시계에 기록돼 있습니다.', 'airlog',
      '건너편 방송 일지 23:56. 윤서의 첫 멘트가 적혀 있다. “비 오는 항구의 밤입니다.”\n뒷면 편성표에는 순임의 인터뷰 칸이 비어 있다.',
      '', false, () => learn('remoteSlot'));
  }

  if (r.room === 'roof') {
    scene('inspect-relay', '건너편 수신 기록 조사', '같은 주파수에서 잡힌 녹음과 시각을 확인합니다.', 'relay',
      '녹음에는 높은 종소리 뒤 낮은 종소리가 이어진다. 건너편 시각은 23:55. 녹음 끝에 다음 교신 시각이 남아 있다. 건너편 23:58.', '', !knows('relay'));
    if (knows('relay')) {
      const plan = reservationPlan();
      if (!plan.proposed && !plan.actual) {
        offer('compare', '수첩에서 증거 연결하기', '두 시계에서 같은 사건을 찾고 시차 가설을 세웁니다.', openClockReview, true, '시간 유지');
      } else if (plan.canApply && plan.proposed !== failed) {
        offer('reserve-relay', plan.pending ? '실제 예약 변경하기' : '보조 채널 예약하기',
          plan.pending ? fmt('{0} 예약을 {1}로 바꿉니다.', time(plan.actual), time(plan.proposed))
            : fmt('이쪽 시계 {0}에 연결을 시도합니다.', time(plan.proposed)), reserveRelay, true);
      } else if (plan.proposed && !plan.actual) {
        offer('review-clocks', '수첩에서 시각 다시 확인', '이번 밤의 예약 시각을 지났습니다.', openClockReview, false, '시간 유지');
      }
    }
    if (r.linked) {
      finalChoice('signal', '건너편 윤서에게 응답', r.syncMissed ? '콘솔을 연 뒤 마이크에 1행동을 씁니다.'
        : '옥상에서 그 목소리에 남은 방송 시간을 씁니다.', !canJoin);
      if (r.intent !== 'mystery' && !game.storySolved && mysteryEvidence.every(knows)) {
        offer('compare-schedules', '편성표와 호출 대조하기', '건너편 윤서가 순임의 원본을 찾는 이유를 확인합니다.', openMystery, false, '시간 유지');
      }
    }
    if (canJoin) {
      finalChoice('both', '두 방송을 잇기', joinDetail, true);
    }
  }

  if (directReply) {
    offer('go-reply', '옥상으로 이동해 응답', '이동 1행동 뒤 마이크를 여는 데 1행동이 필요합니다.', () => enter('roof'), true);
  }
  if (r.elapsed === 0 && r.room === 'studio') return actions;
  const nextEvent = nextReservationEvent();
  if (nextEvent - r.elapsed > 1) {
    offer('wait-event', '다음 방송 사건까지 대기', fmt('{0}에 멈춥니다.', time(nextEvent)), waitUntilEvent, true,
      fmt('{0}행동', nextEvent - r.elapsed));
  }
  scene('wait', waitAction, '이곳에서 다음 사건을 기다립니다.', null, waitMessage);
  return actions;
}

function context() {
  const r = game.run;
  if (r.room === 'hall') {
    if (r.elapsed < CART_ARRIVES) return ['수레 도착 전', game.loop === 1
      ? '수레는 아직 밖에 있다. 현관 종이 울리면 들어온 상자를 살펴보자.'
      : '문 밖은 텅 비어 있다. 바퀴 소리가 들려올 때까지 확인할 상자는 없다.'];
    if (cartHere(r.elapsed)) return ['수레가 들어왔다', r.courierBriefedEarly
      ? '재호가 파란 스티커가 붙은 상자를 먼저 빼 둔다.' : '재호가 가져온 상자 세 개가 현관 오른쪽에 놓여 있다.'];
    return ['수레 출발', '바퀴 자국만 남아 있다. 남은 상자는 이미 차에 실렸다.'];
  }
  if (r.room === 'studio') {
    return r.elapsed < ON_AIR
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
  const opening = openingPlan();
  if (opening) return opening.goal;
  if (r.intent) return plannedObjective(r);
  if (r.dj && r.courier && !r.syncMissed) return r.linked && r.tape === 'delivered'
    ? '지금 윤서에게 동시 송출 신호를 보낸다' : '옥상에서 두 시계를 비교해 교신을 예약한다';
  if (r.linked && r.syncMissed) return '건너편 호출에 응답한다';
  if (r.tape && r.room !== 'roof') return '방송실에서 주민 인터뷰를 송출한다';
  if (r.linked) return '건너편 호출에 응답한다';
  if (r.room === 'hall' && !r.courier) {
    if (r.elapsed < CART_ARRIVES) return '현관 종을 기다린다';
    if (cartHere(r.elapsed)) return '수레에서 인터뷰 원본을 찾는다';
  }
  if (r.room === 'roof' && knows('relay')) {
    const plan = reservationPlan();
    if (plan.pending) return plan.canApply ? '옥상 송신기의 실제 예약을 확인한다' : '예약한 시각까지 교신을 기다린다';
    if (!plan.actual) return plan.proposed && plan.canApply
      ? '옥상 송신기에 교신 시각을 예약한다' : '수첩에서 같은 사건의 기록을 연결한다';
  }
  if (r.room === 'hall' && r.elapsed >= CART_LEAVES && !r.tape) return '다음 회차에 수레를 붙잡을 방법을 찾는다';
  return '자정 전에 주민 인터뷰 원본을 방송한다';
}

function plannedObjective(r) {
  if (r.linked) {
    return r.dj && r.tape === 'delivered' && r.elapsed === REPLY_WINDOW ? '지금 윤서에게 동시 송출 신호를 보낸다' : '건너편 호출에 응답한다';
  }
  if (r.intent === 'mystery' && !game.storySolved) return knows('remoteSlot')
    ? '편성표와 호출을 대조한다' : '자료실에서 건너편 방송 일지를 찾는다';
  if (failedReservationMinute()) return '두 시계의 차이를 다시 확인한다';
  if (r.intent === 'connect') {
    if (!knows('routing')) return '자료실에서 두 채널 연결표를 찾는다';
    if (!knows('label')) return '미라에게 원본의 표식을 확인한다';
    const route = connectionRoute();
    if (route && !route.feasible) return '다음 회차에 방송실과 옥상의 일을 나눈다';
    if (!r.courier || !r.dj) {
      if (r.elapsed >= CART_LEAVES) return '다음 회차에 방송실과 옥상의 일을 나눈다';
      if (!r.courier && !r.dj) return '재호에게 원본을, 윤서에게 방송실을 맡긴다';
      return r.courier ? '방송실에서 윤서에게 송출 준비를 맡긴다' : '재호에게 원본 운반을 맡긴다';
    }
  }
  const plan = reservationPlan();
  if (plan.pending) return '예약한 시각까지 교신을 기다린다';
  if (r.tuneAt || r.elapsed >= REPLY_WINDOW) return '수첩에서 다음 교신 시각을 확인한다';
  if (!knows('relay')) return '옥상에서 건너편 수신 기록을 찾는다';
  if (!plan.proposed) return '수첩에서 같은 사건의 기록을 연결한다';
  return '옥상 송신기에 교신 시각을 예약한다';
}

function openingPlan() {
  if (game.loop < 2 || !openingReceiverHere()) return null;
  const move = (goal, question, room, title, intent) => ({ goal, question, intent, action: { id: room, title, cost: '1행동', run: () => enter(room) } });
  const mystery = () => knows('remoteSlot')
    ? { goal: '편성표와 호출을 대조한다', question: '건너편 윤서는 왜 원본을 찾았을까요?', intent: 'mystery',
      action: { id: 'review-mystery', title: '편성표와 호출 대조하기', cost: '시간 유지', run: openMystery } }
    : move('자료실에서 건너편 방송 일지를 찾는다', '건너편 윤서가 찾던 원본의 흔적이 자료실에 남아 있습니다.', 'archive', '방송 일지를 찾으러 자료실로', 'mystery');
  if (game.run.intent === 'mystery' && needsMystery()) return mystery();
  const failed = failedReservationMinute();
  const retry = clockRetryIntent();
  if (failed) return { goal: '두 시계의 차이를 다시 확인한다', question: fmt('지난 {0} 예약에서는 잡음만 들렸습니다.', time(failed)),
    option: 'recheck-clock', intent: retry };
  const revised = game.run.clockReviewed && reservationPlan().proposed;
  if (revised && retry === 'contact') return move('새 가설을 옥상 송신기에서 시험한다',
    '수첩에서 다시 계산한 시각을 옥상에서 예약하세요.', 'roof', '옥상 송신실로 이동', 'contact');
  const resumeConnection = Boolean(revised && retry === 'connect');
  if (!resumeConnection && epilogueUnlocked() && needsMystery()) return mystery();
  if (!resumeConnection && epilogueUnlocked() && !game.epilogueSeen) {
    return { goal: '첫 교신의 원본을 확인한다', question: '23:52의 첫 교신에서 어떤 목소리가 들렸을까요?',
      action: { id: 'epilogue', title: '첫 교신의 원본 듣기', cost: '시간 유지', run: openEpilogue } };
  }
  if (!resumeConnection && epilogueUnlocked()) return null;
  const last = game.previousLoop?.moments.at(-1)?.id;
  if (resumeConnection || (!game.unlocked.includes('both') && (game.unlocked.includes('signal') || last === 'syncMissed' || last === 'cue'))) {
    const retryNote = resumeConnection ? fmt('다시 계산한 {0}에 맞춰 동시 송출 준비를 이어갑니다.', time(revised)) : '';
    if (!knows('routing')) return move('두 방송을 이을 방법을 찾는다', '두 채널은 어디에서 연결할 수 있을까요?', 'archive', '자료실로 이동', 'connect');
    if (!knows('label')) return move('미라에게 원본의 표식을 확인한다', '재호가 어느 상자에서 원본을 꺼내야 할까요?', 'archive', '자료실로 이동', 'connect');
    if (canRadioCourier()) return { goal: '방송실과 옥상의 일을 나눈다',
      question: retryNote || '내가 옥상에 있는 동안 누가 원본을 옮길까요?', option: 'radio-courier', intent: 'connect' };
    return { goal: '윤서에게 방송실을 먼저 맡긴다', question: retryNote || '방송실을 맡긴 뒤 복도의 재호를 만나면 제시간에 옥상에 갈 수 있습니다.',
      option: 'assign-dj', intent: 'connect' };
  }
  if (!game.unlocked.includes('signal') && (game.unlocked.includes('voices') || knows('relay'))) {
    return move('건너편 윤서의 다음 호출을 찾는다', '건너편 윤서는 언제 다시 부를까요?', 'roof', '옥상 송신실로 이동', 'contact');
  }
  return move('수레가 떠나기 전에 원본을 찾는다', game.nextQuestion || '이번에는 어떤 단서를 먼저 확인할까요?', 'hall', '복도로 이동');
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

function setExchangeLine(index) {
  activeExchangeLine = index;
  const caption = $('exchange-live');
  const line = t(exchangeLines[index]?.live || '재호가 원본을 전했다. 건너편 윤서는 순임의 원본을 찾는다.');
  if (caption.textContent !== line) caption.textContent = line;
  caption.dataset.channel = index === 1 ? 'relay' : index === 0 ? 'staff' : '';
  [...$('exchange-lines').children].forEach((row, position) => {
    if (position === index) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  });
}

function renderExchangeStatus() {
  const r = game.run;
  $('exchange-status').textContent = t(r.console === 'both'
    ? r.consoleReady ? '송출 신호 보냄' : routesReady(r.routes) ? '두 송출선 연결 완료' : '송출선 연결 중'
    : '원본 도착 · 건너편 교신 연결');
}

function renderExchange(show) {
  $('radio-exchange').hidden = !show;
  $('exchange-transcript').hidden = !show;
  if (!show) {
    $('exchange-transcript').open = false;
    return;
  }
  renderExchangeStatus();
  $('exchange-lines').replaceChildren(...exchangeLines.map(({ channel, caption }) => {
    const row = element('li');
    row.append(element('strong', channel), element('p', caption));
    return row;
  }));
  setExchangeLine(activeExchangeLine);
}

function renderScene() {
  const r = game.run;
  const room = rooms[r.room];
  const [state, setting] = context();
  const intro = openingReceiverHere();
  const art = intro ? './opening-receiver.webp' : room.art || (cartHere(r.elapsed) ? './hall.webp' : './hall-empty.webp');
  const image = $('scene-image');
  if (image.getAttribute('src') !== art) image.setAttribute('src', art);
  const scene = image.closest('.scene');
  scene.dataset.room = r.room;
  scene.dataset.phase = r.phase;
  scene.dataset.intro = String(intro);
  scene.dataset.arrived = String(game.loop === 1 && r.room === 'hall' && r.phase === 'play' && r.elapsed === CART_ARRIVES);
  scene.dataset.transmitting = String(Boolean(transmission));
  $('room-floor').textContent = t(r.phase === 'play' ? room.floor : '한려 FM');
  $('room-name').textContent = t(r.phase === 'play' ? room.name
    : r.phase === 'ending' ? endings[r.ending].title : '시간이 다 됐다');
  $('room-state').textContent = t(r.phase === 'play' ? state : '송출 종료');
  $('context').hidden = r.phase !== 'play';
  $('context').textContent = t(setting);

  const story = [];
  if (intro) {
    if (r.message) story.push(spoken({ text: r.message }));
    story.push(spoken(opening[0]));
  } else if (r.message && (r.message !== setting || r.phase !== 'play')) {
    story.push(spoken({ speaker: r.speaker, text: r.message }));
  }
  if (r.phase === 'ending') {
    story.push(spoken({ speaker: '마지막 송출', text: endingFor(r.ending, r.storyReply).transcript, radio: true }));
  }
  $('story').replaceChildren(...story);
  const exchange = hasRadioExchange();
  const liveCall = hasLiveCall();
  scene.dataset.exchange = String(liveCall);
  scene.dataset.liveConsole = String(liveCall && Boolean(r.console));
  scene.dataset.result = String(!transmission && r.phase !== 'play');
  $('solo-call').hidden = !liveCall || exchange;
  $('solo-caption').textContent = t(callQuestion);
  const event = liveCall ? r.event.split('\n').filter((line) => ![callWords, callQuestion].includes(line)
    && (!exchange || line !== tapeDelivered) && (r.console || line !== syncMissed)).join('\n') : r.event;
  $('event').hidden = !event;
  $('event').textContent = t(event);
  renderExchange(exchange);
  const clip = intro ? 'opening' : r.clip;
  const replayLabels = { opening: '첫 교신 듣기', delivery: '재호의 무전 듣기', call: '건너편 호출 듣기', callWithQuestion: '건너편 호출 듣기' };
  replayLabels.onAir = '오프닝 다시 듣기';
  const replay = !liveCall && clip ? [listenButton(clip, replayLabels[clip] ?? '마지막 송출 다시 듣기')] : [];
  if (!exchange && hadRadioExchange()) {
    const listen = element('button', '두 무전 다시 듣기', 'utility listen');
    listen.type = 'button';
    listen.addEventListener('click', replayExchange);
    replay.push(listen);
  }
  if (r.phase === 'ending') {
    const watch = element('button', '송출 장면 다시 보기', 'utility listen');
    watch.type = 'button';
    watch.addEventListener('click', startTransmission);
    replay.unshift(watch);
  }
  $('scene-tools').hidden = Boolean(transmission);
  $('replay').replaceChildren(...replay);
  const lastMoment = intro ? game.previousLoop?.moments.at(-1) : null;
  $('rewind-memory').hidden = !lastMoment;
  $('rewind-memory').textContent = lastMoment ? fmt('지난 밤 {0} · {1}', time(lastMoment.minute), t(loopMarkers[lastMoment.id][1])) : '';
}

function renderBroadcast() {
  const r = game.run;
  const panel = $('broadcast');
  const live = hasLiveCall() && Boolean(r.console);
  const slot = $(live ? 'live-console' : 'broadcast-slot');
  if (panel.parentElement !== slot) slot.append(panel);
  const radio = $(live ? 'console-radio' : 'lead-radio');
  if ($('radio-exchange').parentElement !== radio) radio.append($('radio-exchange'), $('solo-call'));
  const transcript = $(live ? 'console-transcript' : 'lead-radio');
  if ($('exchange-transcript').parentElement !== transcript) transcript.append($('exchange-transcript'));
  panel.dataset.compact = String(live);
  panel.hidden = !r.console || r.review || Boolean(transmission);
  if (!r.console) return;
  const onAir = r.phase === 'ending';
  const isDual = r.console === 'both';
  const routing = isDual && r.phase === 'play' && !r.consoleReady;
  const wiringNote = $('wiring-note');
  wiringNote.hidden = !routing || !knows('routing');
  if (wiringNote.hidden) wiringNote.open = false;
  else $('wiring-note-lines').replaceChildren(...Object.entries(correctRoutes).map(([source, destination]) => {
    const row = element('div');
    row.append(element('dt', routeSources[source]), element('dd', routeDestinations[destination]));
    return row;
  }));
  $('routing-panel').hidden = !routing;
  $('routing-status').hidden = !routing;
  if (routing) {
    for (const input of $('routing-panel').querySelectorAll('input')) {
      input.checked = r.routes[input.closest('fieldset').dataset.source] === input.value;
    }
    const { tape, relay } = r.routes;
    const connected = Number(Boolean(tape)) + Number(Boolean(relay));
    $('routing-progress').textContent = fmt(connected === 2 && !routesReady(r.routes)
      ? '연결 {0}/2 · 배선 확인' : '연결 {0}/2 · 시간 유지', connected);
    const status = !tape || !relay ? ''
      : tape === relay ? '두 입력이 같은 채널에 모였습니다. 두 목적지의 신호를 확인하세요.'
        : routesReady(r.routes) ? '두 채널을 연결했습니다. 동시 송출 신호를 보낼 수 있습니다.'
          : '두 채널에 신호가 들어옵니다. 연결표와 비교해 목적지를 다시 확인하세요.';
    $('routing-status').textContent = t(status);
  }
  $('broadcast').dataset.live = String(onAir);
  $('broadcast').dataset.linked = String(r.consoleReady);
  $('broadcast-state').textContent = t(onAir ? '송출 완료' : r.consoleReady ? '두 채널 연결됨' : '송출 대기');
  $('sync-cue').hidden = !routing || hasRadioExchange();
  $('sync-cue').textContent = t('23:57 · 원본 전달 완료 · 건너편 교신 연결');
  const channels = {
    voices: [['순임의 인터뷰', r.tape ? '테이프 장착' : '테이프 대기']],
    signal: [['건너편 윤서', '교신 연결'], ['내 마이크', '마이크 대기']],
  }[r.console];
  if (isDual) {
    $('broadcast-channels').replaceChildren(...Object.entries(routeDestinations).map(([destination, label]) => {
      const sources = Object.keys(routeSources).filter((source) => r.routes[source] === destination);
      const state = sources.map((source) => t(routeSources[source])).join(' · ') || t('입력 없음');
      const row = element('li');
      row.dataset.destination = destination;
      row.dataset.feedCount = sources.length;
      const meter = element('span', '', 'meter');
      meter.setAttribute('aria-hidden', 'true');
      row.append(element('span', label), element('strong', onAir ? '송출 완료' : state), meter);
      return row;
    }));
    return;
  }
  $('broadcast-channels').replaceChildren(...channels.map(([name, state]) => {
    const line = element('li');
    const meter = element('span', '', 'meter');
    meter.setAttribute('aria-hidden', 'true');
    line.append(element('span', name), element('strong', onAir ? '송출 완료' : state), meter);
    return line;
  }));
}

function renderReservation(id) {
  const r = game.run;
  const { proposed, actual, pending, canApply } = reservationPlan();
  const panel = $(id);
  const different = Boolean(proposed && actual && proposed !== actual);
  panel.className = 'reservation-comparison';
  panel.dataset.different = String(different);

  const summary = element('dl', '', 'reservation-times');
  for (const [label, value] of [
    ['가설로 계산한 시각', proposed ? time(proposed) : '가설 미선택'],
    ['송신기의 실제 예약', actual ? time(actual) : '미예약'],
  ]) {
    const cell = element('div');
    cell.append(element('dt', label), element('dd', value));
    summary.append(cell);
  }
  let status = '가설을 골라도 실제 예약은 그대로입니다.';
  if (actual && !pending) status = r.linked ? '이 예약으로 교신에 연결했습니다.' : '이 예약으로는 교신에 연결하지 못했습니다.';
  else if (pending && different) {
    const earliest = r.elapsed + (r.room === 'roof' ? 1 : 2);
    status = canApply && proposed >= earliest && (r.room === 'roof' || actual > r.elapsed + 1)
      ? '두 시각이 다릅니다. 옥상 송신기에서 1행동으로 예약을 변경할 수 있습니다.'
      : '두 시각이 다릅니다. 이번 회차에는 새 시각에 맞춰 변경할 수 없습니다.';
  } else if (pending) status = '송신기가 실제 예약 시각에 연결을 시도합니다.';
  panel.replaceChildren(summary, element('p', status, 'note'));
}

function renderReadiness() {
  const r = game.run;
  const active = r.phase === 'play' && !r.review;
  const atConsole = r.room === 'studio' || r.room === 'roof';
  const reservation = reservationPlan();
  const reservationVisible = active && r.room === 'roof' && (knows('relay') || r.tuneAt) && !r.console
    && (!r.linked || reservation.proposed !== reservation.actual);
  $('roof-reservation').hidden = !reservationVisible;
  if (reservationVisible) renderReservation('roof-reservation-status');

  const show = active && atConsole && knows('routing') && (!r.console || (r.console === 'both' && !hasRadioExchange()));
  $('readiness').hidden = !show;
  if (!show) return;

  const tape = r.tape === 'delivered'
    ? '원본 도착' : r.courier
      ? '재호가 운반 예정' : r.elapsed >= CART_LEAVES
        ? '재호의 수레가 떠남' : '재호에게 운반 부탁 필요';
  const dj = r.dj ? '윤서가 준비 중' : '방송실에서 부탁 필요';
  let link = '옥상에서 예약 필요';
  if (r.linked) link = '교신 연결됨';
  else if (r.tuneAt) link = r.tuneAt > r.elapsed ? '예약 시각 대기 중' : '예약 시각에 연결 실패';
  const rows = [
    ['원본 전달', tape, r.tape === 'delivered'],
    ['윤서 준비', dj, r.dj],
    ['교신 연결', link, r.linked],
  ];
  $('readiness-status').replaceChildren(...rows.map(([label, state, completed]) => {
    const row = element('li');
    row.dataset.ready = String(completed);
    row.append(element('span', label), element('strong', state));
    return row;
  }));
  let next = '';
  if (r.consoleReady) next = '동시 송출 신호를 보냈습니다. 마이크를 열면 방송이 시작됩니다.';
  else if (r.dj && r.tape === 'delivered' && r.linked && r.elapsed === REPLY_WINDOW) next = '세 가지 준비가 끝났습니다. 지금 두 방송을 잇고 신호를 보내세요.';
  $('readiness-next').hidden = !next;
  $('readiness-next').textContent = t(next);
}

function turningPoint() {
  const r = game.run;
  if (r.ending === 'both') return [LIMIT, '원본과 건너편 목소리가 모두 방송되었습니다.'];
  if (r.syncMissed) return [REPLY_WINDOW, '원본 전달과 교신이 겹친 순간에 윤서에게 신호를 보내지 못했습니다.'];
  if (r.ending === 'signal') return [REPLY_WINDOW, '23:57에 열린 건너편 호출에 응답했습니다.'];
  if (r.ending === 'voices') return [LIMIT, '주민 인터뷰는 전했지만 건너편 호출에는 응답하지 못했습니다.'];
  if (r.tuneAt && !r.linked && r.elapsed >= r.tuneAt) return [r.tuneAt, '예약한 시각에 건너편 채널이 닫혀 있었습니다.'];
  if (!r.tape && r.elapsed >= CART_LEAVES) return [CART_LEAVES, '23:57에 수레가 떠나 원본을 확보하지 못했습니다.'];
  if (r.phase === 'expired') return [LIMIT, '자정까지 준비한 방송을 송출하지 못했습니다.'];
  return [r.elapsed, '아직 남은 시간에 다른 선택을 해 볼 수 있습니다.'];
}

function reviewQuestion() {
  const r = game.run;
  if (r.ending && epilogueUnlocked() && !game.epilogueSeen) return '세 결말을 모두 들었습니다. 23:52의 첫 교신을 다시 들어 볼까요?';
  if (r.syncMissed) return '원본 전달과 건너편 교신이 같은 시각에 오면 무엇을 먼저 해야 할까요?';
  if (r.ending === 'signal') return '당신이 옥상에 있는 동안 누가 원본을 방송실로 옮길 수 있을까요?';
  if (r.ending === 'both') {
    if (!game.storySolved) return '건너편 윤서가 원본을 찾은 이유는 무엇일까요? 자료실 편성표와 호출을 비교해 보세요.';
    return '다른 선택을 했다면 어떤 목소리가 방송에 남을까요?';
  }
  if (r.ending === 'voices') {
    if (knows('remoteRequest') && !game.storySolved) return '건너편 윤서는 왜 원본을 찾았을까요? 자료실 편성표를 확인해 보세요.';
    if (game.matches.length) return '알아낸 교신 시각을 옥상에서 예약해 이번에는 건너편에 답해 볼까요?';
    if (!knows('relay')) return '옥상에 남은 녹음은 건너편의 다음 교신을 언제로 기록했을까요?';
  }
  if (r.tuneAt && !r.linked && r.elapsed >= r.tuneAt) return '종소리와 방송 오프닝에서 찾은 시차가 같은가요? 자료실 방송 일지에서 확인할 수 있습니다.';
  if (r.courier && r.dj && r.phase === 'expired') return '두 곳의 준비를 마친 뒤 콘솔에 몇 행동을 남겨야 할까요?';
  if (r.elapsed >= CART_LEAVES && !r.tape) return '수레가 나가기 전에 몇 시까지 복도에 도착해야 할까요?';
  if (knows('relay')) return '같은 종소리가 두 시계에 몇 시로 기록되어 있나요?';
  if (knows('departure')) return '수레가 나가기 전에 몇 시까지 복도에 도착해야 할까요?';
  return '남은 시간에는 어떤 단서를 확인할 수 있을까요?';
}

function renderRecap() {
  const r = game.run;
  const show = !transmission && (r.review || r.phase !== 'play');
  $('recap').hidden = !show;
  renderPierLinks();
  if (!show) return;
  $('recap-title').textContent = t(r.phase === 'ending' ? endings[r.ending].title : '이번 밤의 기록');
  const outcomes = $('recap-outcomes');
  outcomes.hidden = r.phase === 'play';
  const interviewSent = r.ending === 'voices' || r.ending === 'both';
  const replySent = r.ending === 'signal' || r.ending === 'both';
  const resultRow = (label, sent, success, pending) => {
    const item = element('li');
    item.dataset.sent = String(sent);
    item.append(element('strong', label), element('span', sent ? success : pending));
    return item;
  };
  outcomes.replaceChildren(
    resultRow('순임의 인터뷰', interviewSent, '방송 완료', '방송하지 못함'),
    resultRow('건너편 윤서', replySent, '응답 완료', r.linked ? '교신 연결 · 응답 없음' : '응답하지 못함'),
  );
  $('recap-epilogue').hidden = !epilogueUnlocked() || r.phase === 'play' || game.epilogueSeen;
  const mysteryAvailable = r.phase !== 'play' && needsMystery();
  $('recap-mystery').hidden = !mysteryAvailable;
  $('recap-mystery').setAttribute('aria-haspopup', String(knows('remoteSlot') ? 'dialog' : 'false'));
  $('recap-followups').hidden = ['recap-mystery', 'recap-epilogue', 'recap-pier'].every((id) => $(id).hidden);
  const [minute, reason] = turningPoint();
  $('turning-time').textContent = time(minute);
  $('missed').textContent = t(reason);
  const row = ({ minute, text, kind, args = [] }) => {
    const line = element('li');
    const localizedArgs = args.map((item) => Object.hasOwn(rooms, item) ? t(rooms[item].name) : item);
    line.append(element('time', time(minute)), element('span', fmt(text, ...localizedArgs)));
    if (kind === 'action') line.dataset.action = 'true';
    return line;
  };
  const notes = r.log.filter((entry) => entry.kind !== 'action').slice(-4);
  $('observed').replaceChildren(...(notes.length ? notes.map(row) : [element('li', '아직 기록된 사건이 없습니다.')]));
  $('action-history').hidden = !r.log.length;
  $('action-record').replaceChildren(...r.log.map(row));
  $('next-question').textContent = t(mysteryAvailable && epilogueUnlocked() ? '건너편 윤서는 왜 원본을 찾았을까요?' : reviewQuestion());
}

function renderTimeline() {
  const r = game.run;
  const minuteShown = transmission ? r.onAirAt : r.elapsed;
  const entries = [
    [0, '마지막 방송 준비'],
    [CART_ARRIVES, knows('bell') ? '현관 종 두 번 · 수레 도착' : '현관에서 어떤 소리가 날까?'],
    [ON_AIR, '한려 FM 생방송 시작'],
    [CART_LEAVES, r.tape === 'delivered' ? '재호가 방송실에 원본 전달' : knows('departure') ? '재호의 수레 출발' : '다음 사건'],
    [LIMIT, '마지막 송출 종료'],
  ];
  $('timeline').replaceChildren(...entries.map(([minute, label]) => {
    const entry = element('li', '', minute <= minuteShown ? 'seen' : '');
    if (minute === minuteShown) entry.setAttribute('aria-current', 'time');
    entry.append(element('time', time(minute)), element('span', label));
    return entry;
  }));
  const previous = game.previousLoop;
  $('timeline-comparison').hidden = Boolean(transmission) || !previous?.moments.length;
  if ($('timeline-comparison').hidden) return;
  $('timeline-past-title').textContent = fmt('지난 {0}회차', previous.loop);
  $('timeline-current-title').textContent = fmt('이번 {0}회차', game.loop);
  const rows = (moments) => moments.map(({ id, minute }) => {
    const row = element('li');
    row.dataset.marker = id;
    row.append(element('time', time(minute)), element('span', loopMarkers[id][1]));
    return row;
  });
  $('timeline-past').replaceChildren(...rows(previous.moments));
  const current = rows(loopMoments(r));
  $('timeline-current').replaceChildren(...(current.length ? current : [element('li', '이번 밤의 행동을 기다리는 중', 'timeline-empty')]));
}

const playHints = {
  start: ['마지막 방송에 필요한 원본은 누가 옮기고 있을까요?', '복도 현관으로 수레가 들어옵니다. 수레에 정리 중인 상자가 실려 있습니다.', '방송실의 “복도로 이동”을 선택하세요.'],
  findHall: ['원본이 담긴 상자가 지금 어디 있을까요?', '재호의 수레는 23:54부터 23:57 전까지 복도에 있습니다.', '방송국 지도에서 복도로 이동해 수레의 상자를 확인하세요.'],
  arrival: ['현관에서 이미 들어온 상자가 보이나요?', '현관 종이 울리는 시각은 23:54입니다. 그때 상자가 복도로 들어옵니다.', '복도에서 현관 종을 기다린 뒤 수레의 상자를 확인하세요.'],
  trolley: ['수레의 라벨 아래에 무엇이 보이나요?', '원본은 접힌 라벨 아래 파란 스티커가 붙은 상자에 들어 있습니다.', '“수레의 상자 확인”으로 테이프를 확보하세요.'],
  carry: ['테이프를 재생할 수 있는 곳은 어디인가요?', '방송실에 주민 인터뷰를 내보낼 재생기가 있습니다. 이동과 재생에 각각 1행동이 듭니다.', '방송실로 이동해 주민 인터뷰를 고르고 테이프를 재생하세요.'],
  airInterview: ['찾은 원본을 누구에게 들려줄까요?', '방송실에서 주민 인터뷰를 선택하면 재생 콘솔이 열립니다.', '“주민 인터뷰 방송하기”를 골라 테이프를 재생하세요.'],
  playTape: ['콘솔에 원본을 올렸나요?', '테이프 재생이 주민 인터뷰를 전파에 실어 보냅니다.', '“테이프 재생하기”를 누르세요.'],
  discoverRelay: ['다른 윤서의 목소리는 어느 장비에 기록됐을까요?', '옥상 송신실에 건너편 종소리와 다음 호출 시각이 담긴 기록이 있습니다.', '옥상 송신실에서 “건너편 수신 기록 조사”를 선택하세요.'],
  clocks: ['두 시계에서 같은 소리를 낸 사건은 무엇인가요?', '수첩에서 복도 종 23:54와 건너편 종 23:55를 비교하세요. 건너편 다음 호출은 23:58입니다.', '두 종 기록을 연결하고 “건너편이 1분 빠르다”를 고르세요. 옥상에서 실제 23:57 교신을 예약하세요.'],
  waitContact: ['예약한 시각에 어느 곳에서 방송을 마칠까요?', '옥상 송신기는 예약한 시각에 채널을 엽니다. 연결되면 옥상에서 응답할 수 있습니다.', '옥상으로 이동하거나 옥상에서 기다려 23:57의 호출을 받으세요.'],
  waitTape: ['당신이 움직이는 동안 누가 원본을 옮기고 있나요?', '재호와 한 약속은 23:57에 원본을 윤서의 콘솔에 두는 것입니다.', '23:57까지 필요한 준비를 마치거나 방송실에서 기다리세요.'],
  radioNow: ['방송실에서 복도에 있는 재호를 부를 수 있나요?', '직원 무전 호출과 파란 스티커를 알고 있습니다. 23:57에 재호가 원본을 전달할 수 있습니다.', '지금 “무전으로 재호에게 부탁”을 선택하세요.'],
  late: ['다시 시도하면 어느 행동을 더 일찍 할 수 있을까요?', '원본은 23:57까지, 교신 예약은 연결하려는 시각까지 준비해야 합니다. 이번 밤의 기록에서 놓친 시각을 확인할 수 있습니다.', '“되감기 검토”에서 기록을 확인하고 23:52로 돌아가세요.'],
  reply: ['건너편 윤서에게 들려줄 목소리는 어디에서 보낼 수 있나요?', '교신이 열렸습니다. 응답에는 옥상의 송출 콘솔과 1행동이 필요합니다.', '옥상에서 “건너편 윤서에게 응답”을 고르고 마이크를 여세요.'],
  microphone: ['건너편에 보낼 신호는 준비됐나요?', '교신이 연결됐습니다. 이제 마이크에 말을 실을 수 있습니다.', '“마이크 열기”를 누르세요.'],
  join: ['원본, 윤서, 교신이 모두 준비됐나요?', '23:57의 콘솔에서 두 장소를 잇고 신호에 1행동, 마지막 송출에 1행동을 씁니다.', '“두 방송을 잇기”를 열어 송출선을 연결하세요.'],
  patch: ['연결표에서 두 입력의 목적지는 어디였나요?', '단서 수첩의 “두 곳에서 하는 일”에 송출선이 기록돼 있습니다. 콘솔의 두 출력에 지금 들어오는 신호도 볼 수 있습니다.', '순임의 테이프는 한려 FM으로, 건너편 교신은 보조 채널로 연결하고 동시 송출 신호를 보내세요.'],
  sendBoth: ['신호가 연결된 뒤 마지막으로 열 장비는 무엇인가요?', '두 채널이 연결돼 있고 콘솔에 송출할 준비가 끝났습니다.', '“마이크 열고 함께 송출”을 누르세요.'],
  missingTape: ['당신이 옥상에 있는 동안 누가 원본을 방송실로 옮길 수 있을까요?', '복도 운반표에는 23:57에 짐을 내보낸다는 기록이 있습니다. 파란 스티커는 원본 상자의 표식입니다.', '다음 회차에 수레의 상자나 자료실의 미라에게서 표식을 확인하고, 23:57 전에 복도의 재호에게 원본을 맡기세요.'],
  missingTapeByRadio: ['당신이 옥상에 있는 동안 누가 원본을 방송실로 옮길 수 있을까요?', '파란 스티커는 원본 상자의 표식입니다. 직원 무전에서 재호의 호출 문구를 이미 확인했습니다.', '다음 회차 방송실에서 23:57 전에 “무전으로 재호에게 부탁”을 선택하세요.'],
};

function currentHint() {
  const r = game.run;
  if (r.console === 'both') return r.consoleReady ? 'sendBoth' : 'patch';
  if (r.console) return r.console === 'voices' ? 'playTape' : 'microphone';
  if (r.linked) {
    if (r.tape === 'delivered' && r.dj && r.elapsed === REPLY_WINDOW && (r.room === 'roof' || r.room === 'studio')) return 'join';
    if (!r.tape) return knows('staffCall') && knows('label') ? 'missingTapeByRadio' : 'missingTape';
    if (r.room === 'roof' || (r.syncMissed && r.elapsed < LIMIT - 1)) return 'reply';
  }
  if (r.tape && (!r.dj || !r.courier || r.elapsed >= REPLY_WINDOW)) {
    if (r.room === 'studio') return 'airInterview';
    return r.elapsed <= LIMIT - 2 ? 'carry' : 'late';
  }
  if (r.room === 'roof' || (r.dj && r.courier)) {
    if (r.tuneAt === REPLY_WINDOW && r.elapsed < REPLY_WINDOW) return 'waitContact';
    const travel = r.room === 'roof' ? 0 : 1;
    const inspect = knows('relay') ? 0 : 1;
    if (r.elapsed + travel + inspect + 1 > REPLY_WINDOW) return 'late';
    return knows('relay') ? 'clocks' : 'discoverRelay';
  }
  if (r.courier && !r.tape) return 'waitTape';
  if (!r.tape && r.elapsed >= CART_LEAVES) return knows('staffCall') && knows('label') ? 'missingTapeByRadio' : 'missingTape';
  if (r.elapsed === CART_LEAVES - 1 && r.room !== 'hall') {
    return r.room === 'studio' && knows('staffCall') && knows('label') ? 'radioNow' : 'late';
  }
  if (r.room === 'hall') return r.elapsed < CART_ARRIVES ? 'arrival' : 'trolley';
  return openingReceiverHere() ? 'start' : 'findHall';
}

function renderHints() {
  const visible = game.run.phase === 'play' && !game.run.review && !transmission;
  $('play-hints').hidden = !visible;
  const topic = visible ? currentHint() : '';
  if (topic !== hintState.topic) hintState = { topic, level: 0, open: false };
  $('hint-toggle').setAttribute('aria-expanded', String(hintState.open));
  $('hint-toggle').textContent = t(hintState.open ? '힌트 닫기' : '힌트');
  $('hint-steps').hidden = !hintState.open;
  if (!hintState.open) return;
  const labels = ['질문', '확인할 증거', '할 행동'];
  $('hint-list').replaceChildren(...playHints[topic].slice(0, hintState.level).map((message, index) => {
    const item = element('li');
    item.append(element('strong', labels[index]), element('p', message));
    return item;
  }));
  $('hint-more').hidden = hintState.level >= labels.length;
  $('hint-more').textContent = t(hintState.level === 1 ? '증거 보기' : '할 행동 보기');
}

function chooseRoute(event) {
  const input = event.target;
  const r = game.run;
  if (!input.matches('input[type="radio"]') || !input.checked || r.phase !== 'play' || r.console !== 'both' || r.consoleReady) return;
  r.routes[input.closest('fieldset').dataset.source] = input.value;
  save();
  renderBroadcast();
  renderExchangeStatus();
  const cue = document.querySelector('[data-action="send-cue"]');
  cue.disabled = !routesReady(r.routes);
  cue.querySelector('.action-detail').textContent = t(cueDetail());
}

function actionButton({ id, title, detail, primary, cost, disabled, run }) {
  const button = element('button', '', primary ? 'action primary' : 'action');
  if (id) button.dataset.action = id;
  const heading = element('span', '', 'action-head');
  heading.append(element('strong', title));
  if (cost) heading.append(element('span', cost, 'cost'));
  button.append(heading);
  if (detail) button.append(element('span', detail, 'action-detail'));
  button.type = 'button';
  button.disabled = Boolean(disabled);
  button.addEventListener('click', run);
  return button;
}

function renderActions(options) {
  const r = game.run;
  const available = (id) => options.find((option) => option.id === id);
  const opening = openingPlan();
  const openingAction = opening && (opening.action ?? available(opening.option));
  $('opening-guidance').hidden = !openingAction;
  $('plan').textContent = openingAction ? t(opening.question) : '';
  $('opening-action').replaceChildren(...(openingAction ? [actionButton({ ...openingAction, primary: true, run: () => {
    if (opening.intent) r.intent = opening.intent;
    openingAction.run();
  } })] : []));
  $('entry-hall').hidden = openingAction?.id === 'hall';

  let featured;
  const consoleCommand = r.phase === 'play' && !r.review && r.console ? options.find((option) => option.primary) : null;
  $('console-action').replaceChildren(...(consoleCommand ? [actionButton(consoleCommand)] : []));
  const recapOptions = r.review || r.phase !== 'play' ? options : [];
  $('recap-actions').replaceChildren(...recapOptions.map(actionButton));
  const showLate = r.phase === 'play' && r.syncMissed && !r.review && !r.console;
  const lateAlt = showLate && available('go-reply') ? available('voices') : null;
  const lateRewind = { title: '다음 회차 준비하기', cost: '시간 유지', run: reviewNight };
  if (r.phase === 'play' && !r.review && !r.console && !openingAction) {
    const planned = connectionRoute();
    if (showLate) featured = available('signal') || available('go-reply') || available('voices') || lateRewind;
    else if (hasLiveCall()) featured = available('both') || available('signal') || available('voices');
    else if (r.intent === 'mystery') featured = available('review-mystery') || available('hear-reply-roof') || available('read-airlog');
    else if (available('recheck-clock')) featured = (r.room === 'archive' && !knows('airlog') && available('read-airlog')) || available('recheck-clock');
    else if (planned && !planned.feasible) featured = available('prepare-rewind');
    else if (planned?.next) featured = available(planned.next.id);
    if (!featured && r.room === 'hall') featured = r.elapsed < CART_ARRIVES ? available('wait') : available('carry-to-studio') || available('search-cart');
    if (!featured && r.room === 'roof') featured = available('reserve-relay') || available('wait-event')
      || (r.intent === 'contact' && (available('compare') || (!knows('relay') && available('inspect-relay'))));
    if (!featured && r.room === 'archive' && r.intent === 'connect') featured = available('read-routing') || (!knows('label') && available('ask-mira'));
  }
  $('late-contact').hidden = !showLate;
  const lateActions = [lateAlt && { ...lateAlt, detail: '', cost: '송출 1행동' }, showLate && featured !== lateRewind && lateRewind].filter(Boolean);
  $('late-contact-actions').hidden = !lateActions.length;
  $('late-contact-actions').replaceChildren(...lateActions.map(actionButton));
  const featuredSlot = $('featured-action');
  featuredSlot.hidden = !featured;
  featuredSlot.replaceChildren(...(featured ? [actionButton({ ...featured, primary: true })] : []));
  const rest = options.filter((option) => option !== featured && (!option.id || option.id !== openingAction?.id) && option !== consoleCommand
    && option !== lateAlt && !recapOptions.includes(option));
  $('actions').hidden = !rest.length;
  $('actions').replaceChildren(...rest.map((option) => actionButton({ ...option, primary: featured ? false : option.primary })));
}

function render() {
  const r = game.run;
  const left = LIMIT - r.elapsed;
  $('objective').textContent = t(transmission ? '한려 FM의 마지막 방송' : objective());
  $('clock').textContent = time(transmission ? r.onAirAt : r.elapsed);
  $('budget').textContent = transmission ? t('송출 중') : fmt('남은 행동 {0}회', left);
  document.querySelector('.hud').dataset.urgent = String(left <= 2 && r.phase === 'play');
  $('beats').replaceChildren(...Array.from({ length: LIMIT }, (_, index) => element('span', '', index < left ? 'on' : '')));
  $('cycle').textContent = fmt('{0}회차', game.loop);
  $('journal-count').textContent = game.known.length;
  renderSoundControls();
  const hasStarted = r.elapsed > 0 || game.loop > 1;
  const canMove = hasStarted && r.phase === 'play' && !r.review && !r.console;
  $('rewind').hidden = r.phase !== 'play' || r.elapsed === 0 || r.review || Boolean(r.console);
  $('quick').hidden = !hasStarted || Boolean(transmission) || (hasLiveCall() && Boolean(r.console));
  $('quick-places').disabled = !canMove;
  $('quick-review').disabled = !r.elapsed || (r.phase === 'play' && Boolean(r.console));
  $('quick-review').textContent = t('회차 기록');
  document.body.classList.toggle('quick-active', hasStarted && !transmission);
  renderScene();
  renderReceiver();
  renderTransmission();
  renderTimeline();
  renderReadiness();
  renderBroadcast();
  renderRecap();
  renderHints();

  const advanceNight = {
    title: '23:52로 되감기', detail: '발견한 단서와 결말을 가지고 돌아갑니다.', primary: true, cost: '', run: rewind,
  };
  const options = transmission ? [] : r.review ? [advanceNight, {
    title: '이번 밤 계속하기', detail: '남은 행동을 그대로 이어갑니다.', cost: '시간 유지', run: () => {
      r.review = false;
      update();
    },
  }] : r.phase === 'play' ? choices() : [advanceNight];
  renderActions(options);

  $('locations').hidden = !canMove;
  renderPlaces('places', enter);

  $('ending-count').textContent = game.unlocked.length + ' / ' + Object.keys(endings).length;
  $('epilogue-open').hidden = !epilogueUnlocked() || Boolean(transmission);
  $('ending-list').replaceChildren(...Object.entries(endings).map(([id, ending], index) => {
    const item = element('li');
    if (!game.unlocked.includes(id)) {
      item.append(element('span', fmt('미발견 결말 {0}', index + 1)));
    } else {
      const button = element('button', ending.title, 'ending-link');
      button.type = 'button';
      button.addEventListener('click', () => {
        $('record-title').textContent = t(ending.title);
        $('record-story').textContent = t(endingFor(id, game.storyReplies.includes(id)).story);
        showGameDialog('record');
      });
      item.append(button);
    }
    return item;
  }));
}

let selectedEvidence = {};
let pairFeedback = '';
let journalCommand = '';

function renderDeduction() {
  const discovered = Object.entries(evidence).filter(([, item]) => knows(item.clue));
  $('deduction').hidden = !discovered.length;
  $('clock-empty').hidden = Boolean(discovered.length);
  if ($('deduction').hidden) return;
  const failed = latestFailedReservation();
  const r = game.run;
  const paired = game.matches.flatMap((event) => {
    const pair = discovered.map(([, item]) => item).filter((item) => item.event === event);
    if (pair.length !== 2) return [];
    return [element('li', fmt('같은 {0} · 이쪽 {1} / 건너편 {2}', t(event === 'bell' ? '종소리' : '방송 멘트'), pair[0].time, pair[1].time))];
  });
  $('clock-recovery').hidden = !failed && !paired.length;
  $('failed-time').textContent = failed ? fmt('{0} 예약 실패 · 연결한 기록의 시각을 다시 비교하세요.', time(failed)) : t('연결한 시계 기록');
  $('paired-clocks').replaceChildren(...paired);
  const hypothesisStage = $('hypothesis-stage');
  const hypothesisSlot = $(failed ? 'retry-hypothesis' : 'normal-hypothesis');
  if (hypothesisStage.parentElement !== hypothesisSlot) hypothesisSlot.append(hypothesisStage);
  $('journal-airlog').hidden = !failed || knows('airlog') || r.room === 'archive' || r.phase !== 'play'
    || r.review || Boolean(r.console) || r.elapsed > LIMIT - 2;
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
        $('clock-evidence').querySelector('[data-evidence="' + id + '"]').focus({ preventScroll: true });
      });
      column.append(card);
      if (item.clip) {
        const replay = listenButton(item.clip, item.replay);
        replay.dataset.evidenceAudio = id;
        column.append(replay);
      }
    }
    return column;
  }));
  $('pair-evidence').disabled = !selectedEvidence.local || !selectedEvidence.remote;
  $('pair-result').textContent = t(pairFeedback || (game.matches.length === 2
    ? '두 사건 모두 같은 시차를 보여 줍니다.'
    : game.matches.length ? '연결한 기록의 시각으로 가설을 세우세요. 다른 사건으로도 확인할 수 있습니다.' : ''));
  $('hypothesis-stage').hidden = !game.matches.length;
  renderReservation('journal-reservation-status');
  const reserved = reservationPlan();
  const onRoof = r.room === 'roof';
  const canTravel = reserved.proposed > r.elapsed + 1 && (!reserved.actual || reserved.actual > r.elapsed + 1);
  const resumeConnection = r.phase === 'play' && r.elapsed === 0 && Boolean(failed) && r.clockReviewed && clockRetryIntent() === 'connect';
  $('clock-resume').hidden = !resumeConnection;
  const apply = $('journal-reserve');
  apply.hidden = resumeConnection || !reserved.canApply || Boolean(failed && reserved.proposed === failed) || (!onRoof && !canTravel);
  apply.dataset.command = onRoof ? 'reserve' : 'roof';
  apply.textContent = t(!onRoof ? '옥상 송신실로 이동 · 1행동'
    : reserved.actual ? '옥상 송신기의 예약 변경 · 1행동' : '옥상 송신기에서 예약하기 · 1행동');
  if (!game.matches.length) return;

  $('hypotheses').replaceChildren(...Object.entries(hypotheses).map(([id, hypothesis]) => {
    const button = element('button', hypothesis.label, 'utility');
    button.type = 'button';
    button.dataset.hypothesis = id;
    button.setAttribute('aria-pressed', String(game.hypothesis === id));
    button.addEventListener('click', () => {
      if (failed) r.clockReviewed = hypothesis.local !== failed;
      game.hypothesis = id;
      save();
      render();
      renderDeduction();
      $('hypotheses').querySelector('[aria-pressed="true"]').focus();
    });
    return button;
  }));
  const proposed = hypotheses[game.hypothesis]?.local;
  $('hypothesis-result').textContent = !proposed ? t('건너편의 다음 교신은 23:58입니다. 연결한 기록을 근거로 가설을 고르세요.')
    : proposed === failed ? fmt('이 가설은 실패한 {0} 예약과 같습니다. 기록을 비교해 가설을 다시 고르세요.', time(failed))
      : fmt('가설대로라면 건너편 23:58은 이쪽 {0}입니다. 옥상 송신기에서 시험하세요.', time(proposed));
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
  const unpaired = Object.entries(evidence).find(([, item]) => item.side === 'local' && knows(item.clue)
    && !game.matches.includes(item.event)
    && Object.values(evidence).some((other) => other.side === 'remote' && other.event === item.event && knows(other.clue)));
  const next = unpaired ? $('clock-evidence').querySelector('[data-evidence="' + unpaired[0] + '"]')
    : $('hypotheses').querySelector('[aria-pressed="true"]') || $('hypotheses').querySelector('button');
  next.scrollIntoView({ block: 'nearest' });
  next.focus({ preventScroll: true });
}

const mysteryAnswers = [
  ['aired', '건너편에서도 이미 순임의 인터뷰를 방송했다.', '편성표의 인터뷰 칸은 비어 있습니다. 윤서가 아직 찾고 있는 것이 무엇인지 확인해 보세요.'],
  ['missing', '건너편에는 원본이 없어 순임의 인터뷰를 방송하지 못했다.', ''],
  ['clock', '두 시계의 차이 때문에 편성표에서 인터뷰가 사라졌다.', '시차로는 비어 있는 편성표와 윤서가 원본을 찾은 이유를 함께 설명하기 어렵습니다.'],
];

function renderBroadcastMystery() {
  const found = mysteryEvidence.filter(knows);
  $('broadcast-mystery').hidden = !found.length;
  if (!found.length) return;
  $('mystery-evidence').replaceChildren(...found.map((id) => {
    const item = element('li');
    item.append(element('strong', clues[id].title), element('p', clues[id].fact));
    if (clues[id].clip) item.append(listenButton(clues[id].clip, '건너편 호출 듣기'));
    return item;
  }));
  const ready = found.length === mysteryEvidence.length;
  $('mystery-prompt').hidden = game.storySolved;
  $('mystery-prompt').textContent = t(ready ? '두 단서를 연결해 보세요. 건너편 윤서는 왜 원본을 찾았을까요?'
    : knows('remoteSlot') ? '아직 비교할 기록이 하나 부족합니다. 23:57에 열리는 교신을 확인해 보세요.'
      : '아직 비교할 기록이 하나 부족합니다. 자료실에서 건너편 방송 일지를 찾아보세요.');
  $('mystery-feedback').textContent = game.storySolved
    ? t('두 단서를 연결했습니다. 건너편 윤서는 순임의 방송을 부탁하려 했습니다. 이제 교신에 답하면 윤서의 마지막 응답이 달라집니다.') : '';
  $('mystery-answers').replaceChildren(...(ready && !game.storySolved ? mysteryAnswers.map(([id, label, feedback]) => {
    const button = element('button', label, 'utility');
    button.type = 'button';
    button.dataset.answer = id;
    button.addEventListener('click', () => {
      if (feedback) {
        $('mystery-feedback').textContent = t(feedback);
        return;
      }
      game.storySolved = true;
      if (game.run.phase === 'play') observe('편성표의 빈칸과 교신을 연결해 윤서가 원본을 찾은 이유를 알아냈다.');
      save();
      render();
      renderBroadcastMystery();
      $('mystery-feedback').focus();
    });
    return button;
  }) : []));
}

const journalTabs = ['clock', 'story', 'audio'];
let journalTab = 'story';

function selectJournalTab(tab, focus = false) {
  journalTab = tab;
  for (const id of journalTabs) {
    const active = id === tab;
    const button = $(`tab-${id}`);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    $(`journal-${id}`).hidden = !active;
  }
  $('journal').scrollTop = 0;
  if (focus) $(`tab-${tab}`).focus({ preventScroll: true });
}

function openJournal(requestedTab) {
  selectedEvidence = {};
  pairFeedback = '';
  renderDeduction();
  renderBroadcastMystery();
  $('clues').replaceChildren(...game.known.filter((id) => !mysteryEvidence.includes(id)).map((id) => {
    const { title, fact, question } = clues[id];
    const item = element('li');
    item.append(element('h3', title), element('p', fact), element('p', question, 'question'));
    return item;
  }));
  $('journal-recordings').replaceChildren(...game.known.filter((id) => clues[id].clip).map((id) => {
    const { title, fact, clip } = clues[id];
    const item = element('li');
    item.append(element('h3', title), element('p', fact), listenButton(clip, '녹음 듣기'));
    return item;
  }));
  selectJournalTab(journalTabs.includes(requestedTab) ? requestedTab : journalTab);
  showGameDialog('journal');
  $('journal').scrollTop = 0;
}

function openClockReview() {
  openJournal('clock');
  const summary = $('clock-recovery').hidden ? $('deduction-title') : $('clock-recovery');
  summary.scrollIntoView({ block: 'nearest' });
  summary.focus({ preventScroll: true });
}

function openMystery() {
  openJournal('story');
  $('mystery-title').focus({ preventScroll: true });
}

function continueMystery() {
  if (!needsMystery() || transmission || game.run.phase === 'play') return;
  if (knows('remoteSlot')) openMystery();
  else rewind('mystery');
}

function renderPierLinks() {
  const pier = game.pier;
  const label = pier.answer ? '선착장 외전 다시 보기' : pier.heard ? '선착장 외전 이어하기' : '선착장 외전 시작';
  const available = pierUnlocked() && !transmission;
  $('pier-open').hidden = !available;
  $('recap-pier').hidden = !available || game.run.phase === 'play';
  for (const id of ['pier-open', 'recap-pier', 'pier-from-epilogue']) $(id).textContent = t(label);
}

function openEpilogue() {
  if (!epilogueUnlocked() || transmission) return;
  game.epilogueSeen = true;
  save();
  renderRecap();
  $('epilogue-transcript').textContent = t(epilogueTranscript);
  $('epilogue').querySelector('.epilogue-content').scrollTop = 0;
  showGameDialog('epilogue');
  if (game.sound) playClip('epilogue');
}

const pierMinutes = ({ heard, checked, answer }) => Number(heard) + checked.length + Number(Boolean(answer));

function renderPier() {
  const pier = game.pier;
  const minute = pierMinutes(pier);
  $('pier-clock').textContent = `00:0${minute}`;
  $('pier-budget').textContent = fmt('남은 행동 {0}회', PIER_LIMIT - minute);
  const lastObservation = pierObservations[pier.checked.at(-1)];
  $('pier-narration').textContent = t(pier.answer ? pierAnswers[pier.answer][1] : lastObservation?.[1] || (pier.heard ? pierCall : pierOpening));
  const replay = pier.answer === 'intercom' ? listenButton('pierAnswer', '은주의 응답 다시 듣기')
    : pier.heard && !pier.answer ? listenButton('pierCall', '선착장에 들린 목소리 재생') : null;
  $('pier-replay').replaceChildren(...(replay ? [replay] : []));
  const earlierNotes = pier.answer ? pier.checked : pier.checked.slice(0, -1);
  $('pier-notes').hidden = !earlierNotes.length;
  $('pier-notes').replaceChildren(...earlierNotes.map((id) => element('li', pierObservations[id][1])));
  const choosing = !pier.answer && pier.checked.length === 2;
  $('pier-prompt').textContent = t(choosing ? '마지막 행동입니다. 이 목소리는 어디에서 왔을까요?'
    : pier.heard && !pier.answer ? '목소리의 출처를 확인할 단서를 두 곳에서 찾으세요.' : '');
  const options = pier.answer ? [['restart', '자정부터 다시 조사하기']]
    : !pier.heard ? [['listen', '선착장 라디오 켜기']]
      : Object.entries(choosing ? pierAnswers : pierObservations)
        .filter(([id]) => choosing || !pier.checked.includes(id)).map(([id, [title]]) => [id, title]);
  $('pier-actions').replaceChildren(...options.map(([id, label]) => {
    const button = element('button', label, 'utility');
    button.type = 'button';
    button.dataset.pierAction = id;
    button.addEventListener('click', () => takePierAction(id));
    return button;
  }));
}

function takePierAction(id) {
  if (!$('pier').open) return;
  const pier = game.pier;
  let clip = '';
  if (pier.answer && id === 'restart') game.pier = { ...newPierRun(), completed: pier.completed };
  else if (!pier.heard && id === 'listen') {
    pier.heard = true;
    clip = 'pierCall';
  } else if (pier.heard && !pier.answer && pier.checked.length < 2 && Object.hasOwn(pierObservations, id) && !pier.checked.includes(id)) {
    pier.checked.push(id);
  } else if (!pier.answer && pier.checked.length === 2 && Object.hasOwn(pierAnswers, id)) {
    pier.answer = id;
    if (id === 'intercom') {
      pier.completed = true;
      clip = 'pierAnswer';
    }
  } else return;
  save();
  renderPierLinks();
  stopSceneAudio();
  renderPier();
  $('pier-narration').focus({ preventScroll: true });
  $('pier-narration').scrollIntoView({ block: 'nearest' });
  if (game.sound && clip) playClip(clip);
}

function openPier() {
  if (!pierUnlocked() || transmission) return;
  if ($('epilogue').open) $('epilogue').close();
  renderPier();
  showGameDialog('pier');
  $('pier').scrollTop = 0;
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
  showGameDialog('share');
}

const transferFormat = 'hallyeo-fm-save';
const transferLimit = 512 * 1024;
let pendingTransfer = null;
let transferRead = 0;
let audioPackReady = false;
let audioPackAvailable = false;
let audioPackBusy = false;
let audioPackCheck = 0;

function renderMixSettings() {
  for (const input of $('settings').querySelectorAll('[data-mix]')) {
    const value = game.mix[input.dataset.mix];
    input.value = value;
    input.nextElementSibling.textContent = `${value}%`;
    input.setAttribute('aria-valuetext', `${value}%`);
  }
}

function offlineAudioSupported() {
  return location.protocol !== 'file:' && 'caches' in window && 'serviceWorker' in navigator;
}

function renderOfflineAudio(message = '') {
  const button = $('offline-audio-toggle');
  button.hidden = !audioPackAvailable;
  button.disabled = audioPackBusy;
  button.textContent = t(audioPackReady ? '저장된 음성 삭제' : '오프라인 음성 저장');
  const status = message || (location.protocol === 'file:' ? '이 HTML 파일에 음성이 포함되어 있습니다.'
    : !audioPackAvailable ? '이 브라우저에서 오프라인 음성 저장을 사용할 수 없습니다.'
      : audioPackReady ? '음성 저장 완료. 인터넷 연결 없이 녹음을 재생할 수 있습니다.'
        : '녹음 파일을 내려받습니다. 필요한 공간은 약 5MB입니다.');
  $('offline-audio-status').textContent = t(status);
}

async function refreshOfflineAudio() {
  if (audioPackBusy) return;
  const check = ++audioPackCheck;
  let available = false;
  let ready = false;
  if (offlineAudioSupported()) {
    try {
      available = Boolean((await navigator.serviceWorker.getRegistration())?.active);
      if (available) {
        const stored = await Promise.all(Object.values(voices).map((path) => caches.match(path, { cacheName: AUDIO_CACHE })));
        ready = stored.every(Boolean);
      }
    } catch {
      available = false;
    }
  }
  if (check !== audioPackCheck) return;
  audioPackAvailable = available;
  audioPackReady = ready;
  renderOfflineAudio();
}

async function toggleOfflineAudio() {
  if (audioPackBusy || !audioPackAvailable) return;
  audioPackCheck += 1;
  audioPackBusy = true;
  let failure = '';
  const removing = audioPackReady;
  renderOfflineAudio(removing ? '저장한 음성을 지우는 중입니다.' : '오프라인 음성을 저장하는 중입니다.');
  try {
    if (removing) {
      await caches.delete(AUDIO_CACHE);
      recordings.clear();
      audioPackReady = false;
    } else {
      const cache = await caches.open(AUDIO_CACHE);
      await cache.addAll(Object.values(voices));
      audioPackReady = true;
    }
  } catch {
    failure = removing ? '저장한 음성을 지우지 못했습니다. 다시 시도해 주세요.'
      : '음성을 저장하지 못했습니다. 연결과 저장 공간을 확인한 뒤 다시 시도해 주세요.';
  } finally {
    audioPackBusy = false;
    renderOfflineAudio(failure || (removing ? '이 기기에서 저장한 음성을 지웠습니다.' : ''));
  }
}

function exportProgress() {
  const { sound, mix, language, ...data } = game;
  const savedAt = new Date().toISOString();
  const file = new Blob([JSON.stringify({ format: transferFormat, version: 1, savedAt, data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hallyeo-fm-${savedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('transfer-status').textContent = t('진행 파일을 만들었습니다.');
}

function importedGame(file) {
  const data = file?.data;
  const run = data?.run;
  if (file?.format !== transferFormat || file.version !== 1 || !data || !run) return null;
  if (!Number.isInteger(data.version) || data.version < 2 || data.version > game.version
    || !Number.isSafeInteger(data.loop) || data.loop < 1
    || !Array.isArray(data.known) || !data.known.every((id) => typeof id === 'string' && Object.hasOwn(clues, id))
    || !Array.isArray(data.unlocked) || !data.unlocked.every((id) => typeof id === 'string' && Object.hasOwn(endings, id))) return null;
  if (!Object.hasOwn(rooms, run.room) || !Number.isInteger(run.elapsed) || run.elapsed < 0 || run.elapsed > LIMIT
    || !['play', 'expired', 'ending'].includes(run.phase) || (run.phase === 'play' ? run.elapsed === LIMIT : run.elapsed !== LIMIT)
    || !['', 'carried', 'delivered'].includes(run.tape) || !['', 'voices', 'signal', 'both'].includes(run.console)
    || (run.phase === 'ending' && !Object.hasOwn(endings, run.ending))
    || !Number.isInteger(run.tuneAt) || run.tuneAt < 0 || run.tuneAt > LIMIT) return null;
  if (!['message', 'speaker', 'event', 'clip'].every((field) => typeof run[field] === 'string' && run[field].length <= 3000)
    || (run.clip && !Object.hasOwn(voices, run.clip))
    || !Array.isArray(run.used) || !run.used.every((id) => typeof id === 'string')
    || !Array.isArray(run.log) || run.log.length > 200 || !run.log.every((item) => item
      && Number.isInteger(item.minute) && item.minute >= 0 && item.minute <= LIMIT
      && typeof item.text === 'string' && item.text.length <= 3000
      && Array.isArray(item.args) && item.args.every((value) => typeof value === 'string'))) return null;
  if (!['courier', 'dj', 'linked', 'review', 'consoleReady', 'syncMissed'].every((field) => typeof run[field] === 'boolean')) return null;
  if (run.phase === 'play' && run.console === 'both' && (!run.dj || !run.linked || run.tape !== 'delivered'
    || run.elapsed !== REPLY_WINDOW + Number(run.consoleReady))) return null;
  return restoreGame(data);
}

function renderTransfer() {
  $('transfer-preview').hidden = !pendingTransfer;
  if (!pendingTransfer) return;
  $('transfer-rounds').replaceChildren(...[['이 기기', game], ['불러온 파일', pendingTransfer]].map(([name, source]) => {
    const row = element('div');
    const description = `${fmt('{0}회차', source.loop)} · ${time(source.run.elapsed)} · ${t(rooms[source.run.room].name)}`;
    row.append(element('dt', name), element('dd', description));
    return row;
  }));
  const newClues = pendingTransfer.known.filter((id) => !game.known.includes(id)).length;
  const newEndings = pendingTransfer.unlocked.filter((id) => !game.unlocked.includes(id)).length;
  $('transfer-summary').textContent = fmt('두 기록을 합치면 단서 {0}개와 결말 {1}개가 추가됩니다.', newClues, newEndings);
}

async function readProgress(file) {
  const attempt = ++transferRead;
  pendingTransfer = null;
  renderTransfer();
  if (!file) return;
  $('transfer-status').textContent = t('진행 파일을 읽는 중입니다.');
  let incoming = null;
  if (file.size <= transferLimit) {
    try { incoming = importedGame(JSON.parse(await file.text())); } catch { /* An invalid file leaves the current game intact. */ }
  }
  if (attempt !== transferRead || !$('settings').open) return;
  pendingTransfer = incoming;
  $('transfer-status').textContent = incoming ? '' : t('이 진행 파일을 읽을 수 없습니다. 이 기기의 진행 기록은 그대로입니다.');
  renderTransfer();
  if (incoming) {
    $('transfer-preview-title').focus({ preventScroll: true });
    $('transfer-preview').scrollIntoView({ block: 'start' });
  }
}

function mergeProgress(useFileRun) {
  if (!pendingTransfer) return;
  const incoming = pendingTransfer;
  const selected = useFileRun ? incoming : game;
  const union = (current, transferred) => [...new Set([...current, ...transferred])];
  stopSceneAudio();
  Object.assign(game, {
    loop: selected.loop, run: selected.run, hypothesis: selected.hypothesis,
    previousLoop: selected.previousLoop, nextQuestion: selected.nextQuestion,
    known: union(game.known, incoming.known), unlocked: union(game.unlocked, incoming.unlocked),
    matches: union(game.matches, incoming.matches), storyReplies: union(game.storyReplies, incoming.storyReplies),
    storySolved: game.storySolved || incoming.storySolved, epilogueSeen: game.epilogueSeen || incoming.epilogueSeen,
    pier: { ...selected.pier, completed: game.pier.completed || incoming.pier.completed },
  });
  pendingTransfer = null;
  renderTransfer();
  render();
  syncAmbience();
  $('transfer-status').textContent = t(save() ? '선택한 회차를 이어 할 수 있습니다. 단서와 결말을 합쳤습니다.'
    : '단서와 결말을 이번 세션에 합쳤습니다. 기기 저장이 어려우면 진행 파일을 내보내세요.');
  $('import-save').focus();
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
$('journal-tabs').addEventListener('click', ({ target }) => {
  const tab = target.closest('[data-tab]');
  if (tab) selectJournalTab(tab.dataset.tab, true);
});
$('journal-tabs').addEventListener('keydown', (event) => {
  const index = journalTabs.indexOf(event.target.dataset.tab);
  const previous = (index + journalTabs.length - 1) % journalTabs.length;
  const next = (index + 1) % journalTabs.length;
  const destination = { ArrowLeft: previous, ArrowRight: next, Home: 0, End: journalTabs.length - 1 }[event.key];
  if (index < 0 || destination === undefined) return;
  event.preventDefault();
  selectJournalTab(journalTabs[destination], true);
});
$('quick-places').addEventListener('click', openPlaces);
$('places-close').addEventListener('click', () => $('places-dialog').close());
$('places-dialog').addEventListener('close', () => {
  if (placeChoice) {
    const destination = placeChoice;
    placeChoice = '';
    placeScroll = undefined;
    enter(destination);
    return;
  }
  if (!placeScroll) return;
  $('quick-places').focus({ preventScroll: true });
  document.querySelector('main').scrollTop = placeScroll.main;
  window.scrollTo(0, placeScroll.page);
  placeScroll = undefined;
});
$('quick-review').addEventListener('click', reviewNight);
$('journal-close').addEventListener('click', () => $('journal').close());
$('clock-resume').addEventListener('click', () => {
  $('journal').close();
  $('opening-action').querySelector('button')?.focus({ preventScroll: true });
});
$('journal-reserve').addEventListener('click', ({ currentTarget }) => {
  journalCommand = currentTarget.dataset.command;
  $('journal').close();
});
$('journal-airlog').addEventListener('click', () => {
  journalCommand = 'archive';
  $('journal').close();
});
$('record-close').addEventListener('click', () => $('record').close());
$('epilogue-open').addEventListener('click', openEpilogue);
$('recap-epilogue').addEventListener('click', openEpilogue);
$('recap-mystery').addEventListener('click', continueMystery);
$('epilogue-close').addEventListener('click', () => $('epilogue').close());
$('epilogue-replay').addEventListener('click', () => playClip('epilogue'));
$('epilogue').addEventListener('close', () => {
  renderRecap();
  if (document.activeElement === document.body && !$('recap').hidden) $('recap').focus({ preventScroll: true });
});
$('pier-open').addEventListener('click', openPier);
$('recap-pier').addEventListener('click', openPier);
$('pier-from-epilogue').addEventListener('click', openPier);
$('pier-close').addEventListener('click', () => $('pier').close());
$('pier').addEventListener('close', () => {
  const trigger = $('recap').hidden ? $('pier-open') : $('recap-pier');
  if (document.activeElement === document.body && !trigger.hidden) trigger.focus({ preventScroll: true });
});
$('settings-open').addEventListener('click', () => {
  renderMixSettings();
  showGameDialog('settings');
  refreshOfflineAudio();
});
$('settings-close').addEventListener('click', () => $('settings').close());
$('settings').addEventListener('close', () => {
  transferRead += 1;
  pendingTransfer = null;
  renderTransfer();
  $('transfer-status').textContent = '';
});
$('settings').addEventListener('input', ({ target }) => {
  if (!target.matches('input[data-mix]')) return;
  game.mix[target.dataset.mix] = Number(target.value);
  applyMix();
  syncAmbience();
  renderMixSettings();
  save();
});
$('offline-audio-toggle').addEventListener('click', toggleOfflineAudio);
if (offlineAudioSupported()) navigator.serviceWorker.addEventListener('controllerchange', () => {
  if ($('settings').open) refreshOfflineAudio();
});
$('export-save').addEventListener('click', exportProgress);
$('import-save').addEventListener('click', () => $('save-file').click());
$('save-file').addEventListener('change', ({ target }) => {
  readProgress(target.files[0]);
  target.value = '';
});
$('keep-device-run').addEventListener('click', () => mergeProgress(false));
$('use-file-run').addEventListener('click', () => mergeProgress(true));
$('cancel-transfer').addEventListener('click', () => {
  pendingTransfer = null;
  renderTransfer();
  $('transfer-status').textContent = t('불러오기를 취소했습니다.');
  $('import-save').focus();
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => {
  if (!['prologue', 'places-dialog'].includes(dialog.id) && !document.querySelector('dialog[open]')) stopSceneAudio();
  if (dialog.id === 'journal' && journalCommand) {
    const command = journalCommand;
    journalCommand = '';
    if (command === 'reserve') reserveRelay();
    else enter(command);
  }
  syncAmbience();
});

function pauseHiddenAudio() {
  stopSceneAudio();
  stopAmbience();
  $('intro-video').pause();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseHiddenAudio();
  else syncAmbience();
});
window.addEventListener('pagehide', pauseHiddenAudio);
window.addEventListener('pageshow', () => { if (soundContext) syncAmbience(); });
$('prologue-start').addEventListener('click', () => finishPrologue());
$('prologue').addEventListener('cancel', (event) => {
  event.preventDefault();
  finishPrologue();
});
$('prologue-sound').addEventListener('click', () => {
  if (!prologue) return;
  toggleSoundPreference();
  if (game.sound) playPrologueSound();
  else stopClip();
});
$('prologue-replay').addEventListener('click', () => {
  $('settings').close();
  startPrologue(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pausePrologue();
  else resumePrologue();
});
window.addEventListener('pagehide', pausePrologue);
window.addEventListener('pageshow', resumePrologue);
$('rewind').addEventListener('click', reviewNight);
$('exchange-replay').addEventListener('click', replayExchange);
$('solo-replay').addEventListener('click', () => playClip('callWithQuestion'));
$('routing-panel').addEventListener('change', chooseRoute);
$('hint-toggle').addEventListener('click', () => {
  if (!hintState.topic) return;
  hintState.open = !hintState.open;
  if (hintState.open && !hintState.level) hintState.level = 1;
  renderHints();
});
$('hint-more').addEventListener('click', () => {
  if (!hintState.open || hintState.level >= 3) return;
  hintState.level += 1;
  renderHints();
  if (hintState.level === 3) {
    const lastHint = $('hint-list').lastElementChild;
    lastHint.tabIndex = -1;
    lastHint.focus({ preventScroll: true });
    lastHint.scrollIntoView({ block: 'nearest' });
  }
});
$('receiver-dial').addEventListener('input', tuneReceiver);
$('entry-hall').addEventListener('click', () => { if (openingReceiverHere()) enter('hall'); });
$('receiver-replay').addEventListener('click', () => playClip('receiverEcho'));
$('transmission-skip').addEventListener('click', () => closeTransmission(true));
drawSignal($('tape-wave'), [22, 63, 87, 49, 71, 43, 91, 68, 38, 55, 28, 14]);
drawSignal($('remote-wave'), [16, 42, 64, 37, 52, 91, 70, 31, 79, 56, 68, 24]);
const utilityMenu = $('utility-menu');
const menuSummary = utilityMenu.querySelector('summary');
utilityMenu.addEventListener('click', ({ target }) => {
  if (!target.closest('.utility-panel button')) return;
  utilityMenu.open = false;
  menuSummary.focus({ preventScroll: true });
});
utilityMenu.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !utilityMenu.open) return;
  event.preventDefault();
  utilityMenu.open = false;
  menuSummary.focus({ preventScroll: true });
});
document.addEventListener('pointerdown', ({ target }) => {
  if (utilityMenu.open && !utilityMenu.contains(target)) utilityMenu.open = false;
});
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
function toggleSoundPreference() {
  game.sound = !game.sound;
  save();
  renderSoundControls();
}

$('sound').addEventListener('click', () => {
  toggleSoundPreference();
  syncAmbience();
  if (!game.sound) stopSceneAudio();
  else if (transmission) playTransmissionVoice();
  else if (openingReceiverHere() && game.run.receiverTuned) listenToBand();
  else if (openingReceiverHere() && !speaking) playClip('openingEcho');
  else playSceneVoice();
});

function renderLanguage() {
  document.documentElement.lang = game.language;
  document.title = t('마지막 방송까지 8분');
  const english = game.language === 'en';
  $('language').textContent = english ? '한국어' : 'English';
  $('language').lang = english ? 'ko' : 'en';
  $('language').setAttribute('aria-label', english ? '한국어로 전환' : 'Switch to English');
  document.querySelectorAll('[data-text]').forEach((node) => { node.textContent = t(node.dataset.text); });
  document.querySelectorAll('[data-label]').forEach((node) => { node.setAttribute('aria-label', t(node.dataset.label)); });
}

save();
renderLanguage();
render();
if (!game.prologueSeen) startPrologue();
