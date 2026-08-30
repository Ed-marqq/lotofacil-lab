(() => {
  "use strict";

  const N = 25;
  const DRAW_SIZE = 15;
  const DEFAULT_MC = 20000;

  const $ = (id) => document.getElementById(id);

  const EXAMPLE = `Concurso: 3769 | Data: 23/08/2026 | Números: 01 02 03 04 05 09 10 11 15 16 17 21 23 24 25
Concurso: 3768 | Data: 21/08/2026 | Números: 01 03 04 05 06 08 09 11 12 14 16 18 20 23 25
Concurso: 3767 | Data: 19/08/2026 | Números: 02 03 05 06 07 09 10 12 14 15 17 19 21 22 24
Concurso: 3766 | Data: 17/08/2026 | Números: 01 02 03 05 07 08 10 11 13 16 18 20 22 24 25
Concurso: 3765 | Data: 15/08/2026 | Números: 01 04 05 06 08 09 11 12 13 15 17 18 20 21 24
Concurso: 3764 | Data: 13/08/2026 | Números: 02 04 06 07 08 10 11 14 15 16 18 19 21 23 25
Concurso: 3763 | Data: 11/08/2026 | Números: 01 02 05 07 09 10 12 13 15 16 17 19 20 22 24
Concurso: 3762 | Data: 09/08/2026 | Números: 03 04 06 08 10 11 12 14 16 18 19 21 22 23 25
Concurso: 3761 | Data: 07/08/2026 | Números: 01 03 04 05 07 09 11 13 14 15 17 18 20 23 25
Concurso: 3760 | Data: 05/08/2026 | Números: 02 03 06 08 10 11 12 15 16 18 19 21 22 24 25`;

  const CONFIG = {
    candidateCount: () => clampInt($("candidateCount").value, 1000, 200000, 30000),
    monteCarloRuns: () => clampInt($("monteCarloRuns").value, 1000, 200000, DEFAULT_MC),
    weights: () => ({
      freq: numberOr($("wFreq").value, 1.0),
      recent: numberOr($("wRecent").value, 0.8),
      bayes: numberOr($("wBayes").value, 0.8),
      pair: numberOr($("wPair").value, 1.0),
      structure: numberOr($("wStructure").value, 0.9),
      repeat: numberOr($("wRepeat").value, 0.8),
      temporal: numberOr($("wTemporal").value, 0.5),
      regularization: numberOr($("wRegularization").value, 0.7),
      diversity: numberOr($("wDiversity").value, 1.0)
    })
  };

  let latest = null;

  function clampInt(v, min, max, fallback) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function numberOr(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatPct(x, digits = 2) {
    return `${(100 * x).toFixed(digits)}%`;
  }

  function formatNum(x, digits = 3) {
    return Number(x).toFixed(digits);
  }

  function parseDateBR(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!m) return new Date("invalid");
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  function parseHistory(text) {
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const out = [];
    const errors = [];

    const rx = /^Concurso:\s*(\d+)\s*\|\s*Data:\s*(\d{2}\/\d{2}\/\d{4})\s*\|\s*Números:\s*(.+)$/i;

    lines.forEach((line, idx) => {
      const match = rx.exec(line);
      if (!match) {
        errors.push(`Linha ${idx + 1}: formato inválido.`);
        return;
      }
      const contest = Number(match[1]);
      const dateText = match[2];
      const nums = match[3].trim().split(/\s+/).map(Number);

      if (!Number.isInteger(contest) || contest < 1) {
        errors.push(`Linha ${idx + 1}: concurso inválido.`);
        return;
      }
      const d = parseDateBR(dateText);
      if (Number.isNaN(d.getTime())) {
        errors.push(`Linha ${idx + 1}: data inválida.`);
        return;
      }
      if (nums.length !== DRAW_SIZE) {
        errors.push(`Linha ${idx + 1}: esperados 15 números; encontrados ${nums.length}.`);
        return;
      }
      if (nums.some(n => !Number.isInteger(n) || n < 1 || n > N)) {
        errors.push(`Linha ${idx + 1}: existem dezenas fora do intervalo 01–25.`);
        return;
      }
      const unique = new Set(nums);
      if (unique.size !== DRAW_SIZE) {
        errors.push(`Linha ${idx + 1}: existem dezenas repetidas no mesmo concurso.`);
        return;
      }

      out.push({
        contest,
        date: d,
        dateText,
        numbers: [...unique].sort((a, b) => a - b)
      });
    });

    out.sort((a, b) => a.contest - b.contest || a.date - b.date);

    const seen = new Set();
    for (const row of out) {
      if (seen.has(row.contest)) errors.push(`Concurso duplicado: ${row.contest}.`);
      seen.add(row.contest);
    }

    if (out.length < 30) {
      errors.push("Forneça pelo menos 30 concursos para permitir uma análise temporal minimamente útil.");
    }

    return { draws: out, errors };
  }

  function zeros(len) { return Array.from({ length: len }, () => 0); }
  function matrices(size, fill = 0) {
    return Array.from({ length: size }, () => Array(size).fill(fill));
  }

  function logChoose(n, k) {
    if (k < 0 || k > n) return -Infinity;
    k = Math.min(k, n - k);
    let s = 0;
    for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
    return s;
  }

  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    return Math.round(Math.exp(logChoose(n, k)));
  }

  function hypergeomPMF(Npop, Ksuccess, sample, k) {
    if (k < 0 || k > sample || k > Ksuccess || sample - k > Npop - Ksuccess) return 0;
    return Math.exp(
      logChoose(Ksuccess, k) +
      logChoose(Npop - Ksuccess, sample - k) -
      logChoose(Npop, sample)
    );
  }

  // Fisher-Yates / random permutation. Uses crypto.getRandomValues when available.
  function rand() {
    if (window.crypto?.getRandomValues) {
      const u = new Uint32Array(1);
      crypto.getRandomValues(u);
      return u[0] / 4294967296;
    }
    return Math.random();
  }

  function sampleCombination() {
    const arr = Array.from({ length: N }, (_, i) => i + 1);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, DRAW_SIZE).sort((a, b) => a - b);
  }

  function combinationKey(nums) {
    return nums.join(",");
  }

  function analyze(draws, mcRuns) {
    const D = draws.length;
    const freq = zeros(N + 1);
    const recent = zeros(N + 1);
    const pair = matrices(N + 1, 0);
    const triple = new Map();
    const lastSeen = zeros(N + 1);
    const last = draws[D - 1].numbers;
    const lastSet = new Set(last);

    draws.forEach((draw, idx) => {
      const nums = draw.numbers;
      nums.forEach(n => {
        freq[n]++;
        lastSeen[n] = idx;
      });

      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          pair[nums[i]][nums[j]]++;
          pair[nums[j]][nums[i]]++;
        }
      }

      if (idx >= D - 50) numsForTriples(nums, triple);
    });

    const windows = [10, 20, 50, 100, 500].filter(w => D >= w);
    const rolling = {};
    for (const w of windows) {
      const arr = zeros(N + 1);
      for (let i = Math.max(0, D - w); i < D; i++) {
        draws[i].numbers.forEach(n => arr[n]++);
      }
      rolling[w] = arr;
    }

    const expectedPerNum = D * DRAW_SIZE / N;
    const p = DRAW_SIZE / N;
    const sdBin = Math.sqrt(D * p * (1 - p));
    const z = zeros(N + 1);
    for (let n = 1; n <= N; n++) z[n] = (freq[n] - expectedPerNum) / sdBin;

    const chi = freq.slice(1).reduce((acc, observed) => {
      return acc + ((observed - expectedPerNum) ** 2) / expectedPerNum;
    }, 0);

    const bayesMean = zeros(N + 1);
    for (let n = 1; n <= N; n++) bayesMean[n] = (1 + freq[n]) / (2 + D);

    const recentWindow = rolling[50] || rolling[20] || rolling[10];
    for (let n = 1; n <= N; n++) recent[n] = recentWindow ? recentWindow[n] / (recentWindow === rolling[50] ? 50 : (windows[windows.length - 1])) : 0.6;

    const pairExpected = D * (DRAW_SIZE / N) * ((DRAW_SIZE - 1) / (N - 1));
    const lift = matrices(N + 1, 0);
    for (let i = 1; i <= N; i++) {
      for (let j = i + 1; j <= N; j++) {
        const pij = pair[i][j] / D;
        lift[i][j] = pij / (p * p);
        lift[j][i] = lift[i][j];
      }
    }

    const sums = draws.map(d => d.numbers.reduce((a, b) => a + b, 0));
    const oddCounts = draws.map(d => d.numbers.filter(n => n % 2 === 1).length);
    const consecCounts = draws.map(d => countConsecutivePairs(d.numbers));
    const maxGaps = draws.map(d => maxGap(d.numbers));
    const repeatPrev = draws.slice(1).map((d, i) => intersectionSize(d.numbers, draws[i].numbers));
    const structural = {
      sum: empiricalModel(sums),
      odd: empiricalModel(oddCounts),
      consecutive: empiricalModel(consecCounts),
      maxGap: empiricalModel(maxGaps),
      repeatPrev: empiricalModel(repeatPrev.length ? repeatPrev : [9])
    };

    const temporal = zeros(N + 1);
    const autocorr = zeros(N + 1);
    const runs = zeros(N + 1);
    for (let n = 1; n <= N; n++) {
      const seq = draws.map(d => d.numbers.includes(n) ? 1 : 0);
      temporal[n] = autocorrelation(seq, 1);
      autocorr[n] = autocorrelation(seq, 2);
      runs[n] = runsZ(seq);
    }

    const mc = monteCarloDiagnostics(draws, mcRuns);

    const actualFreqMean = freq.slice(1).reduce((a, b) => a + b, 0) / N;
    return {
      D, draws, freq, recent, rolling, expectedPerNum, sdBin, z, chi, bayesMean,
      pair, pairExpected, lift, triple, last, lastSet, lastSeen,
      structural, sums, oddCounts, consecCounts, maxGaps, repeatPrev,
      temporal, autocorr, runs, mc, actualFreqMean
    };
  }

  function numsForTriples(nums, map) {
    for (let a = 0; a < nums.length - 2; a++) {
      for (let b = a + 1; b < nums.length - 1; b++) {
        for (let c = b + 1; c < nums.length; c++) {
          const key = `${nums[a]},${nums[b]},${nums[c]}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    }
  }

  function empiricalModel(values) {
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const total = values.length;
    return { counts, total, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a,b)=>a+b,0)/total,
      prob: (x) => ((counts.get(x) || 0) + 1) / (total + (counts.size + 1)) };
  }

  function intersectionSize(a, b) {
    const set = new Set(b);
    let count = 0;
    for (const n of a) if (set.has(n)) count++;
    return count;
  }

  function countConsecutivePairs(nums) {
    let count = 0;
    for (let i = 1; i < nums.length; i++) if (nums[i] === nums[i-1] + 1) count++;
    return count;
  }

  function maxGap(nums) {
    let max = 0;
    for (let i = 1; i < nums.length; i++) max = Math.max(max, nums[i] - nums[i-1]);
    return max;
  }

  function autocorrelation(seq, lag) {
    if (seq.length <= lag + 1) return 0;
    const mean = seq.reduce((a,b)=>a+b,0)/seq.length;
    let num = 0, den = 0;
    for (let i = 0; i < seq.length; i++) {
      const d = seq[i] - mean;
      den += d*d;
      if (i >= lag) num += d * (seq[i-lag] - mean);
    }
    return den === 0 ? 0 : num / den;
  }

  // Wald approximation for the expected number of runs.
  function runsZ(seq) {
    const n1 = seq.reduce((a,b)=>a+b,0);
    const n0 = seq.length - n1;
    if (n1 === 0 || n0 === 0) return 0;
    let runs = 1;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i-1]) runs++;
    const expected = 1 + (2*n1*n0)/(n1+n0);
    const variance = (2*n1*n0*(2*n1*n0 - n1 - n0)) / (((n1+n0)**2) * (n1+n0-1));
    return variance > 0 ? (runs - expected) / Math.sqrt(variance) : 0;
  }

  function monteCarloDiagnostics(draws, runs) {
    const D = draws.length;
    const actualSums = draws.map(d => d.numbers.reduce((a,b)=>a+b,0));
    const actualRepeat = draws.slice(1).map((d,i)=>intersectionSize(d.numbers, draws[i].numbers));
    let sumLE = 0, repeatLE = 0, chiLike = 0;
    const expectedSum = DRAW_SIZE * (N + 1) / 2;
    const randomFreq = zeros(N + 1);

    for (let r = 0; r < runs; r++) {
      const c = sampleCombination();
      const sum = c.reduce((a,b)=>a+b,0);
      if (sum <= actualSums.reduce((a,b)=>a+b,0)/D) sumLE++;

      if (D > 1) {
        const prior = sampleCombination();
        const current = sampleCombination();
        const overlap = intersectionSize(prior, current);
        const observedMeanRepeat = actualRepeat.length ? actualRepeat.reduce((a,b)=>a+b,0)/actualRepeat.length : 9;
        if (overlap <= observedMeanRepeat) repeatLE++;
      }

      c.forEach(n => randomFreq[n]++);
      chiLike += (sum - expectedSum) ** 2;
    }

    return {
      runs,
      avgRandomSum: expectedSum,
      observedAvgSum: actualSums.reduce((a,b)=>a+b,0)/D,
      empiricalSumTail: sumLE / runs,
      empiricalRepeatTail: repeatLE / Math.max(1,runs),
      randomSumVariance: chiLike / runs,
      randomFreq
    };
  }

  function scoreCandidate(nums, A, weights) {
    const D = A.D;
    const freqComponent = nums.reduce((s, n) => s + A.z[n], 0) / Math.sqrt(D);
    const recentWindow = A.rolling[Math.min(50, D)] || A.rolling[Math.max(...Object.keys(A.rolling).map(Number))];
    const recentProb = nums.reduce((s,n) => s + (recentWindow[n] / Math.min(50,D)), 0) / DRAW_SIZE;
    const recentComponent = (recentProb - 0.6) / 0.15;

    const bayesComponent = nums.reduce((s,n) => s + (A.bayesMean[n] - 0.6) / 0.1, 0) / DRAW_SIZE;

    let pairSum = 0, pairN = 0;
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const l = A.lift[nums[i]][nums[j]];
        pairSum += Math.log(Math.max(0.25, Math.min(4, l)));
        pairN++;
      }
    }
    const pairComponent = pairN ? pairSum / pairN : 0;

    const sum = nums.reduce((a,b)=>a+b,0);
    const odd = nums.filter(n => n % 2 === 1).length;
    const cons = countConsecutivePairs(nums);
    const mg = maxGap(nums);

    const structureComponent =
      logEmpProb(A.structural.sum, sum) +
      logEmpProb(A.structural.odd, odd) +
      logEmpProb(A.structural.consecutive, cons) +
      logEmpProb(A.structural.maxGap, mg);

    const repeat = intersectionSize(nums, A.last);
    const repeatComponent = logEmpProb(A.structural.repeatPrev, repeat);

    const temporalComponent = nums.reduce((s,n)=>s + clamp(A.temporal[n], -0.8, 0.8), 0) / DRAW_SIZE;

    // Penalizes extremely concentrated dependence on historical "hot" values.
    const dispersion = standardDeviation(nums);
    const regularization = -Math.abs(dispersion - 7.2) / 7.2;

    return (
      weights.freq * freqComponent +
      weights.recent * recentComponent +
      weights.bayes * bayesComponent +
      weights.pair * pairComponent +
      weights.structure * structureComponent +
      weights.repeat * repeatComponent +
      weights.temporal * temporalComponent +
      weights.regularization * regularization
    );
  }

  function logEmpProb(model, x) {
    return Math.log(model.prob(x));
  }

  function standardDeviation(arr) {
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    return Math.sqrt(arr.reduce((s,x)=>s+(x-mean)**2,0)/arr.length);
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function generateGames(A, candidateCount, weights) {
    const seen = new Set();
    const candidates = [];

    for (let i = 0; i < candidateCount; i++) {
      const nums = sampleCombination();
      const key = combinationKey(nums);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ nums, baseScore: scoreCandidate(nums, A, weights) });
    }

    candidates.sort((a,b) => b.baseScore - a.baseScore);

    const chosen = [];
    const pool = candidates.slice(0, Math.min(candidates.length, 5000));
    const lambda = Math.max(0, weights.diversity);

    while (chosen.length < 10 && pool.length) {
      let bestIndex = 0;
      let bestValue = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        let maxOverlap = 0;
        for (const g of chosen) maxOverlap = Math.max(maxOverlap, intersectionSize(c.nums, g.nums));
        const diversityPenalty = chosen.length ? (maxOverlap / DRAW_SIZE) : 0;
        const adjusted = c.baseScore - lambda * diversityPenalty;
        if (adjusted > bestValue) {
          bestValue = adjusted;
          bestIndex = i;
        }
      }
      const picked = pool.splice(bestIndex, 1)[0];
      picked.adjustedScore = bestValue;
      chosen.push(picked);
    }
    return chosen;
  }

  function expectedHitPMF(k) {
    return hypergeomPMF(25, 15, 15, k);
  }

  function renderSummary(A) {
    $("summarySection").classList.remove("hidden");

    const chiApproxP = chiSquareUpperTailApprox(A.chi, 24);
    const metrics = [
      ["Concursos", A.D],
      ["Combinações possíveis", choose(25,15).toLocaleString("pt-BR")],
      ["Expectativa por dezena", formatNum(A.expectedPerNum, 2)],
      ["Qui-quadrado", formatNum(A.chi, 2)],
      ["p-valor χ² (aprox.)", formatPct(chiApproxP, 2)],
      ["Média da soma", formatNum(A.sums.reduce((a,b)=>a+b,0)/A.sums.length, 2)],
      ["Média ímpares", formatNum(A.oddCounts.reduce((a,b)=>a+b,0)/A.oddCounts.length, 2)],
      ["Média repetidos", formatNum(A.repeatPrev.length ? A.repeatPrev.reduce((a,b)=>a+b,0)/A.repeatPrev.length : 9, 2)]
    ];
    $("summaryCards").innerHTML = metrics.map(([label,value]) =>
      `<div class="metric"><span class="label">${label}</span><span class="value">${value}</span></div>`
    ).join("");

    const rows = Array.from({length:N}, (_, i) => {
      const n = i + 1;
      const lastAgo = (A.D - 1) - A.lastSeen[n];
      const bayes = A.bayesMean[n];
      const recent50 = (A.rolling[50]?.[n] || 0) / Math.min(50,A.D);
      return `<tr>
        <td>${String(n).padStart(2,"0")}</td>
        <td>${A.freq[n]}</td>
        <td>${formatNum(A.z[n],2)}</td>
        <td>${formatPct(bayes,2)}</td>
        <td>${formatPct(recent50,2)}</td>
        <td>${lastAgo}</td>
        <td>${formatNum(A.temporal[n],2)}</td>
        <td>${formatNum(A.runs[n],2)}</td>
      </tr>`;
    }).join("");

    $("numberTable").innerHTML = `<div style="overflow:auto"><table>
      <thead><tr><th>Dezena</th><th>Freq.</th><th>Z</th><th>Bayes</th><th>50 concursos</th><th>Atraso</th><th>ACF1</th><th>Runs Z</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;

    const s = A.structural;
    $("structureTable").innerHTML = `<table>
      <tbody>
        <tr><td>Soma média</td><td>${formatNum(s.sum.mean,2)}</td></tr>
        <tr><td>Ímpares médios</td><td>${formatNum(s.odd.mean,2)}</td></tr>
        <tr><td>Consecutivos médios</td><td>${formatNum(s.consecutive.mean,2)}</td></tr>
        <tr><td>Maior gap médio</td><td>${formatNum(s.maxGap.mean,2)}</td></tr>
        <tr><td>Repetição média</td><td>${formatNum(s.repeatPrev.mean,2)}</td></tr>
        <tr><td>MC: soma média aleatória</td><td>${formatNum(A.mc.avgRandomSum,2)}</td></tr>
        <tr><td>MC: repetição ≤ média histórica</td><td>${formatPct(A.mc.empiricalRepeatTail,2)}</td></tr>
      </tbody>
    </table>`;
  }

  function renderGames(games, A) {
    $("resultsSection").classList.remove("hidden");
    $("games").innerHTML = games.map((g, idx) => {
      const nums = g.nums;
      const sum = nums.reduce((a,b)=>a+b,0);
      const odd = nums.filter(n=>n%2===1).length;
      const rep = intersectionSize(nums,A.last);
      const cons = countConsecutivePairs(nums);
      return `<div class="game">
        <div class="game-top">
          <span class="game-title">Jogo ${String(idx+1).padStart(2,"0")}</span>
          <span class="score">Score ${formatNum(g.adjustedScore,3)}</span>
        </div>
        <div class="balls">${nums.map(n=>`<span class="ball">${String(n).padStart(2,"0")}</span>`).join("")}</div>
        <div class="tags">
          <span class="tag">Soma ${sum}</span>
          <span class="tag">${odd} ímpares / ${15-odd} pares</span>
          <span class="tag">${cons} consecutivos</span>
          <span class="tag">${rep} repetidos do último</span>
        </div>
      </div>`;
    }).join("");
  }

  function chiSquareUpperTailApprox(x, df) {
    // Wilson-Hilferty approximation for chi-square upper tail.
    if (x <= 0) return 1;
    const z = (Math.pow(x/df, 1/3) - (1 - 2/(9*df))) / Math.sqrt(2/(9*df));
    return normalUpperTail(z);
  }

  function normalUpperTail(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z*z/2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z < 0) p = 1 - p;
    return clamp(p, 0, 1);
  }

  function renderBacktestResult(text) {
    $("backtestSection").classList.remove("hidden");
    $("backtestResult").innerHTML = text;
  }

  async function runBacktest(draws) {
    if (draws.length < 80) {
      renderBacktestResult(`<span class="error">Use pelo menos 80 concursos para um backtest mais informativo.</span>`);
      return;
    }

    renderBacktestResult("Executando backtest walk-forward…");
    await new Promise(r => setTimeout(r, 25));

    const steps = [];
    const start = Math.min(50, draws.length - 10);
    const end = draws.length - 1;
    const candidateCount = Math.min(CONFIG.candidateCount(), 7000);
    let modelTotal = 0;
    let randomTotal = 0;
    let model15 = 0, random15 = 0;
    let model14 = 0, random14 = 0;
    let model13 = 0, random13 = 0;
    let totalExpected = 0;

    for (let t = start; t < end; t++) {
      const hist = draws.slice(0, t);
      const A = analyze(hist, Math.min(3000, Math.max(1000, Math.floor(CONFIG.monteCarloRuns()/6))));
      const games = generateGames(A, candidateCount, CONFIG.weights());
      const actual = draws[t].numbers;

      let bestModel = 0;
      for (const g of games) bestModel = Math.max(bestModel, intersectionSize(g.nums, actual));

      let bestRandom = 0;
      for (let j = 0; j < 10; j++) bestRandom = Math.max(bestRandom, intersectionSize(sampleCombination(), actual));

      modelTotal += bestModel;
      randomTotal += bestRandom;
      if (bestModel >= 15) model15++;
      if (bestModel >= 14) model14++;
      if (bestModel >= 13) model13++;
      if (bestRandom >= 15) random15++;
      if (bestRandom >= 14) random14++;
      if (bestRandom >= 13) random13++;
      totalExpected++;

      if (t % 10 === 0) {
        renderBacktestResult(`Executando: ${t - start + 1}/${end - start} pontos temporais…`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const n = totalExpected;
    renderBacktestResult(`
      <div class="grid-2">
        <div>
          <h3>Modelo</h3>
          <table>
            <tbody>
              <tr><td>Média de melhores acertos</td><td>${formatNum(modelTotal/n,3)}</td></tr>
              <tr><td>≥ 15 acertos</td><td>${model15}/${n}</td></tr>
              <tr><td>≥ 14 acertos</td><td>${model14}/${n}</td></tr>
              <tr><td>≥ 13 acertos</td><td>${model13}/${n}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>Baseline aleatória — 10 jogos</h3>
          <table>
            <tbody>
              <tr><td>Média de melhores acertos</td><td>${formatNum(randomTotal/n,3)}</td></tr>
              <tr><td>≥ 15 acertos</td><td>${random15}/${n}</td></tr>
              <tr><td>≥ 14 acertos</td><td>${random14}/${n}</td></tr>
              <tr><td>≥ 13 acertos</td><td>${random13}/${n}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="muted">Esse teste é deliberadamente fora da amostra: o concurso avaliado não participa do treinamento daquele ponto temporal.</p>
    `);
  }

  function copyGames(games) {
    const text = games.map((g,i)=>`Jogo ${String(i+1).padStart(2,"0")}: ${g.nums.map(n=>String(n).padStart(2,"0")).join(" ")}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      $("copyBtn").textContent = "Copiado!";
      setTimeout(() => $("copyBtn").textContent = "Copiar jogos", 1400);
    });
  }

  $("exampleBtn").addEventListener("click", () => $("historyInput").value = EXAMPLE);
  $("clearBtn").addEventListener("click", () => {
    $("historyInput").value = "";
    ["summarySection","resultsSection","backtestSection"].forEach(id => $(id).classList.add("hidden"));
    $("status").textContent = "";
    latest = null;
  });

  $("generateBtn").addEventListener("click", async () => {
    const status = $("status");
    status.className = "status";
    status.textContent = "Validando histórico…";
    const parsed = parseHistory($("historyInput").value);

    if (parsed.errors.length) {
      status.className = "status error";
      status.innerHTML = parsed.errors.slice(0,8).map(e=>`• ${e}`).join("<br>") +
        (parsed.errors.length > 8 ? `<br>… e mais ${parsed.errors.length-8} erro(s).` : "");
      return;
    }

    status.textContent = `Analisando ${parsed.draws.length} concursos…`;
    await new Promise(r => setTimeout(r, 20));

    const A = analyze(parsed.draws, CONFIG.monteCarloRuns());
    status.textContent = "Calculando e ordenando combinações candidatas…";
    await new Promise(r => setTimeout(r, 20));

    const games = generateGames(A, CONFIG.candidateCount(), CONFIG.weights());
    latest = { A, games };

    renderSummary(A);
    renderGames(games, A);

    status.className = "status success";
    status.textContent = `Concluído. ${games.length} combinações geradas sem armazenar o histórico.`;
  });

  $("copyBtn").addEventListener("click", () => {
    if (latest?.games) copyGames(latest.games);
  });

  $("backtestBtn").addEventListener("click", async () => {
    const parsed = parseHistory($("historyInput").value);
    if (parsed.errors.length) {
      renderBacktestResult(`<span class="error">Corrija o histórico antes de executar o backtest.</span>`);
      return;
    }
    await runBacktest(parsed.draws);
  });

  // Expose small self-check in development console.
  window.LotofacilLab = {
    choose,
    hypergeomPMF,
    parseHistory,
    expectedHitPMF
  };
})();
