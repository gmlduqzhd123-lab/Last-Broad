'use strict';

const LIMIT = 8;
const CUE_TIME = 4;
const INTRO_LENGTH = 20000;
const SAVE_KEY = 'hallyeo-fm-quiz-final-v1';
const AUDIO = {
  future: 'future-review', opening: 'opening', leak: 'answer', door: 'door',
  question: 'question', hold: 'hold', backup: 'backup', clean: 'clean', student: 'student', deadline: 'deadline-v6',
  handoffKnown: 'handoff-known', holdKnown: 'hold-known', backupKnown: 'backup-known',
  closeClean: 'close-clean', closeHeld: 'close-held', closeBackup: 'close-backup',
  winnerLive: 'winner-live', winnerBackup: 'winner-backup', holdStudent: 'hold-student', practice: 'practice',
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
  backup: { title: 'endBackupTitle', caption: 'endBackupCaption', story: 'endBackupStory', next: 'endBackupNext', clip: 'backup' },
  clean: { title: 'endCleanTitle', caption: 'endCleanCaption', story: 'endCleanStory', next: 'endCleanNext', clip: 'clean' },
};
const EXPLAINED_ENDINGS = {
  held: { caption: 'endHeldKnownCaption', story: 'endHeldKnownStory', next: 'endHeldKnownNext', clip: 'holdKnown' },
  backup: { caption: 'endBackupKnownCaption', story: 'endBackupKnownStory', clip: 'backupKnown' },
};
const RESULT_SCENES = {
  clean: { text: 'cleanResultScene', clip: 'closeClean' },
  backup: { text: 'backupResultScene', clip: 'closeBackup' },
  held: { text: 'heldResultScene', clip: 'closeHeld' },
};
const QUIZ = {
  clean: { options: ['optionThermometer', 'optionScale', 'optionVane'], submitted: [1, 2], correct: 2, question: 'gradeCleanQuestion', hint: 'gradeCleanHint' },
  backup: { options: ['optionSolid', 'optionLiquid', 'optionGas'], submitted: [0, 1], correct: 0, question: 'gradeBackupQuestion', hint: 'gradeBackupHint' },
};
const TEAMS = ['blue', 'yellow'];
const WINNER_AUDIO = { clean: 'winnerLive', backup: 'winnerBackup' };
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
  elapsed: 0, room: 'studio', mic: true, queued: false, leaked: false, leakMicOff: false,
  assigned: false, backup: false, returned: false, briefed: false,
  previewChecked: false, classroomsReady: false, questionDelivered: false, classroomAnswersReady: false,
  answersClosed: false, checked: false, winnerCard: false,
  outcome: '', backupGradePending: false, message: '', log: [],
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
    if (fresh.known.includes('schedule') && !fresh.known.includes('finalQuestion')) fresh.known.push('finalQuestion');
    if (Array.isArray(saved.unlocked)) fresh.unlocked = [...new Set(saved.unlocked.filter((id) => Object.hasOwn(ENDINGS, id)))];
    const previous = saved.previous;
    if (Number.isInteger(previous?.minute) && previous.minute >= 0 && previous.minute <= LIMIT
      && Object.hasOwn(SCHOOL_COPY, previous.text)) fresh.previous = previous;
    const run = saved.run;
    if (!run || !Number.isInteger(run.elapsed) || run.elapsed < 0 || run.elapsed > LIMIT
      || (run.room !== 'studio' && run.room !== 'hall') || (run.outcome && !Object.hasOwn(ENDINGS, run.outcome))) return fresh;
    fresh.run = { ...fresh.run, ...run };
    if (run.checked) fresh.run.answersClosed = true;
    if (run.queued && run.elapsed > CUE_TIME) fresh.run.questionDelivered = true;
    if (!Object.hasOwn(run, 'classroomAnswersReady') && (fresh.run.questionDelivered || run.backupGradePending)) {
      fresh.run.classroomAnswersReady = true;
    }
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
let endingScene;
let classroomScene;
let incidentOpening = false;
let incidentAudio;
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
  if (game.sound && !intro && awaitingQuestion(game.run)) playQuestion();
}
function renderSound() {
  for (const id of ['sound', 'intro-sound']) {
    $(id).setAttribute('aria-pressed', String(game.sound));
    text(id, game.sound ? 'soundOn' : 'soundOff');
  }
}

function record(key) { game.run.log.push({ minute: game.run.elapsed, text: key }); }

const awaitingQuestion = (run) => run.queued && run.elapsed === CUE_TIME && !run.questionDelivered && !run.outcome;
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
  if (run.briefed && EXPLAINED_ENDINGS[run.outcome]) return { ...basic, ...EXPLAINED_ENDINGS[run.outcome] };
  return run.outcome === 'held' && !run.leakMicOff ? { ...basic, story: 'endHeldOther' } : basic;
}

function replayEnding(run, explicit = false) {
  const ending = endingFor(run);
  if (!ending) return;
  const close = () => playAudio(RESULT_SCENES[run.outcome].clip, explicit);
  if (run.outcome === 'clean') { playAudio(WINNER_AUDIO.clean, explicit, close); return; }
  playAudio(ending.clip, explicit, () => {
    if (run.outcome === 'held') playAudio('holdStudent', explicit, close);
    else playAudio(WINNER_AUDIO.backup, explicit, close);
  });
}

function briefJiu(run) {
  if (!known('proof') || run.briefed) return;
  run.briefed = true;
  record('logBriefed');
}

const canStartBackup = (run) => run.leaked && !run.assigned && run.elapsed === CUE_TIME;
const missedBackup = (run) => run.leaked && !run.assigned && run.elapsed > CUE_TIME;
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
  if (r.backupGradePending) {
    r.backupGradePending = false;
    commitEnding(r);
  }
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
  let started = false;
  const deliver = () => {
    if (scene.beat === 'explain' || scene.beat === 'question') startClassrooms('backup');
  };
  function begin(voiced) {
    if (started || endingScene !== scene || !['explain', 'question'].includes(scene.beat)) return;
    started = true;
    // The explained recording has a short announcement before the question.
    const questionAt = run.briefed ? (voiced ? 6700 : 2200) : 0;
    const answersAt = questionAt + (voiced ? 9100 : 3900);
    if (run.briefed) later(scene, questionAt, () => {
      scene.beat = 'question';
      render();
    });
    later(scene, answersAt, deliver);
  }
  const player = playAudio(endingFor(run).clip, false, deliver);
  if (!player) { begin(false); return; }
  player.addEventListener('playing', () => begin(true), { once: true });
  later(scene, 2200, () => {
    if (!started) {
      if (audio === player) stopAudio();
      begin(false);
    }
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
  playEndingBeat(scene, 'holdStudent', 3800, finishEndingScene);
}

function beginWinnerAnnouncement(scene) {
  scene.beat = 'announce';
  render();
  $('ending-title').focus({ preventScroll: true });
  playEndingBeat(scene, WINNER_AUDIO[scene.kind], 2900, finishEndingScene);
}

function finish(kind) {
  const r = game.run;
  const minute = r.elapsed;
  r.elapsed = LIMIT;
  r.outcome = kind;
  const beats = { backup: r.briefed ? 'explain' : 'question', clean: 'announce', held: 'notice' };
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
  gradeFeedback = '';
  incidentOpening = false;
  monitorSelection = null;
  stopAudio();
  if (apply) apply(r);
  r.elapsed += 1;
  r.message = message;
  if (message) record(message);
  if (r.elapsed === CUE_TIME) {
    if (r.queued) {
      record('logQuestionStarted');
      r.message = 'cueClean';
      playQuestion();
    } else {
      r.leaked = true;
      r.leakMicOff = !r.mic;
      learn('mic');
      learn('leak');
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
  save();
  render();
  if (gradingQuiz()) focusGradeCard();
  else $('actions').querySelector('[data-primary="true"]')?.focus({ preventScroll: true });
}

function rewind() {
  if (endingScene) return;
  const r = game.run;
  const broadcasts = ['logClean', 'logBackup', 'logLeakOff', 'logLeakOn', 'logQuestionStarted'];
  const moment = r.log.findLast((entry) => entry.text === 'logBackupClosed')
    ?? r.log.findLast((entry) => broadcasts.includes(entry.text))
    ?? r.log.findLast((entry) => entry.text === 'logProof');
  game.previous = moment ?? { minute: r.elapsed, text: 'logNoEnd' };
  game.loop += 1;
  game.run = newRun();
  classroomScene = null;
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

function mission() {
  const r = game.run;
  if (r.outcome) return 'missionEnd';
  if (r.leaked) {
    if (r.assigned && !r.backup) return 'missionGet';
    if (r.backup && !r.returned) return 'missionReturn';
    if (r.returned) return 'missionUse';
    return canStartBackup(r) ? 'missionLate' : 'missionHold';
  }
  if (awaitingQuestion(r)) return 'missionQuestionDelivery';
  if (r.questionDelivered && !r.classroomAnswersReady && !r.answersClosed) return 'classroomTitle';
  if (r.elapsed >= CUE_TIME) return 'missionClean';
  if (r.queued) return 'missionClean';
  if (known('proof')) return 'missionFix';
  if (known('practice') && known('schedule')) return 'missionCompare';
  return 'missionFind';
}

function actionChoices() {
  const r = game.run;
  const choices = [];
  function offer(id, detail, run, free = false, label = id) { choices.push({ id, detail, run, free, label }); }
  if (r.leaked) {
    if (canStartBackup(r)) {
      const explain = known('proof');
      const inHall = r.room === 'hall';
      const detail = inHall ? 'handoffHallDetail' : explain ? 'handoffKnownDetail' : 'handoffDetail';
      offer('handoff', detail, () => {
        step(explain ? 'handoffKnownMessage' : 'handoffMessage', (run) => {
          briefJiu(run);
          run.room = 'hall';
          run.assigned = true;
        });
        if (explain) playAudio('handoffKnown');
      }, false, inHall ? 'handoffHall' : 'handoff');
    }
    if (r.assigned && !r.backup && r.elapsed <= 5) offer('getBackup', 'getDetail', () => step('getMessage', (run) => { run.backup = true; }));
    if (r.backup && !r.returned && r.elapsed <= 6) offer('returnStudio', 'returnDetail', () => step('returnMessage', (run) => { run.room = 'studio'; run.returned = true; }));
    if (r.returned) offer('useBackup', 'useDetail', () => step('backupClip', (run) => {
      briefJiu(run);
      record('logBackup');
    }, 'backup'));
    offer('hold', 'holdDetail', () => step('', briefJiu, 'held'));
    if (r.room === 'studio' && !known('practice')) offer('practice', 'practiceDetail', () => step('practiceMessage', () => learn('practice')));
    if (r.room === 'studio' && !known('schedule')) offer('schedule', 'scheduleDetail', () => step('scheduleMessage', learnSchedule));
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
  offer('advance', 'advanceDetail', () => step(r.room === 'hall' ? 'hallAdvanceMessage' : 'advanceMessage'));
  return choices;
}

function renderChoices() {
  const r = game.run;
  $('choices').hidden = Boolean(r.outcome || gradingQuiz() || (r.questionDelivered && !r.classroomAnswersReady));
  $('review').hidden = !r.elapsed || Boolean(r.outcome);
  if ($('choices').hidden) { $('actions').replaceChildren(); return; }
  $('actions').replaceChildren(...actionChoices().map(({ id, detail, run, free, label = id }, index) => {
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
  $('score-slip').hidden = !r.checked || Boolean(r.outcome && !endingScene);
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
  const first = kind === 'clean' ? 'blue' : 'yellow';
  for (const team of TEAMS) {
    const arrived = phase === 'ready' || (phase === 'first' && team === first);
    const state = arrived ? 'accepted' : phase === 'received' ? 'received' : 'solving';
    $(team + '-classroom').dataset.state = state;
    text(team + '-classroom-status', arrived ? 'classroomAnswerIn' : phase === 'received' ? 'classroomHeard' : 'classroomSolving');
  }
  const captions = { received: 'classroomBothHeard', solving: 'classroomThinking', first: kind === 'clean' ? 'classroomBlueFirst' : 'classroomYellowFirst', ready: 'classroomBothIn' };
  const message = t(captions[phase]);
  if ($('classrooms-line').textContent !== message) $('classrooms-line').textContent = message;
}

function liveEndingView() {
  if (!endingScene) return null;
  const { beat } = endingScene;
  if (beat === 'announce') return {
    title: 'winnerLiveTitle', caption: endingScene.kind === 'backup' ? 'winnerBackupCaption' : 'winnerLiveCaption', cue: 'winnerLiveCue',
    line: 'winnerLiveScene', status: 'winnerLiveStatus', mic: 'open', file: 'liveNotice', skip: 'endingSkip',
  };
  if (beat === 'winnerReady') return {
    title: 'winnerReadyTitle', caption: 'winnerReadyCaption', cue: 'winnerReadyCue',
    line: 'winnerReadyCaption', status: 'winnerReadyTitle', mic: 'off', file: 'waiting',
  };
  if (beat === 'classrooms') return {
    title: 'backupLiveTitle', caption: 'backupClassroomsCaption', cue: 'backupClassroomsCue',
    line: 'backupClassroomsCaption', status: 'classroomTitle', mic: 'off', file: 'waiting',
  };
  if (beat === 'notice') return {
    title: 'holdLiveTitle', caption: endingFor(game.run).caption, cue: 'holdLiveCue',
    line: 'holdLiveScene', status: 'holdLiveStatus', mic: 'jiuMic', file: 'liveNotice', skip: 'holdSkip',
  };
  if (beat === 'received') return {
    title: 'holdReceivedTitle', caption: 'holdStudentCaption', cue: 'holdReceivedCue',
    line: 'holdReceivedScene', status: 'holdReceivedStatus', mic: 'off', file: 'liveNotice', skip: 'endingSkip',
  };
  if (beat === 'answers') return {
    title: 'backupLiveTitle', caption: 'backupAnswerCards', cue: 'backupAnswersCue',
    line: 'backupAnswersScene', status: 'backupAnswersStatus', mic: 'off', file: 'waiting',
  };
  return {
    title: 'backupLiveTitle', caption: beat === 'explain' ? 'backupExplain' : 'backupClip',
    cue: beat === 'explain' ? 'backupExplainCue' : 'backupOnAirCue',
    line: 'backupOnAirScene', status: 'backupOnAirStatus', mic: 'jiuMic', file: 'backupNow', skip: 'backupSkip',
  };
}

function renderScene(live = liveEndingView()) {
  const r = game.run;
  const showOrigin = monitorSelection === 'future' && Boolean(game.previous);
  $('scene').dataset.room = r.room;
  text('place', r.room);
  $('scoreboard').textContent = scoreLine(live ? '' : r.outcome);
  $('public-score-pending').hidden = !r.checked || Boolean(r.outcome && !live);
  text('scene-line', live ? live.line
    : r.outcome ? RESULT_SCENES[r.outcome].text : r.queued && r.elapsed === CUE_TIME ? 'questionClip'
      : r.leaked && r.elapsed === CUE_TIME && incidentOpening ? (r.leakMicOff ? 'leakOpeningOff' : 'leakOpeningOn')
      : r.message || (game.loop > 1 ? 'remembered' : 'present'));
  const onAir = Boolean(live) || (!r.outcome && !r.assigned);
  $('air-label').dataset.held = String(!onAir);
  $('air-label').lastElementChild.textContent = onAir ? 'ON AIR' : 'OFF AIR';
  const micState = live?.mic ?? (r.mic && onAir ? 'open' : 'off');
  const pendingQuestion = awaitingQuestion(r);
  const file = live?.file ?? (r.outcome ? 'closed'
    : r.assigned ? 'held' : r.leaked ? r.elapsed === CUE_TIME ? 'publicNow' : 'publicDone'
      : pendingQuestion ? 'questionDelivery' : r.queued && r.elapsed >= CUE_TIME ? 'cleanNow' : 'waiting');
  text('console-status', live?.status ?? (r.outcome ? 'closed' : r.assigned ? 'consoleHeld'
    : r.leaked ? 'consoleAccident' : pendingQuestion ? 'questionDeliveryStatus' : r.elapsed >= CUE_TIME ? 'consoleClean' : 'consoleReady'));
  text('mic-status', micState);
  text('file-status', file);
  text('headphone-status', 'private');
  $('mic-channel').dataset.state = micState === 'off' ? 'off' : 'live';
  $('file-channel').dataset.state = ['publicNow', 'publicDone', 'cleanNow', 'backupNow', 'liveNotice', 'questionDelivery'].includes(file) ? 'live' : 'off';
  text('cue', live?.cue ??
    (r.outcome === 'backup' ? 'cueBackup' : r.outcome === 'held' ? 'cueHeldResult' : r.outcome === 'clean' ? 'cueCleanResult'
      : missedBackup(r) ? 'lateTight' : r.assigned ? 'cueHeld'
        : r.leaked ? r.leakMicOff ? 'cueOff' : 'cueOn'
          : r.queued ? pendingQuestion ? 'questionDeliveryCue' : r.elapsed >= CUE_TIME ? 'questionDeliveredCue' : 'cueSwapped' : 'cuePending'));
  text('monitor-label', monitorInfo()[0]);
  $('monitor').disabled = Boolean(live);
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
function renderEnding(live) {
  const r = game.run;
  $('ending').hidden = !r.outcome;
  if (!r.outcome) return;
  $('ending').dataset.beat = endingScene?.beat ?? 'result';
  for (const id of ['ending-count', 'ending-story', 'ending-next', 'rewind', 'end-replay']) $(id).hidden = Boolean(live);
  $('ending-skip').hidden = !live?.skip;
  const ready = endingScene?.beat === 'winnerReady';
  $('backup-announce').hidden = !ready;
  $('ending-actions').hidden = Boolean(live && !live.skip && !ready);
  $('ending-on-air').hidden = !live || live.mic === 'off';
  $('hold-receipts').hidden = r.outcome !== 'held' || endingScene?.beat === 'notice';
  if (live) {
    text('ending-skip', live.skip);
    text('ending-category', live.cue);
    text('ending-title', live.title);
    text('ending-caption', live.caption);
    return;
  }
  const ending = endingFor(r);
  if (r.outcome === 'backup') text('ending-category', 'backupResultLabel', scoreLine('backup'));
  else text('ending-category', 'endingLabel');
  text('ending-count', 'endingCount', game.unlocked.length);
  text('ending-title', ending.title);
  text('ending-caption', ending.caption);
  text('ending-story', ending.story);
  text('ending-next', game.unlocked.length === 3 ? 'endAll' : ending.next);
}
function render() {
  const r = game.run;
  const live = liveEndingView();
  const classrooms = classroomView();
  const minute = endingScene?.minute ?? r.elapsed;
  $('clock').textContent = clock(minute);
  text('budget', live?.status ?? 'budget', LIMIT - minute);
  text('loop', 'round', game.loop);
  text('mission', live?.title ?? (gradingQuiz() ? 'missionGrade' : mission()));
  $('memory').hidden = !game.previous;
  if (game.previous) text('memory', 'previous', clock(game.previous.minute), t(game.previous.text));
  $('rewind-hint').hidden = game.previous?.text !== 'logBackupClosed' || r.elapsed !== 0;
  $('journal-count').textContent = game.known.length;
  $('track').replaceChildren(...Array.from({ length: LIMIT }, (_, i) =>
    node('i', '', i < minute ? '' : i === CUE_TIME - 1 ? 'remaining deadline' : 'remaining')));
  document.body.dataset.urgent = String(!r.outcome && r.elapsed >= CUE_TIME - 1);
  document.body.dataset.incident = String(r.leaked);
  document.body.dataset.emergency = String(r.leaked && r.elapsed === CUE_TIME && !r.outcome);
  document.body.dataset.delivery = String(r.queued && r.elapsed === CUE_TIME && !r.outcome);
  document.body.dataset.answering = String(r.queued && r.answersClosed && !r.outcome);
  document.body.dataset.classrooms = String(Boolean(classrooms));
  document.body.dataset.ended = String(Boolean(r.outcome));
  $('history').hidden = Boolean(live) || !r.log.length;
  $('journal-open').disabled = Boolean(live);
  $('replay-intro').disabled = Boolean(live);
  renderSound();
  renderScene(live);
  renderClassrooms(classrooms);
  renderAnswers();
  renderChoices();
  renderEnding(live);
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
  $('connect').disabled = !selectedSource;
  for (const button of $('source-choice').querySelectorAll('[data-source]')) {
    button.setAttribute('aria-pressed', String(button.dataset.source === selectedSource));
  }
  const feedback = comparisonFeedback || (known('proof') ? 'pairConnected' : game.compared
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
$('end-replay').addEventListener('click', () => replayEnding(game.run, true));
$('ending-skip').addEventListener('click', () => {
  const scene = endingScene;
  if (!scene || $('ending-skip').hidden) return;
  if (scene.beat === 'explain' || scene.beat === 'question') startClassrooms('backup');
  else if (scene.beat === 'notice') showHoldReceipts(scene);
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
  render();
}
save();
if (!game.seen) openIntro();
