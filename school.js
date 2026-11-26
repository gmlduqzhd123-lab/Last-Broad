'use strict';

const LIMIT = 8;
const CUE_TIME = 4;
const INTRO_LENGTH = 20000;
const SAVE_KEY = 'hallyeo-fm-quiz-final-v1';
const AUDIO = {
  future: 'future-review', opening: 'opening', leak: 'answer', door: 'door',
  question: 'question', hold: 'hold', backup: 'backup', clean: 'clean', student: 'student',
  handoffKnown: 'handoff-known', holdKnown: 'hold-known', backupKnown: 'backup-known',
};
const CLUES = {
  future: { title: 'futureClue', fact: 'futureFact', caption: 'future', clip: 'future' },
  leak: { title: 'leakClue', fact: 'leakFact', caption: 'leakClip', clip: 'leak' },
  mic: { title: 'micClue', fact: 'micFact' },
  schedule: { title: 'scheduleClue', fact: 'scheduleFact' },
  practice: { title: 'practiceClue', fact: 'practiceFact', caption: 'leakClip', clip: 'leak' },
  door: { title: 'doorClue', fact: 'doorFact', caption: 'doorClip', clip: 'door' },
  proof: { title: 'proofClue', fact: 'proofFact' },
};
const ENDINGS = {
  held: { title: 'endHeldTitle', caption: 'endHeldCaption', story: 'endHeldStory', next: 'endHeldNext', clip: 'hold' },
  backup: { title: 'endBackupTitle', caption: 'endBackupCaption', story: 'endBackupStory', next: 'endBackupNext', clip: 'backup' },
  clean: { title: 'endCleanTitle', caption: 'endCleanCaption', story: 'endCleanStory', next: 'endCleanNext', clip: 'clean' },
};
const EXPLAINED_ENDINGS = {
  held: { caption: 'endHeldKnownCaption', story: 'endHeldKnownStory', next: 'endHeldKnownNext', clip: 'holdKnown' },
  backup: { caption: 'endBackupKnownCaption', story: 'endBackupKnownStory', clip: 'backupKnown' },
};
const INTRO_SHOTS = [
  { at: 0, clock: '12:40', shot: 'future', caption: 'introHook' },
  { at: 900, clock: '12:40', shot: 'future', caption: 'future', clip: 'future' },
  { at: 10600, clock: '12:32', shot: 'shift', caption: 'introShift' },
  { at: 12100, clock: '12:32', shot: 'studio', caption: 'opening', clip: 'opening' },
  { at: 16900, clock: '12:32', shot: 'studio', caption: 'introFinal' },
];

const newRun = () => ({
  elapsed: 0, room: 'studio', mic: true, queued: false, leaked: false, leakMicOff: false,
  assigned: false, backup: false, returned: false, briefed: false,
  previewChecked: false, classroomsReady: false, answersClosed: false, checked: false, winnerCard: false,
  outcome: '', message: '', log: [],
});
const $ = (id) => document.getElementById(id);
const clock = (elapsed) => '12:' + (32 + elapsed);

function load() {
  const fresh = {
    version: 2, loop: 1, known: ['future'], unlocked: [], compared: false, seen: false,
    language: 'ko', sound: false, previous: null, run: newRun(),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || (saved.version !== 1 && saved.version !== fresh.version)) return fresh;
    for (const flag of ['compared', 'seen', 'sound']) fresh[flag] = saved[flag] === true;
    if (saved.language === 'en') fresh.language = 'en';
    if (Number.isSafeInteger(saved.loop) && saved.loop > 0) fresh.loop = saved.loop;
    if (Array.isArray(saved.known)) fresh.known = [...new Set([...fresh.known, ...saved.known.filter((id) => Object.hasOwn(CLUES, id))])];
    if (Array.isArray(saved.unlocked)) fresh.unlocked = [...new Set(saved.unlocked.filter((id) => Object.hasOwn(ENDINGS, id)))];
    const previous = saved.previous;
    if (Number.isInteger(previous?.minute) && previous.minute >= 0 && previous.minute <= LIMIT
      && Object.hasOwn(SCHOOL_COPY, previous.text)) fresh.previous = previous;
    const run = saved.run;
    if (!run || !Number.isInteger(run.elapsed) || run.elapsed < 0 || run.elapsed > LIMIT
      || (run.room !== 'studio' && run.room !== 'hall') || (run.outcome && !Object.hasOwn(ENDINGS, run.outcome))) return fresh;
    fresh.run = { ...fresh.run, ...run };
    if (run.checked) fresh.run.answersClosed = true;
    if (saved.version === 1 && run.queued) fresh.run.briefed = true;
    if (run.leaked && !fresh.known.includes('leak')) fresh.known.push('leak');
    fresh.run.log = Array.isArray(run.log) ? run.log.filter((entry) =>
      Number.isInteger(entry?.minute) && entry.minute >= 0 && entry.minute <= LIMIT && Object.hasOwn(SCHOOL_COPY, entry.text)).slice(-20) : [];
    return fresh;
  } catch {
    return fresh;
  }
}

const game = load();
const langParam = new URLSearchParams(location.search).get('lang');
if (langParam === 'en' || langParam === 'ko') game.language = langParam;
let audio;
let intro;
let monitorSelection;
const selected = new Set();
let comparisonFeedback = '';
let selectedSource = '';

const t = (key, ...args) => (SCHOOL_COPY[key]?.[game.language === 'en' ? 1 : 0] || '').replace(/\{(\d+)\}/g, (_, index) => args[index] ?? '');
const known = (id) => game.known.includes(id);
function learn(id) { if (!known(id)) game.known.push(id); }
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* Play continues with this session’s state. */ }
}
function node(tag, value = '', className = '') {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}
function text(id, key, ...args) { $(id).textContent = t(key, ...args); }

function stopAudio() {
  if (!audio) return;
  audio.pause();
  audio = null;
}
function playAudio(id, explicit = false, after = null) {
  stopAudio();
  if ((!game.sound && !explicit) || !AUDIO[id]) return;
  const player = new Audio('audio/school-' + AUDIO[id] + '.mp3');
  audio = player;
  if (after) player.addEventListener('ended', () => { if (audio === player) after(); }, { once: true });
  player.play().catch(() => { /* Captions provide the same clues when sound is unavailable. */ });
}
function toggleSound() {
  game.sound = !game.sound;
  if (!game.sound) stopAudio();
  save();
  renderSound();
}
function renderSound() {
  for (const id of ['sound', 'intro-sound']) {
    $(id).setAttribute('aria-pressed', String(game.sound));
    text(id, game.sound ? 'soundOn' : 'soundOff');
  }
}

function record(key) { game.run.log.push({ minute: game.run.elapsed, text: key }); }

function endingFor(run) {
  const basic = ENDINGS[run.outcome];
  if (!basic) return null;
  if (run.briefed && EXPLAINED_ENDINGS[run.outcome]) return { ...basic, ...EXPLAINED_ENDINGS[run.outcome] };
  return run.outcome === 'held' && !run.leakMicOff ? { ...basic, story: 'endHeldOther' } : basic;
}

function briefJiu(run) {
  if (!known('proof') || run.briefed) return;
  run.briefed = true;
  record('logBriefed');
}

function finish(kind) {
  const r = game.run;
  r.elapsed = LIMIT;
  r.outcome = kind;
  if (!game.unlocked.includes(kind)) game.unlocked.push(kind);
  record(ENDINGS[kind].title);
  save();
  render();
  $('ending-title').focus();
  playAudio(endingFor(r).clip);
}

function step(message, apply = null, outcome = '') {
  const r = game.run;
  if (r.outcome || r.elapsed >= LIMIT) return;
  monitorSelection = null;
  stopAudio();
  if (apply) apply(r);
  r.elapsed += 1;
  r.message = message;
  if (message) record(message);
  if (r.elapsed === CUE_TIME) {
    if (r.queued) {
      record('logClean');
      r.message = 'cueClean';
      playAudio('question');
    } else {
      r.leaked = true;
      r.leakMicOff = !r.mic;
      learn('mic');
      learn('leak');
      record(r.leakMicOff ? 'logLeakOff' : 'logLeakOn');
      r.message = r.room === 'hall' ? 'incidentHall' : 'incidentScene';
      playAudio('leak', false, () => playAudio('student'));
    }
  }
  if (outcome) { finish(outcome); return; }
  if (r.elapsed === LIMIT) {
    finish(r.queued && r.checked ? 'clean' : 'held');
    return;
  }
  save();
  render();
  $('actions').querySelector('[data-primary="true"]')?.focus({ preventScroll: true });
}

function rewind() {
  const r = game.run;
  const keys = ['logClean', 'logBackup', 'logLeakOff', 'logLeakOn', 'logProof'];
  const moment = r.log.findLast((entry) => keys.includes(entry.text));
  game.previous = moment ?? { minute: r.elapsed, text: 'logNoEnd' };
  game.loop += 1;
  game.run = newRun();
  monitorSelection = null;
  stopAudio();
  $('history').open = false;
  if ($('review-dialog').open) $('review-dialog').close();
  save();
  render();
  window.scrollTo(0, 0);
  $('mission').focus({ preventScroll: true });
}

function mission() {
  const r = game.run;
  if (r.outcome) return 'missionEnd';
  if (r.leaked) {
    if (r.assigned && !r.backup) return 'missionGet';
    if (r.backup && !r.returned) return 'missionReturn';
    if (r.returned) return 'missionUse';
    return 'missionLate';
  }
  if (r.elapsed >= CUE_TIME) return 'missionClean';
  if (r.queued) return 'missionClean';
  if (known('proof')) return 'missionFix';
  if (known('practice') && known('schedule')) return 'missionCompare';
  return 'missionFind';
}

function actionChoices() {
  const r = game.run;
  const choices = [];
  function offer(id, detail, run, free = false) { choices.push({ id, detail, run, free }); }
  if (r.leaked) {
    if (!r.assigned && r.elapsed === CUE_TIME) {
      const explain = known('proof');
      offer('handoff', explain ? 'handoffKnownDetail' : 'handoffDetail', () => {
        step(explain ? 'handoffKnownMessage' : 'handoffMessage', (run) => {
          briefJiu(run);
          run.room = 'hall';
          run.assigned = true;
        });
        if (explain) playAudio('handoffKnown');
      });
    }
    if (r.assigned && !r.backup && r.elapsed <= 5) offer('getBackup', 'getDetail', () => step('getMessage', (run) => { run.backup = true; }));
    if (r.backup && !r.returned && r.elapsed <= 6) offer('returnStudio', 'returnDetail', () => step('returnMessage', (run) => { run.room = 'studio'; run.returned = true; }));
    if (r.returned) offer('useBackup', 'useDetail', () => step('backupClip', (run) => {
      briefJiu(run);
      record('logBackup');
    }, 'backup'));
    offer('hold', 'holdDetail', () => step('', briefJiu, 'held'));
    if (r.room === 'studio' && !known('practice')) offer('practice', 'practiceDetail', () => step('practiceMessage', () => learn('practice')));
    if (r.room === 'studio' && !known('schedule')) offer('schedule', 'scheduleDetail', () => step('scheduleMessage', () => learn('schedule')));
    return choices;
  }
  if (r.elapsed >= CUE_TIME) {
    if (!r.answersClosed && r.elapsed < LIMIT - 2) {
      offer('closeAnswers', 'closeAnswersDetail', () => step('closeAnswersMessage', (run) => { run.answersClosed = true; }));
    } else if (!r.checked && r.elapsed < LIMIT - 1) {
      offer('checkAnswers', 'checkAnswersDetail', () => step('checkAnswersMessage', (run) => { run.checked = true; }));
    } else if (!r.winnerCard && r.elapsed < LIMIT - 1) {
      offer('collectCard', 'collectCardDetail', () => step('collectCardMessage', (run) => { run.winnerCard = true; }));
    } else {
      offer('announce', 'announceDetail', () => step('', null, 'clean'));
    }
    return choices;
  }
  if (r.room === 'hall') {
    offer('returnStudio', 'returnDetail', () => step('returnMessage', (run) => { run.room = 'studio'; }));
  } else if (r.queued) {
    if (!r.previewChecked && r.elapsed < CUE_TIME - 1) {
      offer('previewQueued', 'previewQueuedDetail', () => {
        step('previewQueuedMessage', (run) => { run.previewChecked = true; });
        playAudio('question');
      });
    } else if (!r.classroomsReady && r.elapsed < CUE_TIME - 1) {
      offer('checkClassrooms', 'checkClassroomsDetail', () => step('checkClassroomsMessage', (run) => { run.classroomsReady = true; }));
    } else {
      offer('callFinal', 'callFinalDetail', () => step('callFinalMessage'));
    }
    return choices;
  } else if (!r.queued) {
    if (known('proof')) offer('swap', 'swapDetail', () => step('swapMessage', (run) => {
      briefJiu(run);
      run.queued = true;
    }));
    if (r.mic) offer('mute', 'muteDetail', () => step('micMessage', (run) => { run.mic = false; learn('mic'); }));
    if (!known('schedule')) offer('schedule', 'scheduleDetail', () => step('scheduleMessage', () => learn('schedule')));
    if (!known('practice')) offer('practice', 'practiceDetail', () => step('practiceMessage', () => learn('practice')));
    if (!known('proof') && known('practice') && known('schedule')) {
      const choice = known('leak') ? { id: 'check', detail: 'checkDetail', run: openJournal, free: true }
        : { id: 'findExcerpt', detail: 'findExcerptDetail', run: playMonitor, free: true };
      if (known('mic')) choices.unshift(choice);
      else choices.push(choice);
    }
    if (!known('door')) offer('hallVisit', 'hallDetail', () => step('hallMessage', (run) => { run.room = 'hall'; learn('door'); playAudio('door'); }));
  }
  offer('advance', 'advanceDetail', () => step('advanceMessage'));
  return choices;
}

function renderChoices() {
  const r = game.run;
  $('choices').hidden = Boolean(r.outcome);
  $('review').hidden = !r.elapsed || Boolean(r.outcome);
  if (r.outcome) { $('actions').replaceChildren(); return; }
  $('actions').replaceChildren(...actionChoices().map(({ id, detail, run, free }, index) => {
    const button = node('button', '', 'action');
    button.type = 'button';
    button.dataset.action = id;
    button.dataset.primary = String(index === 0);
    const title = node('span', '', 'action-top');
    title.append(node('strong', t(id)), node('small', t(free ? 'noCost' : 'one')));
    button.append(title, node('span', t(detail), 'action-detail'));
    button.addEventListener('click', run);
    return button;
  }));
}

function monitorInfo() {
  const r = game.run;
  if (r.outcome === 'backup') return ['previewBackup', 'backupClip', 'backup'];
  if (r.queued) return ['previewQuestion', 'questionClip', 'question'];
  if (r.leaked) return ['previewLeak', 'leakClip', 'leak'];
  return ['previewFuture', 'future', 'future'];
}

function renderScene() {
  const r = game.run;
  $('scene').dataset.room = r.room;
  text('place', r.room);
  text('scoreboard', r.outcome === 'clean' ? 'scoreClean' : r.outcome === 'backup' ? 'scoreBackup' : 'scoreTie');
  text('scene-line', r.message || (game.loop > 1 ? 'remembered' : 'present'));
  const onAir = !r.outcome && !r.assigned;
  $('air-label').dataset.held = String(!onAir);
  $('air-label').lastElementChild.textContent = onAir ? 'ON AIR' : 'OFF AIR';
  const micState = r.mic && onAir ? 'open' : 'off';
  const file = r.outcome === 'backup' ? 'backupNow' : r.outcome ? 'closed'
    : r.assigned ? 'held' : r.leaked ? r.elapsed === CUE_TIME ? 'publicNow' : 'publicDone'
      : r.queued && r.elapsed >= CUE_TIME ? 'cleanNow' : 'waiting';
  text('console-status', r.outcome ? 'closed' : r.assigned ? 'consoleHeld'
    : r.leaked ? 'consoleAccident' : r.elapsed >= CUE_TIME ? 'consoleClean' : 'consoleReady');
  text('mic-status', micState);
  text('file-status', file);
  text('headphone-status', 'private');
  $('mic-channel').dataset.state = micState === 'off' ? 'off' : 'live';
  $('file-channel').dataset.state = ['publicNow', 'publicDone', 'cleanNow', 'backupNow'].includes(file) ? 'live' : 'off';
  text('cue', r.outcome === 'backup' ? 'cueBackup' : r.assigned && !r.outcome ? 'cueHeld'
    : r.leaked ? r.leakMicOff ? 'cueOff' : 'cueOn' : r.queued ? r.elapsed >= CUE_TIME ? 'cueClean' : 'cueSwapped' : 'cuePending');
  text('monitor-label', monitorInfo()[0]);
  $('monitor-caption').hidden = !monitorSelection;
  if (monitorSelection) text('monitor-caption', monitorSelection);
  $('save-excerpt').hidden = monitorSelection !== 'future' || known('leak');
}

function logRows(container) {
  $(container).replaceChildren(...game.run.log.map(({ minute, text: key }) => {
    const item = node('li');
    item.append(node('time', clock(minute)), node('span', t(key)));
    return item;
  }));
}
function renderEnding() {
  const r = game.run;
  $('ending').hidden = !r.outcome;
  if (!r.outcome) return;
  const ending = endingFor(r);
  text('ending-category', 'endingLabel');
  text('ending-count', 'endingCount', game.unlocked.length);
  text('ending-title', ending.title);
  text('ending-caption', ending.caption);
  text('ending-story', ending.story);
  text('ending-next', game.unlocked.length === 3 ? 'endAll' : ending.next);
}
function render() {
  const r = game.run;
  $('clock').textContent = clock(r.elapsed);
  text('budget', 'budget', LIMIT - r.elapsed);
  text('loop', 'round', game.loop);
  text('mission', mission());
  $('memory').hidden = !game.previous;
  if (game.previous) text('memory', 'previous', clock(game.previous.minute), t(game.previous.text));
  $('journal-count').textContent = game.known.length;
  $('track').replaceChildren(...Array.from({ length: LIMIT }, (_, i) =>
    node('i', '', i < r.elapsed ? '' : i === CUE_TIME - 1 ? 'remaining deadline' : 'remaining')));
  document.body.dataset.urgent = String(!r.outcome && r.elapsed >= CUE_TIME - 1);
  document.body.dataset.incident = String(r.leaked);
  document.body.dataset.emergency = String(r.leaked && r.elapsed === CUE_TIME && !r.outcome);
  document.body.dataset.ended = String(Boolean(r.outcome));
  $('history').hidden = !r.log.length;
  renderSound();
  renderScene();
  renderChoices();
  renderEnding();
  logRows('history-list');
  if ($('review-dialog').open) logRows('review-list');
}

function renderJournal() {
  $('journal-clues').replaceChildren(...game.known.map((id) => {
    const clue = CLUES[id];
    const item = node('li');
    item.append(node('h3', t(clue.title)), node('p', t(clue.fact)));
    if (clue.clip) {
      const listen = node('button', t('audioReplay'), 'utility');
      listen.type = 'button';
      listen.dataset.clip = id;
      listen.setAttribute('aria-label', t('audioReplay') + ' · ' + t(clue.title));
      listen.addEventListener('click', () => playAudio(clue.clip, true));
      item.append(listen);
    }
    return item;
  }));
  $('compare-options').replaceChildren(...['leak', 'practice', 'door'].filter(known).map((id) => {
    const button = node('button', t(CLUES[id].title), 'utility');
    button.type = 'button';
    button.dataset.recording = id;
    button.setAttribute('aria-pressed', String(selected.has(id)));
    button.addEventListener('click', () => {
      if (selected.has(id)) selected.delete(id);
      else {
        if (selected.size === 2) selected.delete(selected.values().next().value);
        selected.add(id);
      }
      renderComparison();
    });
    return button;
  }));
  renderComparison();
}
function renderComparison() {
  for (const button of $('compare-options').children) button.setAttribute('aria-pressed', String(selected.has(button.dataset.recording)));
  $('compare').disabled = selected.size !== 2 || known('proof');
  $('source-choice').hidden = !game.compared || known('proof') || !known('mic') || !known('schedule');
  $('connect').disabled = !selectedSource;
  for (const button of $('source-choice').querySelectorAll('[data-source]')) {
    button.setAttribute('aria-pressed', String(button.dataset.source === selectedSource));
  }
  const feedback = comparisonFeedback || (known('proof') ? 'pairConnected' : game.compared
    ? !known('schedule') ? 'pairNeedSchedule' : !known('mic') ? 'pairNeedMic' : 'pairYes' : '');
  text('compare-feedback', feedback);
}
function openJournal() {
  stopAudio();
  comparisonFeedback = '';
  selectedSource = '';
  renderJournal();
  $('journal').showModal();
  if (known('practice') && known('schedule') && !known('proof')) $('compare-area').scrollIntoView({ block: 'nearest' });
}
$('compare').addEventListener('click', () => {
  if (selected.size !== 2) return;
  game.compared = selected.has('leak') && selected.has('practice');
  comparisonFeedback = game.compared ? '' : 'pairNo';
  save();
  renderComparison();
});
for (const button of $('source-choice').querySelectorAll('[data-source]')) {
  button.addEventListener('click', () => {
    selectedSource = button.dataset.source;
    comparisonFeedback = '';
    renderComparison();
  });
}
$('connect').addEventListener('click', () => {
  if (!game.compared || !known('mic') || !known('schedule')) return;
  if (selectedSource !== 'file') {
    comparisonFeedback = 'sourceWrong';
    renderComparison();
    return;
  }
  learn('proof');
  if (!game.run.outcome) record('logProof');
  comparisonFeedback = '';
  save();
  renderJournal();
  render();
  $('compare-feedback').setAttribute('tabindex', '-1');
  $('compare-feedback').focus({ preventScroll: true });
});
$('journal-open').addEventListener('click', openJournal);
$('journal-close').addEventListener('click', () => $('journal').close());
$('journal').addEventListener('close', () => { stopAudio(); $('journal-open').focus({ preventScroll: true }); });
function playMonitor() {
  const [, caption, clip] = monitorInfo();
  monitorSelection = caption;
  renderScene();
  playAudio(clip, true);
}
$('monitor').addEventListener('click', playMonitor);
$('save-excerpt').addEventListener('click', () => {
  if (monitorSelection !== 'future' || known('leak')) return;
  learn('leak');
  record('excerptLogged');
  monitorSelection = 'excerptSaved';
  save();
  render();
  $('monitor-caption').setAttribute('tabindex', '-1');
  $('monitor-caption').focus({ preventScroll: true });
});
$('review').addEventListener('click', () => {
  stopAudio();
  text('review-note', 'reviewNote');
  logRows('review-list');
  $('review-dialog').showModal();
});
$('review-close').addEventListener('click', () => $('review-dialog').close());
$('review-rewind').addEventListener('click', rewind);
$('rewind').addEventListener('click', rewind);
$('end-replay').addEventListener('click', () => playAudio(endingFor(game.run)?.clip, true));
$('sound').addEventListener('click', toggleSound);

function tickIntro(now) {
  if (!intro) return;
  const elapsed = Math.max(0, now - intro.started);
  if (elapsed >= INTRO_LENGTH) { closeIntro(); return; }
  const shot = INTRO_SHOTS.findLast(({ at }) => at <= elapsed);
  if (intro.shot !== shot) {
    intro.shot = shot;
    $('intro-clock').textContent = shot.clock;
    $('intro-view').dataset.shot = shot.shot;
    text('intro-caption', shot.caption);
    if (shot.clip) playAudio(shot.clip);
  }
  $('intro-progress').value = elapsed;
  intro.frame = requestAnimationFrame(tickIntro);
}
function openIntro(replay = false) {
  stopAudio();
  intro = { started: performance.now(), shot: null, frame: 0, replay };
  text('intro-start', replay ? 'resume' : 'start');
  $('intro').showModal();
  tickIntro(performance.now());
}
function closeIntro() {
  if (!intro) return;
  cancelAnimationFrame(intro.frame);
  const { replay, shot } = intro;
  intro = null;
  stopAudio();
  game.seen = true;
  save();
  $('intro').close();
  if (!replay && game.run.elapsed === 0 && !game.run.outcome) {
    $('monitor').focus({ preventScroll: true });
    if (shot.clip !== 'opening' && shot.at < 12100) playAudio('opening');
  }
}
$('intro-start').addEventListener('click', closeIntro);
$('intro').addEventListener('cancel', (event) => { event.preventDefault(); closeIntro(); });
$('intro-sound').addEventListener('click', () => {
  toggleSound();
  if (game.sound && intro?.shot?.clip) playAudio(intro.shot.clip);
});
$('replay-intro').addEventListener('click', () => { $('menu').open = false; openIntro(true); });

function renderLanguage() {
  document.documentElement.lang = game.language;
  document.title = t('brand') + ', ' + t('title');
  for (const element of document.querySelectorAll('[data-t]')) element.textContent = t(element.dataset.t);
  $('language').textContent = game.language === 'ko' ? 'English' : '한국어';
  $('language').lang = game.language === 'ko' ? 'en' : 'ko';
  $('clock').setAttribute('aria-label', game.language === 'ko' ? '방송 시각' : 'Broadcast time');
  $('choices').setAttribute('aria-label', t('actions'));
}
$('language').addEventListener('click', () => {
  game.language = game.language === 'ko' ? 'en' : 'ko';
  const url = new URL(location.href);
  url.searchParams.set('lang', game.language);
  history.replaceState(null, '', url);
  $('menu').open = false;
  save();
  renderLanguage();
  render();
});

renderLanguage();
render();
save();
if (!game.seen) openIntro();
