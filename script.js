const DATA_DIR = "data";
const EXAM_SIZE = 50;
const STORAGE_KEY = "haohao-a1a2-percorso-v1";

const personalModules = [
  "Persona e presentazione",
  "Lavoro e studio",
  "Tempo libero e hobby",
];
const highLifeModules = ["医疗", "药店", "餐厅", "超市", "城市问路", "火车站"];
const midLifeModules = ["公交车", "飞机", "租房", "邮局"];

let bank = [];
let samplingRules = {};
let scoringRules = {};
let diagnosisTemplate = "";
let exam = [];
let answers = {};
let currentIndex = 0;

const screens = {
  home: document.getElementById("homeView"),
  quiz: document.getElementById("quizView"),
  submit: document.getElementById("submitView"),
  result: document.getElementById("resultView"),
};

const startBtn = document.getElementById("startBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const backToQuizBtn = document.getElementById("backToQuizBtn");
const submitBtn = document.getElementById("submitBtn");

const questionCounter = document.getElementById("questionCounter");
const answeredBadge = document.getElementById("answeredBadge");
const progressBar = document.getElementById("progressBar");
const typeTag = document.getElementById("typeTag");
const moduleTag = document.getElementById("moduleTag");
const difficultyTag = document.getElementById("difficultyTag");
const questionStem = document.getElementById("questionStem");
const audioNotice = document.getElementById("audioNotice");
const optionsBox = document.getElementById("optionsBox");
const submitSummary = document.getElementById("submitSummary");
const resultPanel = document.getElementById("resultPanel");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function loadData() {
  const [questionFile, samplingFile, scoringFile, templateText] =
    await Promise.all([
      fetch(`${DATA_DIR}/question_bank_v1.json`).then((r) => r.json()),
      fetch(`${DATA_DIR}/sampling_rules_v1.json`).then((r) => r.json()),
      fetch(`${DATA_DIR}/scoring_rules_v1.json`).then((r) => r.json()),
      fetch(`${DATA_DIR}/diagnosis_template_v1.md`).then((r) => r.text()),
    ]);

  bank = questionFile.questions || [];
  samplingRules = samplingFile;
  scoringRules = scoringFile;
  diagnosisTemplate = templateText;
}

function groupForQuestion(q) {
  if (q.type === "语法运用") return "语法运用";
  if (q.type === "语言逻辑") return "语言逻辑";
  if (personalModules.includes(q.module)) return "高频个人交流场景";
  if (highLifeModules.includes(q.module)) return "高频生活场景";
  if (midLifeModules.includes(q.module)) return "中低频生活办事场景";
  return "高频生活场景";
}

function pickByDifficulty(pool, count, usedIds, difficultyNeed) {
  const picked = [];
  const candidates = shuffle(pool.filter((q) => !usedIds.has(q.id)));

  while (picked.length < count && candidates.length) {
    candidates.sort((a, b) => {
      const needA = difficultyNeed[a.difficulty] || 0;
      const needB = difficultyNeed[b.difficulty] || 0;
      return needB - needA || Math.random() - 0.5;
    });

    const selected = candidates.shift();
    picked.push(selected);
    usedIds.add(selected.id);
    difficultyNeed[selected.difficulty] = Math.max(
      0,
      (difficultyNeed[selected.difficulty] || 0) - 1
    );
  }

  return picked;
}

function buildExam() {
  const quota =
    samplingRules.locked_structure || {
      高频个人交流场景: 13,
      高频生活场景: 16,
      中低频生活办事场景: 6,
      语法运用: 10,
      语言逻辑: 5,
    };
  const difficultyNeed = { 1: 4, 2: 16, 3: 20, 4: 8, 5: 2 };
  const usedIds = new Set();
  const selected = [];

  Object.entries(quota).forEach(([group, count]) => {
    const pool = bank.filter((q) => groupForQuestion(q) === group);
    selected.push(...pickByDifficulty(pool, count, usedIds, difficultyNeed));
  });

  if (selected.length < EXAM_SIZE) {
    const rest = bank.filter((q) => !usedIds.has(q.id));
    selected.push(...pickByDifficulty(rest, EXAM_SIZE - selected.length, usedIds, difficultyNeed));
  }

  exam = shuffle(selected).slice(0, EXAM_SIZE);
  answers = {};
  currentIndex = 0;
  saveState();
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ examIds: exam.map((q) => q.id), answers, currentIndex })
  );
}

function restoreState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!Array.isArray(state.examIds) || state.examIds.length !== EXAM_SIZE) return false;
    const byId = new Map(bank.map((q) => [q.id, q]));
    exam = state.examIds.map((id) => byId.get(id)).filter(Boolean);
    if (exam.length !== EXAM_SIZE) return false;
    answers = state.answers || {};
    currentIndex = Math.min(Math.max(state.currentIndex || 0, 0), EXAM_SIZE - 1);
    return true;
  } catch {
    return false;
  }
}

function answeredCount() {
  return exam.filter((q) => answers[q.id]).length;
}

function renderQuestion() {
  const q = exam[currentIndex];
  questionCounter.textContent = `第 ${currentIndex + 1} / ${EXAM_SIZE} 题`;
  answeredBadge.textContent = `${answeredCount()} / ${EXAM_SIZE} 已答`;
  progressBar.style.width = `${Math.round((answeredCount() / EXAM_SIZE) * 100)}%`;
  typeTag.textContent = q.type;
  moduleTag.textContent = q.module;
  difficultyTag.textContent = `难度 ${q.difficulty}`;
  questionStem.textContent = q.stem;
  audioNotice.classList.toggle("hidden", q.audio_status !== "future_audio_required");

  optionsBox.innerHTML = ["A", "B", "C", "D"]
    .map((letter) => {
      const selected = answers[q.id] === letter ? " selected" : "";
      return `
        <button class="option-btn${selected}" type="button" data-answer="${letter}">
          <span class="option-letter">${letter}</span>
          <span>${escapeHtml(q.options[letter])}</span>
        </button>
      `;
    })
    .join("");

  prevBtn.disabled = currentIndex === 0;
  nextBtn.textContent = currentIndex === EXAM_SIZE - 1 ? "准备提交" : "下一题";
}

function selectAnswer(letter) {
  answers[exam[currentIndex].id] = letter;
  saveState();
  renderQuestion();
}

function showSubmit() {
  submitSummary.textContent = `你已完成 ${answeredCount()} / ${EXAM_SIZE} 题。未答题会按错误处理。`;
  showScreen("submit");
}

function pct(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function emptyStat() {
  return { correct: 0, total: 0, possible: 0, wrongTags: [], wrongIds: [] };
}

function addStat(map, key, isCorrect, points, q) {
  if (!map[key]) map[key] = emptyStat();
  map[key].total += isCorrect ? points : 0;
  map[key].possible += points;
  if (isCorrect) map[key].correct += 1;
  if (!isCorrect) {
    map[key].wrongTags.push(q.diagnostic_tag);
    map[key].wrongIds.push(q.id);
  }
}

function calculateResults() {
  const byModule = {};
  const byGroup = {};
  const byType = {};
  const byDimension = {};
  const byDifficulty = {};
  const wrongTags = {};
  let total = 0;

  exam.forEach((q) => {
    const isCorrect = answers[q.id] === q.answer;
    const points = scoringRules.question_score || 2;
    if (isCorrect) total += points;

    addStat(byModule, q.module, isCorrect, points, q);
    addStat(byGroup, groupForQuestion(q), isCorrect, points, q);
    addStat(byType, q.type, isCorrect, points, q);
    addStat(byDimension, q.dimension, isCorrect, points, q);
    addStat(byDifficulty, String(q.difficulty), isCorrect, points, q);
    if (!isCorrect) wrongTags[q.diagnostic_tag] = (wrongTags[q.diagnostic_tag] || 0) + 1;
  });

  return { total, byModule, byGroup, byType, byDimension, byDifficulty, wrongTags };
}

function statScore(stats, key) {
  return stats[key] ? stats[key].total : 0;
}

function statPossible(stats, key) {
  return stats[key] ? stats[key].possible : 0;
}

function combinedScore(stats, keys) {
  return keys.reduce(
    (sum, key) => {
      const stat = stats[key] || emptyStat();
      sum.total += stat.total;
      sum.possible += stat.possible;
      return sum;
    },
    { total: 0, possible: 0 }
  );
}

function determineLevel(result) {
  const lifeScore = statScore(result.byType, "真实生活场景");
  const grammarScore = statScore(result.byType, "语法运用");
  const logicScore = statScore(result.byType, "语言逻辑");
  const difficult = combinedScore(result.byDifficulty, ["4", "5"]);
  const personal = combinedScore(result.byModule, personalModules);
  const difficultOk = difficult.possible ? difficult.total / difficult.possible >= 0.7 : false;
  const personalOk = personal.possible ? personal.total / personal.possible >= 0.7 : false;

  const b1 =
    result.total >= 85 &&
    difficultOk &&
    lifeScore >= 55 &&
    logicScore >= 7 &&
    personalOk;

  if (b1) return { label: "B1预备水平", b1Ready: true };
  if (result.total >= 80 && lifeScore >= 52 && grammarScore >= 15 && logicScore >= 6) {
    return { label: "A2稳定达标", b1Ready: false };
  }
  if (result.total >= 70 && lifeScore >= 45 && grammarScore >= 12) {
    return { label: "A2基础达标", b1Ready: false };
  }
  return { label: "未达到A2", b1Ready: false };
}

function scoreCards(title, stats) {
  const cards = Object.entries(stats)
    .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
    .map(([name, stat]) => {
      const percent = pct(stat.total, stat.possible);
      return `
        <article class="score-card">
          <header><span>${escapeHtml(name)}</span><span>${stat.total}/${stat.possible}</span></header>
          <div class="progress-track"><span style="width:${percent}%"></span></div>
          <p>${percent}% ${stat.wrongIds.length ? `· 错题 ${stat.wrongIds.join("、")}` : "· 稳定"}</p>
        </article>
      `;
    })
    .join("");
  return `<h3>${escapeHtml(title)}</h3><div class="grid-list">${cards}</div>`;
}

function buildDiagnosis(result) {
  const entries = Object.entries(result.wrongTags).sort((a, b) => b[1] - a[1]);
  const weak = entries.filter(([, count]) => count >= 2).slice(0, 6);
  const strengths = Object.entries(result.byModule)
    .filter(([, stat]) => stat.possible && stat.total / stat.possible >= 0.8)
    .map(([name]) => name)
    .slice(0, 5);

  const weakHtml = weak.length
    ? `<ul>${weak.map(([tag]) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>`
    : "<p>没有明显集中薄弱点，建议继续保持。</p>";
  const strongHtml = strengths.length
    ? `<ul>${strengths.map((name) => `<li>${escapeHtml(name)} 掌握良好</li>`).join("")}</ul>`
    : "<p>优势模块还不够集中，建议先把高频个人交流和生活场景做稳。</p>";

  return `
    <div class="diagnosis-card">
      <h3>自动诊断</h3>
      <p class="score-pill">诊断模板已读取 · ${diagnosisTemplate ? "已启用" : "未读取"}</p>
      <h4>你的优势</h4>
      ${strongHtml}
      <h4>建议加强</h4>
      ${weakHtml}
    </div>
  `;
}

function renderResults() {
  const result = calculateResults();
  const level = determineLevel(result);
  const b1Text = level.b1Ready
    ? "已达到 B1 预备水平"
    : "建议继续巩固 A2 核心能力";

  resultPanel.innerHTML = `
    <section class="result-hero">
      <p class="kicker">测试报告</p>
      <div class="score-number">${result.total} / 100</div>
      <div class="level">${level.label}</div>
      <p class="${level.b1Ready ? "ok" : "warn"}">${b1Text}</p>
    </section>

    ${scoreCards("各模块表现", result.byModule)}
    ${scoreCards("能力维度", result.byDimension)}
    ${buildDiagnosis(result)}

    <div class="stack-actions">
      <button class="ghost-btn" type="button" id="reviewBtn">返回查看题目</button>
      <button class="primary-btn" type="button" id="restartBtn">重新抽题</button>
    </div>
  `;

  document.getElementById("reviewBtn").addEventListener("click", () => showScreen("quiz"));
  document.getElementById("restartBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    buildExam();
    renderQuestion();
    showScreen("quiz");
  });
  showScreen("result");
}

startBtn.addEventListener("click", () => {
  buildExam();
  renderQuestion();
  showScreen("quiz");
});

optionsBox.addEventListener("click", (event) => {
  const button = event.target.closest(".option-btn");
  if (!button) return;
  selectAnswer(button.dataset.answer);
});

prevBtn.addEventListener("click", () => {
  currentIndex = Math.max(0, currentIndex - 1);
  saveState();
  renderQuestion();
});

nextBtn.addEventListener("click", () => {
  if (currentIndex === EXAM_SIZE - 1) {
    showSubmit();
    return;
  }
  currentIndex += 1;
  saveState();
  renderQuestion();
});

backToQuizBtn.addEventListener("click", () => showScreen("quiz"));
submitBtn.addEventListener("click", renderResults);

loadData()
  .then(() => {
    if (restoreState()) {
      renderQuestion();
    }
  })
  .catch((error) => {
    document.body.innerHTML = `<main class="app"><section class="hero"><h2>数据读取失败</h2><p>${escapeHtml(error.message)}</p></section></main>`;
  });
