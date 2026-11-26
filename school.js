'use strict';

const LIMIT = 8;
const CUE_TIME = 4;
const INTRO_LENGTH = 20000;
const SAVE_KEY = 'hallyeo-fm-quiz-final-v1';
const AUDIO = {
  future: 'future-review', opening: 'opening', leak: 'answer', door: 'door',
  question: 'question', hold: 'hold', backup: 'backup', clean: 'clean', student: 'student', deadline: 'deadline-v6',
  handoffLive: 'handoff-live', handoffLiveKnown: 'handoff-live-known', holdKnown: 'hold-known',
  backupRestart: 'backup-restart', backupRestartKnown: 'backup-restart-known',
  closeClean: 'close-clean', holdAnswer: 'hold-answer', closeBackup: 'close-backup',
  winnerLive: 'winner-live', winnerBackup: 'winner-backup', holdStudent: 'hold-student', practice: 'practice',
  cleanReactions: 'clean-reactions', backupReactions: 'backup-reactions',
  swapBrief: 'swap-brief', readyYellow: 'ready-yellow', readyBlue: 'ready-blue',
  epilogueSave: 'epilogue-save', epilogueClock: 'epilogue-clock',
  teacherCue: 'teacher-cue', classroomCue: 'classroom-cue',
  teacherEnvelope: 'teacher-envelope',
};
const PRE_BROADCAST = {
  [CUE_TIME - 2]: { caption: 'teacherPreparesEnvelope', clip: 'teacherCue' },
  [CUE_TIME - 1]: { caption: 'classroomReadySignal', clip: 'classroomCue' },
};
const CLUES = {
  future: { title: 'futureClue', fact: 'futureFact', caption: 'future', clip: 'future' },
  leak: { title: 'leakClue', fact: 'leakFact', caption: 'leakClip', clip: 'leak' },
  mic: { title: 'micClue', fact: 'micFact' },
  schedule: { title: 'scheduleClue', fact: 'scheduleFact' },
  finalQuestion: { title: 'finalQuestionClue', fact: 'finalQuestionFact', caption: 'questionClip', clip: 'question' },
  practice: { title: 'practiceClue', fact: 'practiceFact', caption: 'leakClip', clip: 'practice' },
  door: { title: 'doorClue', fact: 'doorFact', caption: 'doorClip', clip: 'door' },
  proof: { title: 'proofClue', fact: 'proofFact' },
};
const RECORDINGS = ['leak', 'practice', 'finalQuestion', 'door'];
const ENDINGS = {
  held: { title: 'endHeldTitle', caption: 'endHeldCaption', story: 'endHeldStory', next: 'endHeldNext', clip: 'hold' },
  backup: { title: 'endBackupTitle', caption: 'winnerBackupCaption', story: 'endBackupStory', next: 'endBackupNext', clip: 'backupRestart' },
  clean: { title: 'endCleanTitle', caption: 'endCleanCaption', story: 'endCleanStory', next: 'endCleanNext', clip: 'clean' },
};
const EXPLAINED_ENDINGS = {
  held: { caption: 'endHeldKnownCaption', story: 'endHeldKnownStory', next: 'endHeldKnownNext', clip: 'holdKnown' },
  backup: { story: 'endBackupKnownStory', clip: 'backupRestartKnown' },
};
const LOOP_GOALS = {
  clean: { label: 'goalClean', tip: 'goalCleanTip' },
  backup: { label: 'goalBackup', tip: 'goalBackupTip' },
  held: { label: 'goalHeld', tip: 'goalHeldTip' },
};
const RESULT_SCENES = {
  clean: { text: 'cleanResultScene', clip: 'closeClean' },
  backup: { text: 'backupResultScene', clip: 'closeBackup' },
  held: { text: 'heldResultScene', clip: 'holdAnswer' },
};
const QUIZ = {
  clean: { options: ['optionThermometer', 'optionScale', 'optionVane'], submitted: [1, 2], correct: 2, question: 'gradeCleanQuestion', hint: 'gradeCleanHint' },
  backup: { options: ['optionSolid', 'optionLiquid', 'optionGas'], submitted: [0, 1], correct: 0, question: 'gradeBackupQuestion', hint: 'gradeBackupHint' },
};
const TEAMS = ['blue', 'yellow'];
const WINNER_AUDIO = { clean: 'winnerLive', backup: 'winnerBackup' };
const WINNER_REACTIONS = {
  clean: { clip: 'cleanReactions', duration: 6400, winner: 'yellow', winningLine: 'cleanYellowReaction', otherLine: 'cleanBlueReaction' },
  backup: { clip: 'backupReactions', duration: 8000, winner: 'blue', winningLine: 'backupBlueReaction', otherLine: 'backupYellowReaction' },
};
const CLASSROOM_BEATS = ['received', 'solving', 'first', 'ready'];
const CLASSROOM_DELAYS = [1000, 1750, 1400];
const OPTION_NUMBER = ['①', '②', '③'];
const INTRO_SHOTS = [
  { at: 0, clock: '12:40', shot: 'future', caption: 'introHook' },
  { at: 900, clock: '12:40', shot: 'future', caption: 'future', clip: 'future' },
  { at: 10600, clock: '12:32', shot: 'shift', caption: 'introShift' },
  { at: 12100, clock: '12:32', shot: 'studio', caption: 'opening', clip: 'opening' },
  { at: 16900, clock: '12:32', shot: 'studio', caption: 'introFinal' },
];

const newRun = () => ({
  elapsed: 0, room: 'studio', goal: '', mic: true, queued: false, leaked: false, leakMicOff: false,
  assigned: false, handoffPending: false, backup: false, returned: false, briefed: false,
  previewChecked: false, classroomsReady: false, swapBriefPending: false, questionDelivered: false, classroomAnswersReady: false,
  answersClosed: false, checked: false, announcementReady: false,
  outcome: '', backupGradePending: false, message: '', log: [],
});
const $ = (id) => document.getElementById(id);
const clock = (elapsed) => '12:' + (32 + elapsed);

function load() {
  const fresh = {
    version: 2, loop: 1, known: ['future'], unlocked: [], compared: false, seen: false, epilogueSeen: false,
    language: 'ko', sound: false, previous: null, leakOrigin: '', run: newRun(),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || (saved.version !== 1 && saved.version !== fresh.version)) return fresh;
    for (const flag of ['compared', 'seen', 'sound', 'epilogueSeen']) fresh[flag] = saved[flag] === true;
    if (saved.language === 'en') fresh.language = 'en';
    if (Number.isSafeInteger(saved.loop) && saved.loop > 0) fresh.loop = saved.loop;
    if (Array.isArray(saved.known)) fresh.known = [...new Set([...fresh.known, ...saved.known.filter((id) => Object.hasOwn(CLUES, id))])];
    if (['future', 'rewound'].includes(saved.leakOrigin)) fresh.leakOrigin = saved.leakOrigin;
    if (fresh.known.includes('schedule') && !fresh.known.includes('finalQuestion')) fresh.known.push('finalQuestion');
    if (Array.isArray(saved.unlocked)) fresh.unlocked = [...new Set(saved.unlocked.filter((id) => Object.hasOwn(ENDINGS, id)))];
    const previous = saved.previous;
    if (Number.isInteger(previous?.minute) && previous.minute >= 0 && previous.minute <= LIMIT
      && Object.hasOwn(SCHOOL_COPY, previous.text)) fresh.previous = previous;
    const run = saved.run;
    if (!run || !Number.isInteger(run.elapsed) || run.elapsed < 0 || run.elapsed > LIMIT
      || (run.room !== 'studio' && run.room !== 'hall') || (run.outcome && !Object.hasOwn(ENDINGS, run.outcome))) return fresh;
    fresh.run = { ...fresh.run, ...run };
    if (!Object.hasOwn(LOOP_GOALS, run.goal)) fresh.run.goal = '';
    if (run.winnerCard) fresh.run.announcementReady = true;
    if (inAnnouncementStandby(fresh.run)) fresh.run.mic = false;
    if (run.checked) fresh.run.answersClosed = true;
    if (run.queued && run.elapsed > CUE_TIME) fresh.run.questionDelivered = true;
    if (!Object.hasOwn(run, 'classroomAnswersReady') && (fresh.run.questionDelivered || run.backupGradePending)) {
      fresh.run.classroomAnswersReady = true;
    }
    if (saved.version === 1 && run.queued) fresh.run.briefed = true;
    if (run.leaked && !fresh.known.includes('leak')) fresh.known.push('leak');
    fresh.run.log = Array.isArray(run.log) ? run.log.filter((entry) =>
      Number.isInteger(entry?.minute) && entry.minute >= 0 && entry.minute <= LIMIT && Object.hasOwn(SCHOOL_COPY, entry.text)).slice(-20) : [];
    if (run.leaked) fresh.leakOrigin = 'rewound';
    else if (!fresh.leakOrigin && fresh.run.log.some((entry) => entry.text === 'excerptLogged')) fresh.leakOrigin = 'future';
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
let endingScene;
let classroomScene;
let announcementSignal = 0;
let epilogueScene = 'record';
let incidentOpening = false;
let incidentAudio;
let handoffTimer;
let journalAudio;
let gradeFeedback = '';
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
  return player;
}
function toggleSound() {
  game.sound = !game.sound;
  if (!game.sound) stopAudio();
  save();
  renderSound();
  if (game.run.handoffPending) playHandoffNotice(game.run);
  else if (game.sound && !intro && !$('epilogue').open) {
    if (game.run.swapBriefPending) playSwapBrief();
    else if (awaitingQuestion(game.run)) playQuestion();
  }
}
function renderSound() {
  for (const id of ['sound', 'intro-sound']) {
    $(id).setAttribute('aria-pressed', String(game.sound));
    text(id, game.sound ? 'soundOn' : 'soundOff');
  }
}

function record(key, minute = game.run.elapsed) { game.run.log.push({ minute, text: key }); }

const awaitingQuestion = (run) => run.queued && run.elapsed === CUE_TIME && !run.swapBriefPending && !run.questionDelivered && !run.outcome;
function confirmQuestionDelivery(run = game.run) {
  if (run !== game.run || !awaitingQuestion(run)) return;
  stopAudio();
  monitorSelection = null;
  run.questionDelivered = true;
  record('logClean');
  save();
  startClassrooms('clean');
}

function playQuestion(explicit = false) {
  const run = game.run;
  playAudio('question', explicit, () => confirmQuestionDelivery(run));
}

function startQueuedQuestion(run = game.run) {
  if (game.run !== run || !run.swapBriefPending) return;
  run.swapBriefPending = false;
  record('logQuestionStarted');
  save();
  render();
  playQuestion();
  if (!$('journal').open && !$('review-dialog').open) {
    $('actions').querySelector('[data-action="confirmQuestion"]')?.focus({ preventScroll: true });
  }
}

function playSwapBrief() {
  const run = game.run;
  playAudio('swapBrief', false, () => startQueuedQuestion(run));
}

function inAnnouncementStandby(run) {
  return run.queued && run.checked && !run.outcome && run.elapsed >= LIMIT - 2;
}

function awaitingAnnouncementCheck(run) {
  return inAnnouncementStandby(run) && run.elapsed === LIMIT - 2 && !run.announcementReady;
}

function startAnnouncementSignals(run) {
  announcementSignal = 0;
  const stillWaiting = () => game.run === run && awaitingAnnouncementCheck(run);
  const canPlay = () => !intro && !$('journal').open && !$('review-dialog').open;
  const showBoth = () => {
    if (!stillWaiting() || announcementSignal !== 1) return;
    announcementSignal = 2;
    render();
    if (canPlay()) {
      playAudio('readyBlue');
      $('actions').querySelector('[data-action="confirmAnnouncement"]')?.focus({ preventScroll: true });
    }
  };
  setTimeout(() => {
    if (!stillWaiting()) return;
    announcementSignal = 1;
    render();
    const player = canPlay() && playAudio('readyYellow', false, showBoth);
    setTimeout(showBoth, player ? 5600 : 1500);
  }, 780);
}

function playIncident(explicit = false, afterAnswer = null) {
  incidentAudio = playAudio('leak', explicit, () => {
    afterAnswer?.();
    incidentAudio = playAudio('student', explicit, () => {
      incidentAudio = playAudio('deadline', explicit);
    });
  });
  return incidentAudio;
}

function startIncident(run) {
  incidentOpening = true;
  const revealReaction = () => {
    if (game.run !== run || !incidentOpening || run.elapsed !== CUE_TIME || run.outcome) return;
    incidentOpening = false;
    renderScene();
  };
  const player = playIncident(false, revealReaction);
  setTimeout(revealReaction, player ? 3500 : 1900);
}

function endingFor(run) {
  const basic = ENDINGS[run.outcome];
  if (!basic) return null;
  const explained = run.briefed ? EXPLAINED_ENDINGS[run.outcome] : null;
  const ending = explained ? { ...basic, ...explained } : basic;
  if (run.outcome !== 'held') return ending;
  if (missedBackupAirtime(run)) return { ...ending, story: 'endHeldMissedAirtime', next: 'rewindAirtimeHint' };
  return !explained && !run.leakMicOff ? { ...ending, story: 'endHeldOther' } : ending;
}

function replayEnding(run, explicit = false) {
  const ending = endingFor(run);
  if (!ending) return;
  const close = () => playAudio(RESULT_SCENES[run.outcome].clip, explicit);
  const playWinner = () => playAudio(WINNER_AUDIO[run.outcome], explicit,
    () => playAudio(WINNER_REACTIONS[run.outcome].clip, explicit, close));
  if (run.outcome === 'clean') { playWinner(); return; }
  playAudio(ending.clip, explicit, () => {
    if (run.outcome === 'held') playAudio('holdStudent', explicit, close);
    else playAudio('backup', explicit, playWinner);
  });
}

function briefJiu(run) {
  if (!known('proof') || run.briefed) return;
  run.briefed = true;
  record('logBriefed');
}

function finishHandoff(run) {
  if (run !== game.run || !run.handoffPending) return;
  clearTimeout(handoffTimer);
  stopAudio();
  run.handoffPending = false;
  run.message = 'handoffStandbyScene';
  record(run.message);
  save();
  render();
  $('actions').querySelector('[data-action="getBackup"]')?.focus({ preventScroll: true });
}

function playHandoffNotice(run) {
  clearTimeout(handoffTimer);
  const done = () => finishHandoff(run);
  const player = playAudio(run.briefed ? 'handoffLiveKnown' : 'handoffLive', false, done);
  handoffTimer = setTimeout(done, player ? 12500 : 3200);
}

function askAboutEnvelope() {
  const run = game.run;
  run.message = 'teacherEnvelopeReply';
  record(run.message);
  save();
  render();
  playAudio('teacherEnvelope');
  $('actions').querySelector('[data-primary="true"]')?.focus({ preventScroll: true });
}

const canStartBackup = (run) => run.leaked && !run.assigned && run.elapsed === CUE_TIME;
const missedBackup = (run) => run.leaked && !run.assigned && run.elapsed > CUE_TIME;
const lastBackupChance = (run) => run.returned && !run.outcome && run.elapsed === LIMIT - 1;
const missedBackupAirtime = (run) => run.log.some(({ minute, text }) =>
  text === 'logBackupAirtimeMissed' || (run.returned && run.outcome === 'held' && minute === LIMIT &&
    (text === 'practiceMessage' || text === 'scheduleMessage')));
function learnSchedule() {
  learn('schedule');
  learn('finalQuestion');
}

function clearSceneTimers(scene) {
  scene.timers.forEach(clearTimeout);
  scene.timers.length = 0;
}

function later(scene, delay, action) {
  scene.timers.push(setTimeout(() => {
    if (endingScene === scene) action();
  }, delay));
}

function commitEnding(run) {
  if (!game.unlocked.includes(run.outcome)) game.unlocked.push(run.outcome);
  record(ENDINGS[run.outcome].title);
  save();
}

function finishEndingScene(playClosing = true) {
  const r = game.run;
  clearSceneTimers(endingScene);
  endingScene = null;
  stopAudio();
  render();
  $('ending-title').focus({ preventScroll: true });
  if (playClosing) playAudio(RESULT_SCENES[r.outcome].clip);
}

function openBackupGrading(scene) {
  clearSceneTimers(scene);
  stopAudio();
  scene.beat = 'answers';
  scene.minute = LIMIT;
  render();
  focusGradeCard();
}

function startClassrooms(kind) {
  const run = game.run;
  const ending = kind === 'backup' ? endingScene : null;
  if (ending) {
    clearSceneTimers(ending);
    stopAudio();
    ending.beat = 'classrooms';
  }
  const scene = { kind, phase: 'received' };
  classroomScene = scene;
  function showPhase(index) {
    if (game.run !== run || classroomScene !== scene) return;
    scene.phase = CLASSROOM_BEATS[index];
    if (scene.phase === 'ready') {
      run.classroomAnswersReady = true;
      save();
      if (ending) {
        ending.minute = LIMIT;
        later(ending, 850, () => openBackupGrading(ending));
      }
    } else {
      setTimeout(() => showPhase(index + 1), CLASSROOM_DELAYS[index]);
    }
    render();
    if (scene.phase === 'ready' && !ending && !$('journal').open && !$('review-dialog').open) {
      $('actions').querySelector('[data-action="closeAnswers"]')?.focus({ preventScroll: true });
    }
  }
  showPhase(0);
}

function playBackupScene(scene, run) {
  playEndingBeat(scene, endingFor(run).clip, game.sound ? 7600 : 2300, () => {
    scene.beat = 'question';
    render();
    playEndingBeat(scene, 'backup', game.sound ? 9200 : 3900, () => startClassrooms('backup'));
  });
}

function playEndingBeat(scene, clip, duration, next) {
  const advance = () => {
    clearSceneTimers(scene);
    next();
  };
  const player = playAudio(clip, false, advance);
  later(scene, player ? duration + 1800 : duration, advance);
}

function showHoldReceipts(scene) {
  clearSceneTimers(scene);
  scene.beat = 'received';
  render();
  playEndingBeat(scene, 'holdStudent', 3800, () => showHoldAnswer(scene));
}

function showHoldAnswer(scene) {
  clearSceneTimers(scene);
  scene.beat = 'heldAnswer';
  render();
  playEndingBeat(scene, 'holdAnswer', game.sound ? 10800 : 4300, () => finishEndingScene(false));
}

function showWinnerReactions(scene) {
  const run = game.run;
  const reaction = WINNER_REACTIONS[scene.kind];
  clearSceneTimers(scene);
  scene.beat = 'winnerReaction';
  if (run.backupGradePending) {
    run.backupGradePending = false;
    commitEnding(run);
  }
  render();
  $('ending-title').focus({ preventScroll: true });
  playEndingBeat(scene, reaction.clip, reaction.duration, finishEndingScene);
}

function beginWinnerAnnouncement(scene) {
  scene.beat = 'announce';
  render();
  $('ending-title').focus({ preventScroll: true });
  playEndingBeat(scene, WINNER_AUDIO[scene.kind], 2900, () => showWinnerReactions(scene));
}

function finish(kind) {
  const r = game.run;
  const minute = r.elapsed;
  r.elapsed = LIMIT;
  r.outcome = kind;
  const beats = { backup: 'explain', clean: 'announce', held: 'notice' };
  const scene = { kind, beat: beats[kind], minute: kind === 'backup' ? LIMIT - 1 : minute, timers: [] };
  endingScene = scene;
  if (kind === 'backup') {
    r.backupGradePending = true;
    save();
  } else {
    commitEnding(r);
  }
  if (kind === 'clean') { beginWinnerAnnouncement(scene); return; }
  render();
  $('ending-title').focus({ preventScroll: true });
  if (kind === 'backup') playBackupScene(scene, r);
  if (kind === 'held') playEndingBeat(scene, endingFor(r).clip, r.briefed ? 6500 : 4000, () => showHoldReceipts(scene));
}

function step(message, apply = null, outcome = '') {
  const r = game.run;
  if (r.outcome || r.elapsed >= LIMIT) return;
  if (!outcome && lastBackupChance(r)) record('logBackupAirtimeMissed');
  gradeFeedback = '';
  incidentOpening = false;
  monitorSelection = null;
  stopAudio();
  if (apply) apply(r);
  r.elapsed += 1;
  r.message = message;
  if (message) record(message);
  const leadIn = PRE_BROADCAST[r.elapsed];
  if (leadIn) {
    record(leadIn.caption);
    if (!audio && message !== 'previewQueuedMessage') playAudio(leadIn.clip);
  }
  if (r.elapsed === CUE_TIME) {
    if (r.queued) {
      r.message = 'cueClean';
      if (message === 'swapMessage') {
        r.swapBriefPending = true;
        playSwapBrief();
      } else {
        record('logQuestionStarted');
        playQuestion();
      }
    } else {
      r.leaked = true;
      r.leakMicOff = !r.mic;
      learn('mic');
      learn('leak');
      game.leakOrigin = 'rewound';
      record(r.leakMicOff ? 'logLeakOff' : 'logLeakOn');
      r.message = r.room === 'hall' ? 'incidentHall' : 'incidentScene';
      startIncident(r);
    }
  }
  if (!outcome && missedBackup(r) && r.elapsed === CUE_TIME + 1) record('logBackupClosed');
  if (outcome) { finish(outcome); return; }
  if (r.elapsed === LIMIT) {
    finish(r.queued && r.checked ? 'clean' : 'held');
    return;
  }
  if (awaitingAnnouncementCheck(r)) {
    r.mic = false;
    startAnnouncementSignals(r);
  }
  save();
  render();
  if (gradingQuiz()) focusGradeCard();
  else $('actions').querySelector('[data-primary="true"]')?.focus({ preventScroll: true });
}

function rewind() {
  if (endingScene) return;
  const r = game.run;
  const broadcasts = ['logClean', 'logBackup', 'logLeakOff', 'logLeakOn', 'logQuestionStarted'];
  const lastSlot = missedBackupAirtime(r) ? 'logBackupAirtimeMissed' : lastBackupChance(r) ? 'logBackupVoluntaryRewind' : '';
  const backupRecap = lastSlot
    ? { minute: LIMIT - 1, text: lastSlot }
    : r.log.findLast((entry) => entry.text === 'logBackupClosed');
  const moment = backupRecap
    ?? r.log.findLast((entry) => broadcasts.includes(entry.text))
    ?? r.log.findLast((entry) => entry.text === 'logProof');
  game.previous = moment ?? { minute: r.elapsed, text: 'logNoEnd' };
  game.loop += 1;
  game.run = newRun();
  classroomScene = null;
  clearTimeout(handoffTimer);
  announcementSignal = 0;
  incidentOpening = false;
  monitorSelection = null;
  gradeFeedback = '';
  stopAudio();
  $('history').open = false;
  if ($('review-dialog').open) $('review-dialog').close();
  save();
  render();
  window.scrollTo(0, 0);
  $('mission').focus({ preventScroll: true });
}

function recommendedGoal() {
  if (game.loop < 2) return '';
  if (['logBackupClosed', 'logBackupAirtimeMissed', 'logBackupVoluntaryRewind'].includes(game.previous?.text)
    && !game.unlocked.includes('backup')) return 'backup';
  return Object.keys(LOOP_GOALS).find((goal) => !game.unlocked.includes(goal)) ?? '';
}

const activeGoal = () => game.run.goal || recommendedGoal();

function mission() {
  const r = game.run;
  if (r.outcome) return 'missionEnd';
  if (r.handoffPending) return 'handoffOnAirStatus';
  if (r.leaked) {
    if (r.assigned && !r.backup) return 'missionGet';
    if (r.backup && !r.returned) return 'missionReturn';
    if (r.returned) return lastBackupChance(r) ? 'missionLastBackup' : 'missionUse';
    return canStartBackup(r) ? 'missionLate' : 'missionHold';
  }
  if (r.swapBriefPending) return 'swapBriefTitle';
  if (awaitingQuestion(r)) return 'missionQuestionDelivery';
  if (awaitingAnnouncementCheck(r)) return 'missionAnnouncement';
  if (r.questionDelivered && !r.classroomAnswersReady && !r.answersClosed) return 'classroomTitle';
  if (r.elapsed >= CUE_TIME) return 'missionClean';
  if (r.queued) return 'missionClean';
  if (activeGoal() === 'backup') return 'missionGoalBackup';
  if (activeGoal() === 'held') return 'missionGoalHeld';
  if (known('proof')) return 'missionFix';
  if (known('practice') && known('schedule')) return 'missionCompare';
  return 'missionFind';
}

function actionChoices() {
  const r = game.run;
  const choices = [];
  function offer(id, detail, run, free = false, label = id) { choices.push({ id, detail, run, free, label }); }
  if (r.handoffPending) {
    offer('continueHandoff', 'continueHandoffDetail', () => finishHandoff(r), true);
    return choices;
  }
  if (r.leaked) {
    const lastChance = lastBackupChance(r);
    if (canStartBackup(r)) {
      const explain = known('proof');
      const inHall = r.room === 'hall';
      const detail = inHall ? 'handoffHallDetail' : explain ? 'handoffKnownDetail' : 'handoffDetail';
      offer('handoff', detail, () => {
        step(explain ? 'handoffKnownMessage' : 'handoffMessage', (run) => {
          briefJiu(run);
          run.room = 'hall';
          run.assigned = true;
          run.handoffPending = true;
          run.mic = false;
        });
        playHandoffNotice(r);
      }, false, inHall ? 'handoffHall' : 'handoff');
    }
    if (r.assigned && !r.backup && r.elapsed <= 5) offer('getBackup', 'getDetail', () => step('getMessage', (run) => { run.backup = true; }));
    if (r.backup && !r.returned && r.elapsed <= 6) offer('returnStudio', 'returnDetail', () => step('returnMessage', (run) => { run.room = 'studio'; run.returned = true; }));
    if (r.returned) offer('useBackup', lastChance ? 'finalBackupDetail' : 'useDetail', () => step('backupClip', (run) => {
      briefJiu(run);
      record('logBackup');
    }, 'backup'), false, lastChance ? 'finalBackupAir' : 'useBackup');
    offer('hold', lastChance ? 'finalHoldDetail' : 'holdDetail', () => step('', briefJiu, 'held'), false, lastChance ? 'finalBackupHold' : 'hold');
    if (r.room === 'studio' && !known('practice')) offer('practice', lastChance ? 'finalClueCost' : 'practiceDetail', () => step('practiceMessage', () => learn('practice')));
    if (r.room === 'studio' && !known('schedule')) offer('schedule', lastChance ? 'finalClueCost' : 'scheduleDetail', () => step('scheduleMessage', learnSchedule));
    return choices;
  }
  if (r.swapBriefPending) {
    offer('startQueuedQuestion', 'startQueuedQuestionDetail', () => startQueuedQuestion(), true);
    return choices;
  }
  if (awaitingQuestion(r)) {
    offer('confirmQuestion', 'confirmQuestionDetail', () => confirmQuestionDelivery(), true);
    return choices;
  }
  if (r.elapsed >= CUE_TIME) {
    if (!r.answersClosed && r.elapsed < LIMIT - 2) {
      if (r.classroomAnswersReady) {
        offer('closeAnswers', 'closeAnswersDetail', () => step('closeAnswersMessage', (run) => { run.answersClosed = true; }));
      }
    } else if (awaitingAnnouncementCheck(r)) {
      if (announcementSignal === 2) {
        offer('confirmAnnouncement', 'confirmAnnouncementDetail',
          () => step('announcementCheckMessage', (run) => { run.announcementReady = true; }));
      }
    } else {
      offer('announce', 'announceDetail', () => step('', null, 'clean'));
    }
    return choices;
  }
  if (r.room === 'hall') {
    if (r.elapsed === CUE_TIME - 2 && r.message !== 'teacherEnvelopeReply') {
      offer('askEnvelope', 'askEnvelopeDetail', askAboutEnvelope, true);
    }
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
    if (!known('schedule')) offer('schedule', 'scheduleDetail', () => step('scheduleMessage', learnSchedule));
    if (!known('practice')) offer('practice', 'practiceDetail', () => step('practiceMessage', () => learn('practice')));
    if (!known('proof') && known('practice') && known('schedule')) {
      const choice = known('leak') ? { id: 'check', detail: 'checkDetail', run: openJournal, free: true }
        : { id: 'findExcerpt', detail: 'findExcerptDetail', run: playMonitor, free: true };
      if (known('mic')) choices.unshift(choice);
      else choices.push(choice);
    }
    const revisit = known('door');
    offer('hallVisit', revisit ? 'hallRevisitDetail' : 'hallDetail', () => {
      step(revisit ? 'hallRevisitMessage' : 'hallMessage', (run) => {
        run.room = 'hall';
        if (!revisit) {
          learn('door');
          playAudio('door');
        }
      });
    }, false, revisit ? 'hallRevisit' : 'hallVisit');
  }
  const waitingForLeak = activeGoal() === 'backup' || activeGoal() === 'held';
  offer('advance', waitingForLeak ? 'waitForLeakDetail' : 'advanceDetail',
    () => step(r.room === 'hall' ? 'hallAdvanceMessage' : 'advanceMessage'), false, waitingForLeak ? 'waitForLeak' : 'advance');
  return choices;
}

function renderChoices() {
  const r = game.run;
  const lastChance = lastBackupChance(r);
  $('choices').hidden = Boolean(r.outcome || gradingQuiz() || (r.questionDelivered && !r.classroomAnswersReady));
  text('choices-heading', lastChance ? 'finalBackupTitle' : 'actions');
  $('backup-deadline-note').hidden = !lastChance;
  $('review').hidden = !r.elapsed || Boolean(r.outcome) || r.handoffPending;
  if ($('choices').hidden) { $('actions').replaceChildren(); return; }
  const choices = actionChoices();
  const goal = activeGoal();
  let priority;
  if (goal === 'held' && r.leaked && !r.assigned) priority = 'hold';
  if (goal && goal !== 'clean' && !r.queued && !r.leaked) priority = r.mic && r.room === 'studio' ? 'mute' : 'advance';
  const priorityIndex = choices.findIndex((choice) => choice.id === priority);
  if (priorityIndex > 0) choices.unshift(...choices.splice(priorityIndex, 1));
  $('actions').replaceChildren(...choices.map(({ id, detail, run, free, label = id }, index) => {
    const button = node('button', '', 'action');
    button.type = 'button';
    button.dataset.action = id;
    button.dataset.primary = String(index === 0);
    const title = node('span', '', 'action-top');
    title.append(node('strong', t(label)), node('small', t(free ? 'noCost' : 'one')));
    button.append(title, node('span', t(detail), 'action-detail'));
    button.addEventListener('click', run);
    return button;
  }));
}

function monitorInfo() {
  const r = game.run;
  if (r.outcome === 'backup') return ['previewBackup', 'backupClip', 'backup'];
  if (r.queued) return ['previewQuestion', 'questionClip', 'question'];
  if (r.leaked) return ['previewLeak', 'incidentTranscript', 'leak'];
  return ['previewFuture', 'future', 'future'];
}

function scoreLine(outcome) {
  const quiz = QUIZ[outcome];
  const points = quiz ? quiz.submitted.map((answer) => 4 + Number(answer === quiz.correct)) : [4, 4];
  return t('scoreLine', ...points);
}

function gradingQuiz() {
  const r = game.run;
  if (endingScene?.beat === 'answers' && r.backupGradePending) return 'backup';
  if (!r.outcome && r.queued && r.answersClosed && !r.checked) return 'clean';
  return null;
}

function focusGradeCard() {
  $('answer-list').querySelector('[data-grade-team]')?.focus({ preventScroll: true });
}

function gradeAnswer(kind, answer) {
  if (gradingQuiz() !== kind) return;
  if (answer !== QUIZ[kind].correct) {
    gradeFeedback = QUIZ[kind].hint;
    text('grade-feedback', gradeFeedback);
    return;
  }
  gradeFeedback = '';
  if (kind === 'clean') { step('checkAnswersMessage', (run) => { run.checked = true; }); return; }
  game.run.checked = true;
  record('backupGraded');
  endingScene.beat = 'winnerReady';
  save();
  render();
  $('backup-announce').focus({ preventScroll: true });
}

function renderAnswers() {
  const r = game.run;
  const grading = gradingQuiz();
  const kind = grading || (r.outcome === 'backup' && (r.checked || !endingScene) ? 'backup'
    : r.outcome === 'clean' || (!r.outcome && r.queued && r.answersClosed) ? 'clean' : null);
  $('answer-cards').hidden = !kind;
  if (!kind) return;
  const quiz = QUIZ[kind];
  $('answer-cards').dataset.grading = String(Boolean(grading));
  for (const id of ['grade-question', 'grade-prompt', 'grade-feedback']) $(id).hidden = !grading;
  text('grade-question', quiz.question);
  text('grade-prompt', kind === 'clean' ? 'gradePrompt' : 'gradeBackupPrompt');
  text('grade-feedback', gradeFeedback);
  $('score-slip').hidden = !r.checked || Boolean(r.outcome && (!endingScene || endingScene.beat === 'winnerReaction'));
  $('private-score').textContent = scoreLine(kind);
  $('pending-public-score').textContent = scoreLine('');
  $('answer-list').replaceChildren(...quiz.submitted.map((answer, index) => {
    const card = node('li', '', 'answer-card');
    const team = index === 0 ? 'teamBlue' : 'teamYellow';
    card.dataset.team = TEAMS[index];
    const content = [node('span', t(team), 'answer-team'),
      node('strong', OPTION_NUMBER[answer] + ' ' + t(quiz.options[answer]), 'answer-option')];
    if (grading) {
      const control = node('button', '', 'answer-select');
      control.type = 'button';
      control.dataset.gradeTeam = TEAMS[index];
      control.setAttribute('aria-describedby', 'grade-question grade-prompt');
      control.append(...content);
      control.addEventListener('click', () => gradeAnswer(kind, answer));
      card.append(control);
    } else {
      const correct = answer === quiz.correct;
      card.append(...content);
      card.dataset.correct = String(correct);
      card.append(node('span', t(correct ? 'answerCorrect' : 'answerWrong'), 'answer-mark'));
    }
    return card;
  }));
}

function classroomView() {
  const run = game.run;
  if (endingScene?.beat === 'classrooms') return classroomScene;
  if (!run.outcome && run.questionDelivered && !run.answersClosed) {
    return { kind: 'clean', phase: run.classroomAnswersReady ? 'ready' : classroomScene?.phase };
  }
  return null;
}

function renderClassrooms(view) {
  $('classrooms').hidden = !view;
  if (!view) return;
  const { kind, phase } = view;
  $('classrooms').dataset.phase = phase;
  for (const team of TEAMS) {
    const arrived = phase === 'ready' || (phase === 'first' && team === 'yellow');
    const state = arrived ? 'accepted' : phase === 'received' ? 'received' : 'solving';
    $(team + '-classroom').dataset.state = state;
    text(team + '-classroom-status', arrived ? 'classroomAnswerIn' : phase === 'received' ? 'classroomHeard' : 'classroomSolving');
  }
  const captions = { received: 'classroomBothHeard', solving: 'classroomThinking', first: kind === 'clean' ? 'classroomCleanFirst' : 'classroomBackupFirst', ready: 'classroomBothIn' };
  const message = t(captions[phase]);
  if ($('classrooms-line').textContent !== message) $('classrooms-line').textContent = message;
}

function liveEndingView() {
  if (!endingScene) return null;
  const { beat } = endingScene;
  if (beat === 'announce') return {
    title: 'winnerLiveTitle', caption: endingScene.kind === 'backup' ? 'winnerBackupCaption' : 'winnerLiveCaption', cue: 'winnerLiveCue',
    line: 'winnerLiveScene', status: 'winnerLiveStatus', mic: 'open', file: 'liveNotice', skip: 'winnerReactionSkip',
  };
  if (beat === 'winnerReaction') return {
    title: 'winnerReactionsTitle', cue: 'winnerReactionsCue',
    line: 'winnerReactionsScene', status: 'winnerReactionsTitle', mic: 'off', file: 'closed', published: true, skip: 'endingSkip',
  };
  if (beat === 'winnerReady') return {
    title: 'winnerReadyTitle', caption: 'winnerReadyCaption', cue: 'winnerReadyCue',
    line: 'winnerReadyCaption', status: 'winnerReadyTitle', mic: 'off', file: 'announcementStandby', standby: true,
  };
  if (beat === 'classrooms') return {
    title: 'backupLiveTitle', caption: 'backupClassroomsCaption', cue: 'backupClassroomsCue',
    line: 'backupClassroomsCaption', status: 'classroomTitle', mic: 'off', file: 'announcementStandby', standby: true,
  };
  if (beat === 'notice') return {
    title: 'holdLiveTitle', caption: endingFor(game.run).caption, cue: 'holdLiveCue',
    line: missedBackupAirtime(game.run) ? 'holdMissedAirtime' : 'holdLiveScene',
    status: 'holdLiveStatus', mic: 'jiuMic', file: 'liveNotice', skip: 'holdSkip',
  };
  if (beat === 'received') return {
    title: 'holdReceivedTitle', caption: 'holdStudentCaption', cue: 'holdReceivedCue',
    line: 'holdReceivedScene', status: 'holdReceivedStatus', mic: 'off', file: 'liveNotice', skip: 'holdAnswerSkip',
  };
  if (beat === 'heldAnswer') return {
    title: 'holdAnswerTitle', caption: 'holdAnswerCaption', cue: 'holdAnswerCue',
    line: 'holdAnswerScene', status: 'holdAnswerTitle', mic: 'jiuMic', file: 'liveNotice', skip: 'endingSkip',
  };
  if (beat === 'answers') return {
    title: 'backupLiveTitle', caption: 'backupAnswerCards', cue: 'backupAnswersCue',
    line: 'backupAnswersScene', status: 'backupAnswersStatus', mic: 'off', file: 'announcementStandby', standby: true,
  };
  return {
    title: 'backupLiveTitle', caption: beat === 'explain' ? game.run.briefed ? 'backupExplain' : 'backupRestartCaption' : 'backupClip',
    cue: beat === 'explain' ? 'backupExplainCue' : 'backupOnAirCue',
    line: 'backupOnAirScene', status: 'backupOnAirStatus', mic: 'jiuMic', file: 'backupNow', skip: 'backupSkip',
  };
}

function renderScene(live = liveEndingView()) {
  const r = game.run;
  const announcementStandby = inAnnouncementStandby(r);
  const ready = announcementStandby && (announcementSignal === 2 || r.announcementReady);
  const standbyLabel = announcementStandby || live?.standby ? 'announcementStandby'
    : !r.outcome && r.assigned && !r.handoffPending ? 'broadcastStandby' : '';
  const leadIn = PRE_BROADCAST[r.elapsed];
  const waiting = r.message === 'advanceMessage' || r.message === 'hallAdvanceMessage';
  const showOrigin = monitorSelection === 'future' && Boolean(game.previous);
  $('scene').dataset.room = r.room;
  text('place', r.room);
  const published = !live || live.published;
  $('scoreboard').textContent = scoreLine(published ? r.outcome : '');
  $('public-score-pending').hidden = !r.checked || Boolean(r.outcome && published);
  text('scene-line', live ? live.line
    : r.outcome ? RESULT_SCENES[r.outcome].text : r.swapBriefPending ? 'swapBriefScene' : r.queued && r.elapsed === CUE_TIME ? 'questionClip'
      : r.leaked && r.elapsed === CUE_TIME && incidentOpening ? (r.leakMicOff ? 'leakOpeningOff' : 'leakOpeningOn')
      : leadIn && waiting ? leadIn.caption
      : r.message || (game.loop > 1 ? 'remembered' : 'present'));
  $('pre-broadcast-line').hidden = !leadIn || waiting || r.message === 'teacherEnvelopeReply';
  if (!$('pre-broadcast-line').hidden) text('pre-broadcast-line', leadIn.caption);
  const onAir = !standbyLabel && (Boolean(live && !published) || r.handoffPending || (!r.outcome && !r.assigned));
  $('air-label').dataset.held = String(!onAir);
  $('air-label').dataset.mode = standbyLabel ? 'standby' : onAir ? 'live' : 'off';
  $('air-label').lastElementChild.textContent = standbyLabel ? t(standbyLabel) : onAir ? 'ON AIR' : 'OFF AIR';
  const micState = live?.mic ?? (r.handoffPending ? 'jiuMic' : r.mic && onAir ? 'open' : 'off');
  const pendingQuestion = awaitingQuestion(r);
  const file = live?.file ?? (r.outcome ? 'closed' : r.handoffPending ? 'liveNotice' : standbyLabel ? standbyLabel
    : r.swapBriefPending ? 'waiting' : r.leaked ? r.elapsed === CUE_TIME ? 'publicNow' : 'publicDone'
      : pendingQuestion ? 'questionDelivery' : r.queued && r.elapsed >= CUE_TIME ? 'cleanNow' : 'waiting');
  text('console-status', live?.status ?? (r.outcome ? 'closed' : r.handoffPending ? 'handoffOnAirStatus'
    : announcementStandby ? ready ? 'announcementConsoleReady' : 'announcementConsoleWaiting'
    : r.swapBriefPending ? 'cueSwapped' : r.assigned ? 'consoleHeld'
    : r.leaked ? 'consoleAccident' : pendingQuestion ? 'questionDeliveryStatus' : r.elapsed >= CUE_TIME ? 'consoleClean' : 'consoleReady'));
  text('mic-status', micState);
  text('file-status', file);
  text('headphone-status', announcementStandby ? 'announcementTalkback' : 'private');
  $('mic-channel').dataset.state = micState === 'off' ? 'off' : 'live';
  $('file-channel').dataset.state = ['publicNow', 'publicDone', 'cleanNow', 'backupNow', 'liveNotice', 'questionDelivery'].includes(file) ? 'live' : 'off';
  text('cue', live?.cue ??
    (r.outcome === 'backup' ? 'cueBackup' : r.outcome === 'held' ? 'cueHeldResult' : r.outcome === 'clean' ? 'cueCleanResult'
      : r.handoffPending ? 'handoffLiveCue' : announcementStandby ? ready ? 'announcementReadyCue' : 'announcementWaitingCue'
      : lastBackupChance(r) ? 'finalBackupTitle' : missedBackup(r) ? 'lateTight' : r.assigned ? 'cueHeld'
        : r.leaked ? r.leakMicOff ? 'cueOff' : 'cueOn'
          : r.queued ? r.swapBriefPending ? 'cueSwapped' : pendingQuestion ? 'questionDeliveryCue' : r.elapsed >= CUE_TIME ? 'questionDeliveredCue' : 'cueSwapped' : 'cuePending'), clock(r.elapsed));
  text('monitor-label', monitorInfo()[0]);
  $('monitor').disabled = Boolean(live || r.swapBriefPending || r.handoffPending);
  $('replay-incident').hidden = Boolean(live || r.outcome !== 'backup');
  $('incident-compare').hidden = Boolean(live || monitorSelection !== 'incidentTranscript');
  $('monitor-caption').hidden = !monitorSelection;
  if (monitorSelection) text('monitor-caption', monitorSelection);
  $('monitor-origin').hidden = !showOrigin;
  if (showOrigin) text('monitor-origin', 'monitorPrevious', clock(game.previous.minute), t(game.previous.text));
  $('save-excerpt').hidden = monitorSelection !== 'future' || known('leak');
}

function logRows(container) {
  $(container).replaceChildren(...game.run.log.map(({ minute, text: key }) => {
    const item = node('li');
    item.append(node('time', clock(minute)), node('span', t(key)));
    return item;
  }));
}

const epilogueUnlocked = () => game.unlocked.length === Object.keys(ENDINGS).length;

function renderGoals() {
  const run = game.run;
  const show = game.loop > 1 && run.elapsed === 0 && !run.outcome;
  $('loop-goals').hidden = !show;
  if (!show) return;
  const recommended = recommendedGoal();
  const goal = run.goal || recommended;
  for (const button of $('loop-goals').querySelectorAll('[data-goal]')) {
    const id = button.dataset.goal;
    text(button.id, LOOP_GOALS[id].label);
    button.setAttribute('aria-pressed', String(run.goal === id));
    button.dataset.suggested = String(!run.goal && recommended === id);
  }
  text('goal-tip', goal ? LOOP_GOALS[goal].tip : 'goalAllTip');
  $('goal-recommended').hidden = Boolean(run.goal || !recommended);
  if (recommended) text('goal-recommended', 'goalRecommended', t(LOOP_GOALS[recommended].label));
}

function renderAnnouncementCheck() {
  const r = game.run;
  const open = inAnnouncementStandby(r);
  $('announcement-check').hidden = !open;
  document.body.dataset.announcement = String(open);
  if (!open) return;
  const signals = r.announcementReady ? 2 : announcementSignal;
  $('announcement-check').dataset.signal = String(signals);
  for (const [team, needed] of [['yellow', 1], ['blue', 2]]) {
    $(team + '-announcement').dataset.state = signals >= needed ? 'accepted' : 'waiting';
    text(team + '-announcement-status', signals >= needed ? 'announcementSignalReady' : 'announcementSignalWaiting');
  }
  text('announcement-line', r.announcementReady ? 'announcementBothConfirmed'
    : ['announcementAsk', 'announcementYellow', 'announcementBlue'][signals]);
}

function renderEnding(live) {
  const r = game.run;
  $('ending').hidden = !r.outcome;
  if (!r.outcome) return;
  $('ending').dataset.beat = endingScene?.beat ?? 'result';
  for (const id of ['ending-count', 'ending-story', 'ending-next', 'rewind', 'end-replay']) $(id).hidden = Boolean(live);
  $('ending-skip').hidden = !live?.skip;
  $('ending-epilogue').hidden = Boolean(live) || !epilogueUnlocked();
  text('ending-epilogue', game.epilogueSeen ? 'epilogueReplay' : 'epilogueOpen');
  const ready = endingScene?.beat === 'winnerReady';
  $('backup-announce').hidden = !ready;
  $('ending-actions').hidden = Boolean(live && !live.skip && !ready);
  $('ending-on-air').hidden = !live || live.mic === 'off';
  $('ending-standby').hidden = !live?.standby;
  $('hold-receipts').hidden = r.outcome !== 'held' || endingScene?.beat === 'notice';
  $('hold-answer').hidden = r.outcome !== 'held' || Boolean(live);
  const reactions = WINNER_REACTIONS[r.outcome];
  $('winner-reactions').hidden = !reactions || Boolean(live && !live.published);
  if (reactions && !$('winner-reactions').hidden) {
    const { winner, winningLine, otherLine } = reactions;
    const other = winner === 'blue' ? 'yellow' : 'blue';
    for (const [id, team, line] of [['winner-room', winner, winningLine], ['other-room', other, otherLine]]) {
      $(id).dataset.team = team;
      text(id + '-title', team === 'blue' ? 'classroomBlue' : 'classroomYellow');
      text(id + '-line', line);
    }
  }
  if (live) {
    text('ending-skip', live.skip);
    text('ending-category', live.cue);
    text('ending-title', live.title);
    $('ending-caption').hidden = !live.caption;
    text('ending-caption', live.caption);
    return;
  }
  const ending = endingFor(r);
  $('ending-caption').hidden = false;
  if (r.outcome === 'backup') text('ending-category', 'backupResultLabel', scoreLine('backup'));
  else text('ending-category', 'endingLabel');
  text('ending-count', 'endingCount', game.unlocked.length);
  text('ending-title', ending.title);
  text('ending-caption', ending.caption);
  text('ending-story', ending.story);
  text('ending-next', epilogueUnlocked() ? 'endAll' : ending.next);
}
function render() {
  const r = game.run;
  const live = liveEndingView();
  const classrooms = classroomView();
  const minute = endingScene?.minute ?? r.elapsed;
  const remaining = LIMIT - minute;
  $('clock').textContent = clock(minute);
  text('budget', live?.status ?? (remaining === 1 ? 'budgetOne' : 'budget'), remaining);
  text('loop', 'round', game.loop);
  text('mission', live?.title ?? (gradingQuiz() ? 'missionGrade' : mission()));
  $('memory').hidden = !game.previous;
  if (game.previous) text('memory', 'previous', clock(game.previous.minute), t(game.previous.text));
  const hint = { logBackupClosed: 'rewindBackupHint', logBackupAirtimeMissed: 'rewindAirtimeHint' }[game.previous?.text];
  $('rewind-hint').hidden = !hint || r.elapsed !== 0;
  if (hint) text('rewind-hint', hint);
  $('journal-count').textContent = game.known.length;
  $('track').replaceChildren(...Array.from({ length: LIMIT }, (_, i) =>
    node('i', '', i < minute ? '' : i === CUE_TIME - 1 ? 'remaining deadline' : 'remaining')));
  document.body.dataset.urgent = String(!r.outcome && r.elapsed >= CUE_TIME - 1);
  document.body.dataset.incident = String(r.leaked);
  document.body.dataset.emergency = String(r.leaked && r.elapsed === CUE_TIME && !r.outcome);
  document.body.dataset.backupDeadline = String(lastBackupChance(r));
  document.body.dataset.delivery = String(r.queued && r.elapsed === CUE_TIME && !r.outcome);
  document.body.dataset.swapBrief = String(r.swapBriefPending);
  document.body.dataset.answering = String(r.queued && r.answersClosed && !r.outcome);
  document.body.dataset.classrooms = String(Boolean(classrooms));
  document.body.dataset.ended = String(Boolean(r.outcome));
  $('history').hidden = Boolean(live) || !r.log.length;
  $('journal-open').disabled = Boolean(live || r.handoffPending);
  $('replay-intro').disabled = Boolean(live || r.handoffPending);
  $('menu-epilogue').hidden = !epilogueUnlocked() || Boolean(live) || (!r.outcome && r.elapsed !== 0);
  text('menu-epilogue', game.epilogueSeen ? 'epilogueReplay' : 'epilogueOpen');
  renderSound();
  renderScene(live);
  renderGoals();
  $('swap-brief').hidden = !r.swapBriefPending;
  renderClassrooms(classrooms);
  renderAnswers();
  renderAnnouncementCheck();
  renderChoices();
  renderEnding(live);
  logRows('history-list');
  if ($('review-dialog').open) logRows('review-list');
}

function leakRecordingCopy() {
  if (game.run.leaked) return { title: 'leakClueThisRun', fact: 'leakFactThisRun', listen: 'leakListenThisRun' };
  if (game.leakOrigin === 'future') return {
    title: 'leakClueFuture', fact: game.run.queued ? 'leakFactPrevented' : 'leakFactFuture', listen: 'leakListenFuture',
  };
  if (game.leakOrigin === 'rewound') return { title: 'leakClueRewound', fact: 'leakFactRewound', listen: 'leakListenRewound' };
  return { title: 'leakClue', fact: 'leakFact', listen: 'leakSample' };
}

function renderJournal() {
  const leak = leakRecordingCopy();
  text('leak-listen', leak.listen);
  $('journal-clues').replaceChildren(...game.known.map((id) => {
    const clue = CLUES[id];
    const { title, fact } = id === 'leak' ? leak : clue;
    const item = node('li');
    item.append(node('h3', t(title)), node('p', t(fact)));
    if (clue.clip) {
      const listen = node('button', t('audioReplay'), 'utility');
      listen.type = 'button';
      listen.dataset.clip = id;
      listen.setAttribute('aria-label', t('audioReplay') + ' · ' + t(title));
      const transcript = node('p', t(clue.caption), 'clue-transcript');
      transcript.hidden = true;
      listen.addEventListener('click', () => {
        transcript.hidden = false;
        journalAudio = playAudio(clue.clip, true);
      });
      item.append(listen, transcript);
    }
    return item;
  }));
  $('compare-options').replaceChildren(...RECORDINGS.filter(known).map((id) => {
    const button = node('button', t(id === 'leak' ? leak.title : CLUES[id].title), 'utility');
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
  for (const id of ['practice', 'leak']) {
    $(id + '-sample').hidden = !known(id);
    $(id + '-sample-caption').hidden = true;
  }
  $('recording-missing').hidden = !known('leak') || known('practice');
  $('recording-pair').hidden = !known('leak') && !known('practice');
  renderComparison();
}
function renderComparison() {
  for (const button of $('compare-options').children) button.setAttribute('aria-pressed', String(selected.has(button.dataset.recording)));
  $('compare').disabled = selected.size !== 2 || known('proof');
  $('source-choice').hidden = !game.compared || known('proof') || !known('mic') || !known('schedule');
  text('source-prompt', game.run.leaked ? 'sourcePrompt' : 'sourcePromptFuture');
  $('connect').disabled = !selectedSource;
  for (const button of $('source-choice').querySelectorAll('[data-source]')) {
    button.setAttribute('aria-pressed', String(button.dataset.source === selectedSource));
  }
  const proof = game.run.leaked ? 'pairConnectedThisRun' : game.run.queued ? 'pairConnectedPrevented' : 'pairConnected';
  const feedback = comparisonFeedback || (known('proof') ? proof : game.compared
    ? !known('schedule') ? 'pairNeedSchedule' : !known('mic') ? 'pairNeedMic' : 'pairYes' : '');
  text('compare-feedback', feedback);
}
function openJournal() {
  if (audio !== incidentAudio) stopAudio();
  comparisonFeedback = '';
  selectedSource = '';
  renderJournal();
  $('journal').showModal();
  if (known('practice') && known('schedule') && !known('proof')) $('compare-area').scrollIntoView({ block: 'nearest' });
}
for (const id of ['practice', 'leak']) {
  $(id + '-listen').addEventListener('click', () => {
    const caption = $(id + '-sample-caption');
    caption.hidden = false;
    caption.textContent = t(CLUES[id].caption);
    journalAudio = playAudio(CLUES[id].clip, true);
  });
}
$('incident-compare').addEventListener('click', () => {
  openJournal();
  $('compare-title').focus();
});
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
$('journal').addEventListener('close', () => {
  if (audio === journalAudio) stopAudio();
  journalAudio = null;
  if (!endingScene) $('journal-open').focus({ preventScroll: true });
});
function playMonitor() {
  const [, caption, clip] = monitorInfo();
  monitorSelection = caption;
  renderScene();
  if (clip === 'question' && awaitingQuestion(game.run)) playQuestion(true);
  else if (clip === 'leak') playIncident(true);
  else playAudio(clip, true);
}
$('monitor').addEventListener('click', playMonitor);
$('replay-incident').addEventListener('click', () => {
  monitorSelection = 'incidentTranscript';
  renderScene();
  playIncident(true);
});
$('save-excerpt').addEventListener('click', () => {
  if (monitorSelection !== 'future' || known('leak')) return;
  learn('leak');
  game.leakOrigin = 'future';
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
for (const button of $('loop-goals').querySelectorAll('[data-goal]')) {
  button.addEventListener('click', () => {
    if ($('loop-goals').hidden || !Object.hasOwn(LOOP_GOALS, button.dataset.goal)) return;
    game.run.goal = button.dataset.goal;
    save();
    render();
  });
}

function renderEpilogue() {
  $('epilogue-view').dataset.shot = epilogueScene;
  $('epilogue-clock').textContent = epilogueScene === 'forward' ? '12:41' : '12:40';
  text('epilogue-frame', { record: 'epilogueRecordFrame', archive: 'epilogueArchiveFrame', forward: 'epilogueForwardFrame' }[epilogueScene]);
  $('epilogue-caption').hidden = epilogueScene === 'record';
  if (epilogueScene !== 'record') text('epilogue-caption', epilogueScene === 'forward' ? 'epilogueForwardCaption' : 'epilogueArchiveCaption');
  $('epilogue-advance').hidden = epilogueScene === 'forward';
  text('epilogue-advance', epilogueScene === 'record' ? 'epilogueRecordOpen' : 'epilogueAdvance');
}

function openEpilogue() {
  const run = game.run;
  if (!epilogueUnlocked() || endingScene || (!run.outcome && run.elapsed !== 0)) return;
  $('menu').open = false;
  stopAudio();
  epilogueScene = 'record';
  renderEpilogue();
  $('epilogue').showModal();
}

$('ending-epilogue').addEventListener('click', openEpilogue);
$('menu-epilogue').addEventListener('click', openEpilogue);
$('epilogue-advance').addEventListener('click', () => {
  if (!$('epilogue').open || epilogueScene === 'forward') return;
  if (epilogueScene === 'record') {
    epilogueScene = 'archive';
    renderEpilogue();
    playAudio('epilogueSave');
    return;
  }
  epilogueScene = 'forward';
  game.epilogueSeen = true;
  save();
  renderEpilogue();
  playAudio('epilogueClock');
  $('epilogue-close').focus();
});
$('epilogue-close').addEventListener('click', () => $('epilogue').close());
$('epilogue').addEventListener('close', () => {
  stopAudio();
  render();
  const back = game.run.outcome ? 'ending-epilogue' : 'menu-epilogue';
  if (back === 'menu-epilogue') $('menu').open = true;
  $(back).focus({ preventScroll: true });
});
$('end-replay').addEventListener('click', () => replayEnding(game.run, true));
$('ending-skip').addEventListener('click', () => {
  const scene = endingScene;
  if (!scene || $('ending-skip').hidden) return;
  if (scene.beat === 'explain' || scene.beat === 'question') startClassrooms('backup');
  else if (scene.beat === 'notice') showHoldReceipts(scene);
  else if (scene.beat === 'received') showHoldAnswer(scene);
  else if (scene.beat === 'announce') showWinnerReactions(scene);
  else finishEndingScene(false);
});
$('backup-announce').addEventListener('click', () => {
  if (endingScene?.beat === 'winnerReady') beginWinnerAnnouncement(endingScene);
});
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
if (game.run.outcome === 'backup' && game.run.backupGradePending) {
  const beat = game.run.checked ? 'winnerReady' : game.run.classroomAnswersReady ? 'answers' : 'classrooms';
  endingScene = { kind: 'backup', beat, minute: beat === 'classrooms' ? LIMIT - 1 : LIMIT, timers: [] };
  if (beat === 'classrooms') startClassrooms('backup');
  else render();
} else if (game.run.queued && !game.run.outcome && !game.run.answersClosed && game.run.questionDelivered && !game.run.classroomAnswersReady) {
  startClassrooms('clean');
} else {
  if (awaitingAnnouncementCheck(game.run)) startAnnouncementSignals(game.run);
  render();
}
save();
if (game.run.handoffPending && game.seen) playHandoffNotice(game.run);
if (!game.seen) openIntro();
