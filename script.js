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
  if (result.total >= 85) return { label: "A2稳定达标", advice: "A2 核心能力比较稳定，可以开始更系统地进入下一阶段学习。" };
  if (result.total >= 70) return { label: "A2基础达标", advice: "A2 基础已经建立，建议根据错题集中补强薄弱模块。" };
  if (result.total >= 60) return { label: "A2起步", advice: "已经接近 A2 要求，建议先复习高频生活场景和基础语法。" };
  return { label: "A1阶段", advice: "建议先回到 A1 核心表达，把自我介绍、日常场景和基础句型做稳。" };
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
  const heading = title ? `<h3>${escapeHtml(title)}</h3>` : "";
  return `${heading}<div class="grid-list">${cards}</div>`;
}

function summaryGroupForQuestion(q) {
  if (q.type === "语法运用") return "语法运用";
  if (q.type === "语言逻辑") return "语言逻辑";
  if (personalModules.includes(q.module)) return "个人介绍 / 工作 / 兴趣";
  if (["公交车", "飞机", "火车站"].includes(q.module)) return "交通出行";
  if (["医疗", "药店"].includes(q.module)) return "医疗药店";
  return "生活场景";
}

function calculateSummaryGroups() {
  const groups = {
    "个人介绍 / 工作 / 兴趣": emptyStat(),
    生活场景: emptyStat(),
    交通出行: emptyStat(),
    医疗药店: emptyStat(),
    语法运用: emptyStat(),
    语言逻辑: emptyStat(),
  };

  exam.forEach((q) => {
    const isCorrect = answers[q.id] === q.answer;
    const points = scoringRules.question_score || 2;
    addStat(groups, summaryGroupForQuestion(q), isCorrect, points, q);
  });

  return groups;
}

function diagnosisSummary(result) {
  const entries = Object.entries(result.wrongTags).sort((a, b) => b[1] - a[1]);
  const weak = entries.slice(0, 4);
  const strengths = Object.entries(result.byModule)
    .filter(([, stat]) => stat.possible && stat.total / stat.possible >= 0.8)
    .map(([name]) => name)
    .slice(0, 3);

  return { weak, strengths };
}

function buildStudyAdvice(result) {
  const { weak } = diagnosisSummary(result);
  const nextStep = weak.length
    ? `优先复习：${weak.map(([tag]) => tag).slice(0, 3).join("、")}。`
    : "继续保持，并尝试做更多综合表达练习。";

  return `
    <section class="report-section">
      <div class="diagnosis-card">
        <h3>📈 学习建议</h3>
        <p>${escapeHtml(nextStep)}</p>
      </div>
    </section>
  `;
}

function buildAutoDiagnosis(result, level) {
  const { weak, strengths } = diagnosisSummary(result);

  const weakHtml = weak.length
    ? `<ul>${weak.map(([tag]) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>`
    : "<p>没有明显集中薄弱点，建议继续保持。</p>";
  const strongHtml = strengths.length
    ? `<ul>${strengths.map((name) => `<li>${escapeHtml(name)} 掌握良好</li>`).join("")}</ul>`
    : "<p>本次优势还不够集中，可以先看错题回顾。</p>";

  return `
    <section class="report-section">
      <div class="diagnosis-card">
        <h3>自动诊断</h3>
        <p>${escapeHtml(level.advice)}</p>
        <h4>你的优势</h4>
        ${strongHtml}
        <h4>建议加强</h4>
        ${weakHtml}
        ${scoreCards("能力维度分析", result.byDimension)}
      </div>
    </section>
  `;
}

function formatAnswer(q, letter) {
  if (!letter || !q.options[letter]) return "未作答";
  return `${letter}. ${q.options[letter]}`;
}

function wrongOptionClass(q, letter, selectedLetter) {
  if (letter === q.answer) return " correct";
  if (letter === selectedLetter && selectedLetter !== q.answer) return " wrong";
  return "";
}

function wrongOptionNote(q, letter, selectedLetter) {
  const notes = [];
  if (letter === selectedLetter) notes.push("你的答案");
  if (letter === q.answer) notes.push("正确答案");
  return notes.length ? `<span class="answer-note">${notes.join(" / ")}</span>` : "";
}

function buildWrongReview() {
  const wrongQuestions = exam.filter((q) => answers[q.id] !== q.answer);

  if (!wrongQuestions.length) {
    return `
      <section class="wrong-review report-section">
        <h3>📌 错题回顾（最重要）</h3>
        <div class="empty-wrong-card">太棒了！本次测试没有错题。</div>
      </section>
    `;
  }

  const cards = wrongQuestions
    .map((q) => {
      const selectedLetter = answers[q.id];
      const explanation = q.explanation || "";
      const options = ["A", "B", "C", "D"]
        .map((letter) => {
          const optionClass = wrongOptionClass(q, letter, selectedLetter);
          return `
            <li class="wrong-option${optionClass}">
              <span class="wrong-option-letter">${letter}.</span>
              <span class="wrong-option-text">${escapeHtml(q.options[letter] || "")}</span>
              ${wrongOptionNote(q, letter, selectedLetter)}
            </li>
          `;
        })
        .join("");

      return `
        <article class="wrong-card">
          <header>
            <strong>${escapeHtml(q.id)}</strong>
            <span>${escapeHtml(q.module)}</span>
          </header>
          <div class="wrong-stem">
            <span>题目：</span>
            <p>${escapeHtml(q.stem)}</p>
          </div>
          <ol class="wrong-options" aria-label="${escapeHtml(q.id)} 选项">
            ${options}
          </ol>
          <dl class="wrong-meta">
            <div>
              <dt>你的答案：</dt>
              <dd class="wrong-answer">${escapeHtml(formatAnswer(q, selectedLetter))}</dd>
            </div>
            <div>
              <dt>正确答案：</dt>
              <dd class="correct-answer">${escapeHtml(formatAnswer(q, q.answer))}</dd>
            </div>
            <div>
              <dt>诊断标签：</dt>
              <dd>${escapeHtml(q.diagnostic_tag || "暂无")}</dd>
            </div>
            <div>
              <dt>解析：</dt>
              <dd>${escapeHtml(explanation)}</dd>
            </div>
          </dl>
        </article>
      `;
    })
    .join("");

  return `
    <section class="wrong-review report-section">
      <h3>📌 错题回顾（最重要）</h3>
      <div class="wrong-list">${cards}</div>
    </section>
  `;
}

function renderResults() {
  const result = calculateResults();
  const level = determineLevel(result);

  resultPanel.innerHTML = `
    <section class="result-hero">
      <p class="kicker">测试报告</p>
      <div class="result-summary">
        <div>
          <span>① 分数</span>
          <strong class="score-number">${result.total} / 100</strong>
        </div>
        <div>
          <span>② 当前等级</span>
          <strong class="level">${escapeHtml(level.label)}</strong>
        </div>
      </div>
    </section>

    ${buildWrongReview()}
    <section class="report-section">
      ${scoreCards("📊 模块表现", calculateSummaryGroups())}
    </section>
    ${buildStudyAdvice(result)}
    ${buildAutoDiagnosis(result, level)}

    <div class="stack-actions result-actions">
      <button class="ghost-btn" type="button" id="backTopBtn">返回顶部</button>
      <button class="ghost-btn" type="button" id="reviewBtn">返回查看题目</button>
      <button class="primary-btn" type="button" id="restartBtn">重新抽题</button>
    </div>
  `;

  document.getElementById("backTopBtn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
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
