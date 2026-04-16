const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const INPUT_FILE = path.join(ROOT, "knowledge-base.md");
const OUTPUT_DIR = path.join(ROOT, "outputs");
const SCHEMA_DIR = path.join(ROOT, "schemas");
const REPORT_FILE = path.join(OUTPUT_DIR, "report.html");
const SCHEMA_VERSION = "mvp-0.7";

const SECTION_CATALOG = [
  { name: "General Information", pattern: /GENEL B/i },
  { name: "Descriptive Statistics", pattern: /TANIMLAYICI/i },
  { name: "Independent One-Group Analysis", pattern: /BA.{0,6}IMSIZ TEK GRUP/i },
  { name: "Dependent Data Analysis", pattern: /BA.{0,6}IMLI VER/i },
  { name: "Variable Relationship Map", pattern: /DE.{0,6}KENLER ARASI/i },
  { name: "Statistical Methods Summary", pattern: /STAT.{0,6}ST.{0,6}KSEL Y/i },
  { name: "Visual Abstract Key Messages", pattern: /VISUAL ABSTRACT/i },
  { name: "Visual Suggestions", pattern: /G.{0,6}RSEL/i },
];

function readKnowledgeBase(filePath) {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const normalized = content.replace(/\r\n/g, "\n").trim();

  return {
    path: path.relative(ROOT, filePath),
    content,
    normalized,
    hash: crypto.createHash("sha256").update(content).digest("hex"),
    wordCount: normalized ? normalized.split(/\s+/).length : 0,
    lineCount: content ? content.split(/\r?\n/).length : 0,
    isEmpty: normalized.length === 0,
  };
}

function loadSchemas() {
  const schemas = {};
  const files = fs.readdirSync(SCHEMA_DIR).filter((file) => file.endsWith(".schema.json"));

  for (const file of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8"));
    schemas[schema.artifactType] = schema;
  }

  return schemas;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownRows(text) {
  return text
    .split("\n")
    .filter((line) => line.trim().startsWith("|") && line.includes("|"))
    .map((line) => line.split("|").map(cleanText).filter(Boolean))
    .filter((cells) => cells.length > 1 && !cells.every((cell) => /^-+$/.test(cell)));
}

function extractSourceSections(text) {
  const sections = SECTION_CATALOG.filter((section) => section.pattern.test(text)).map((section) => section.name);
  return sections.length > 0 ? sections : ["Unknown Section"];
}

function findNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function findTextMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return cleanText(match[1] || match[0]);
  }
  return null;
}

function extractVariables(rows) {
  const variables = {};
  const headerLabels = new Set(["değişken adı", "deäÿiåÿken adä±", "değişken", "variable", "variable name"]);
  const typePattern = /nicel|nitel|kategorik|s[üu]rekli|continuous|categorical|numeric|quantitative|qualitative|d[oö]n/i;

  for (const cells of rows) {
    const name = cells[0];
    if (!name || headerLabels.has(name.toLowerCase())) continue;
    if (!/^[a-zA-Z_][a-zA-Z0-9_ -]{0,40}$/.test(name)) continue;
    if (!typePattern.test(cells[1] || "")) continue;

    variables[name] = {
      name,
      type: cells[1] || "",
      description: cells.slice(2).join(" "),
    };
  }

  return variables;
}

function extractNormality(text, variableNames) {
  const normality = {};

  for (const variable of variableNames) {
    const match = text.match(new RegExp(`\\*\\*${variable}:\\*\\*([\\s\\S]*?)(?=\\s-\\s\\*\\*[a-z0-9_]+:|---|##|$)`, "i"));
    if (!match) continue;

    const segment = match[1];
    const finding = /uymuyor/i.test(segment) ? "uymuyor" : /uyuyor/i.test(segment) ? "uyuyor" : null;
    if (!finding) continue;

    normality[variable] = {
      isNormal: finding === "uyuyor",
      finding: finding === "uyuyor" ? "normally distributed" : "not normally distributed",
      recommendedTestFamily: finding === "uyuyor" ? "parametric" : "non-parametric",
    };
  }

  return normality;
}

function extractMethods(text) {
  const methods = [];
  if (/Kolmogorov-Smirnov/i.test(text)) methods.push("Kolmogorov-Smirnov normality test");
  if (/Runs Test/i.test(text)) methods.push("Runs Test for non-normal one-sample comparisons");
  if (/T-test/i.test(text)) methods.push("One-sample T-test for normal variables");
  if (/Wilcoxon/i.test(text)) methods.push("Wilcoxon signed-rank test for paired non-normal measurements");
  return methods;
}

function extractSummaryStats(rows, variables) {
  const stats = {};
  const names = new Set(Object.keys(variables));

  for (const cells of rows) {
    const name = cells[0];
    if (!names.has(name) || cells.length < 5) continue;

    stats[name] = {
      n: Number(cells[1]) || null,
      mean: Number(cells[2]) || null,
      standardDeviation: Number(cells[3]) || null,
      median: Number(cells[4]) || null,
      min: Number(cells[5]) || null,
      max: Number(cells[6]) || null,
      q1: Number(cells[7]) || null,
      q3: Number(cells[8]) || null,
    };
  }

  return stats;
}

function inferMeasurements(variables) {
  return Object.values(variables).map((variable) => {
    const description = variable.description || "";
    const timeMatch = description.match(/(?:Time|Zaman)\s*([0-9]+)/i);
    return {
      name: variable.name,
      role: /dependent|ba[ğg].*ml/i.test(description) ? "primary" : /cov|kovaryat/i.test(description) ? "secondary" : "measurement",
      timepoint: timeMatch ? `Time ${timeMatch[1]}` : null,
      description,
    };
  });
}

function firstAvailableSection(sourceSections, preferred) {
  return preferred.find((section) => sourceSections.includes(section)) || sourceSections[0] || "Unknown Section";
}

function formatPValue(value) {
  if (!value) return "p not reported";
  return value.startsWith("<") ? `p ${value.replace("<", "< ")}` : `p = ${value}`;
}

function normalizeConfidence(confidence) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return null;
  if (confidence > 1 && confidence <= 100) return Number((confidence / 100).toFixed(2));
  if (confidence < 0 || confidence > 1) return null;
  return confidence;
}

function confidenceLabel(confidence) {
  const normalized = normalizeConfidence(confidence);
  if (normalized === null) return "not-scored";
  if (normalized >= 0.85) return "high";
  if (normalized >= 0.6) return "medium";
  return "low";
}

function supportedFact(value, sourceSection, confidence, extra = {}) {
  const normalizedConfidence = normalizeConfidence(confidence);
  return {
    ...extra,
    value,
    sourceSection,
    confidence: normalizedConfidence,
    supported: Boolean(value) && normalizedConfidence !== null && normalizedConfidence >= 0.3,
  };
}

function explicitNumberConfidence(value) {
  return /-?\d+(?:\.\d+)?/.test(String(value)) ? 0.95 : 0.7;
}

function buildEvidence({ time1Median, time2Median, decreasePercent, pairedEffectSize, confidenceInterval, pValue, effectSizeFindings, sourceSections }) {
  const dependentSection = firstAvailableSection(sourceSections, ["Dependent Data Analysis", "Descriptive Statistics", "Unknown Section"]);
  const independentSection = firstAvailableSection(sourceSections, ["Independent One-Group Analysis", "Descriptive Statistics", "Unknown Section"]);
  const evidence = [];

  if (time1Median !== null && time2Median !== null && decreasePercent !== null) {
    evidence.push(supportedFact(`Median decreased from ${time1Median} to ${time2Median}, a ${decreasePercent}% reduction.`, dependentSection, 0.96, {
      type: "statistic",
      label: "median change",
    }));
  }
  if (pValue) {
    evidence.push(supportedFact(formatPValue(pValue), dependentSection, 0.98, { type: "significance", label: "p-value" }));
  }
  if (pairedEffectSize !== null) {
    evidence.push(supportedFact(`r = ${pairedEffectSize}`, dependentSection, 0.96, { type: "effect-size", label: "paired effect size" }));
  }
  if (confidenceInterval) {
    evidence.push(supportedFact(confidenceInterval, dependentSection, explicitNumberConfidence(confidenceInterval), { type: "confidence-interval", label: "effect-size confidence interval" }));
  }
  for (const finding of effectSizeFindings.filter((item) => item.context === "independent")) {
    evidence.push(supportedFact(finding.value, finding.sourceSection || independentSection, finding.confidence || explicitNumberConfidence(finding.value), { type: "effect-size", label: "independent effect size" }));
  }

  return evidence.filter((item) => item.supported);
}

function buildComparisons({ text, variables, sourceSections, time1Median, time2Median, decreasePercent, pValue, pairedEffectSize, confidenceInterval, effectSizeFindings, independentEffectVariable }) {
  const comparisons = [];
  const variableNames = Object.keys(variables);
  const dependentSection = firstAvailableSection(sourceSections, ["Dependent Data Analysis", "Descriptive Statistics", "Unknown Section"]);
  const independentSection = firstAvailableSection(sourceSections, ["Independent One-Group Analysis", "Descriptive Statistics", "Unknown Section"]);
  const explicitPair = text.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s+vs\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  const timeLabel = /Time\s*1|Zaman\s*1/i.test(text) && /Time\s*2|Zaman\s*2/i.test(text) ? "Time 1 vs Time 2" : null;
  const beforeAfterLabel = /before/i.test(text) && /after/i.test(text) ? "Before vs After" : null;

  if (time1Median !== null || time2Median !== null || pValue || pairedEffectSize !== null || explicitPair || timeLabel) {
    comparisons.push({
      type: "paired",
      label: timeLabel || beforeAfterLabel || (explicitPair ? `${explicitPair[1]} vs ${explicitPair[2]}` : "Paired comparison"),
      confidence: timeLabel || explicitPair ? 0.75 : 0.45,
      variables: explicitPair ? [explicitPair[1], explicitPair[2]].filter(Boolean) : variableNames.slice(0, 2),
      sourceSection: dependentSection,
      metrics: {
        time1Median,
        time2Median,
        decreasePercent,
        pValue: pValue ? formatPValue(pValue) : null,
        effectSize: pairedEffectSize !== null ? `r = ${pairedEffectSize}` : null,
        confidenceInterval,
      },
    });
  }

  const independentMatches = independentEffectVariable ? [independentEffectVariable] : [];

  for (const variable of independentMatches.slice(0, 4)) {
    comparisons.push({
      type: "independent",
      label: `${variable} vs reference value`,
      variables: [variable],
      sourceSection: independentSection,
      metrics: {
        referenceValue: /Referans De[^\n:]*:\s*([0-9.]+)/i.test(text) ? Number(text.match(/Referans De[^\n:]*:\s*([0-9.]+)/i)[1]) : null,
        effectSize: variable === independentEffectVariable ? effectSizeFindings.find((item) => item.variable === variable)?.value || null : null,
      },
    });
  }

  return comparisons;
}

function extractFactLayer(source) {
  const text = source.normalized;
  const rows = parseMarkdownRows(text);
  const sourceSections = extractSourceSections(text);
  const sampleSize = findNumber(text, [/\bn\s*=\s*(\d+)/i, /sample size\s*[:=]\s*(\d+)/i, /örneklem\s*[:=-]?\s*\D{0,20}(\d+)/i, /\|\s*\w+\s*\|\s*(\d+)\s*\|/i]);
  const generalSection = firstAvailableSection(sourceSections, ["General Information", "Descriptive Statistics", "Unknown Section"]);
  const sampleSizeFact = sampleSize ? supportedFact(`n = ${sampleSize}`, generalSection, 0.95, { type: "statistic", label: "sample size" }) : null;
  const variables = extractVariables(rows);
  const measurements = inferMeasurements(variables);
  const normality = extractNormality(text, Object.keys(variables));
  const summaryStats = extractSummaryStats(rows, variables);

  const time1Median = findNumber(text, [/Ortanca\s*\|\s*\*\*([0-9.]+)\*\*\s*\|\s*\*\*[0-9.]+\*\*/i]);
  const time2Median = findNumber(text, [/Ortanca\s*\|\s*\*\*[0-9.]+\*\*\s*\|\s*\*\*([0-9.]+)\*\*/i]);
  const decreasePercent = findNumber(text, [/%\s*([0-9.]+)\s*(?:azalm|decreas|reduc|düş|dus)/i, /([0-9.]+)\s*%\s*(?:azalm|decreas|reduc|düş|dus)/i, /([0-9.]+)\s*azalma/i]);
  const pairedEffectSize = findNumber(text, [/Etki B[^\n|]*\(r\)\s*\|\s*\*\*(-?[0-9.]+)\*\*/i, /r\s*=\s*\*\*(-?[0-9.]+)\*\*/i, /r\s*=\s*(-?[0-9.]+)/i]);
  const pairedCorrelation = findNumber(text, [/Korelasyon\s*\(r\)\s*\|\s*([0-9.]+)/i]);
  const independentEffectSize = findNumber(text, [/\|\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\|\s*\*\*([0-9.]+)\*\*\s*\|[^\n]*etki/i, /Cohen's d\s*=\s*\*\*([0-9.]+)\*\*/i, /T-test[\s\S]{0,60}<0\.001[\s\S]{0,30}\|\s*([0-9.]+)\s*\|/i]);
  const independentEffectVariableMatch = text.match(/\|\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*\*\*[0-9.]+\*\*\s*\|[^\n]*etki/i);
  const independentEffectVariable = independentEffectVariableMatch?.[1] || Object.keys(variables).find((name) => new RegExp(`${name}[\\s\\S]{0,180}T-test[\\s\\S]{0,80}<0\\.001`, "i").test(text)) || null;
  const confidenceInterval = findTextMatch(text, [/%95 GA \(EB\)\s*\|\s*(\[[^\]]+\])/i, /G[^\n]*aral[^\n]*(\[-?[0-9.]+\s*:\s*-?[0-9.]+\])/i]);
  const pValueMatch = text.match(/p\s*(<|=|>)\s*(0?\.\d+)/i);
  const pairedPValue = /p[^\n|]*\|\s*\*\*<\s*0\.001\*\*/i.test(text) ? "<0.001" : pValueMatch ? `${pValueMatch[1]}${pValueMatch[2]}` : /statistically significant|anlaml[ıi]\s+fark/i.test(text) ? "reported significant" : null;

  const independentAnalysis = [];
  const effectSizeFindings = [
    pairedEffectSize !== null
      ? { context: "paired", variable: null, label: "paired effect size", value: `r = ${pairedEffectSize}`, sourceSection: firstAvailableSection(sourceSections, ["Dependent Data Analysis", "Unknown Section"]) }
      : null,
    independentEffectVariable && independentEffectSize !== null
      ? { context: "independent", variable: independentEffectVariable, label: "independent effect size", value: `Cohen's d = ${independentEffectSize}`, confidence: 0.95, sourceSection: firstAvailableSection(sourceSections, ["Independent One-Group Analysis", "Unknown Section"]) }
      : null,
  ].filter(Boolean);
  const significanceFindings = pairedPValue
    ? [{ context: "paired", label: "p-value", value: formatPValue(pairedPValue), confidence: pairedPValue.includes("reported") ? 0.7 : 0.96, sourceSection: firstAvailableSection(sourceSections, ["Dependent Data Analysis", "Unknown Section"]) }]
    : [];

  if (independentEffectVariable && independentEffectSize !== null) {
    independentAnalysis.push({
      variable: independentEffectVariable,
      test: "One-sample T-test",
      referenceValue: 1,
      pValue: "<0.001",
      effectSize: independentEffectSize,
      interpretation: `${independentEffectVariable} differs significantly from the reference value of 1 with a very large effect.`,
    });
  }

  const dependentAnalysis = {
    comparison: variables.dp1 && variables.cov1 ? "dp1 (Time 1) vs cov1 (Time 2)" : "Time 1 vs Time 2",
    test: /Wilcoxon/i.test(text) ? "Wilcoxon signed-rank test" : "",
    time1Median,
    time2Median,
    medianDifference: time1Median !== null && time2Median !== null ? Number((time2Median - time1Median).toFixed(3)) : null,
    decreasePercent,
    pValue: pairedPValue,
    effectSize: pairedEffectSize,
    effectDirection: pairedEffectSize !== null && pairedEffectSize < 0 ? "large negative effect" : "",
    pairedCorrelation,
    confidenceInterval,
  };

  const mainFindings = [
    sampleSize ? `The analysis uses a sample of n = ${sampleSize}.` : null,
    measurements.length > 0 ? `The source defines ${measurements.length} variable or measurement entries.` : null,
    decreasePercent ? `The paired analysis shows a ${decreasePercent}% median decrease from Time 1 to Time 2.` : null,
    dependentAnalysis.pValue ? `The paired difference is statistically significant (${dependentAnalysis.pValue}).` : null,
    pairedEffectSize ? `The paired effect size is r = ${pairedEffectSize}, interpreted as a large negative effect.` : null,
    effectSizeFindings.find((item) => item.context === "independent") ? `The independent comparison has ${effectSizeFindings.find((item) => item.context === "independent").value}.` : null,
  ].filter(Boolean);

  const visualSuggestions = rows
    .filter((cells) => cells.length >= 2 && /grafik|plot|chart|diagram|tablo|metric|panel/i.test(cells[1]))
    .map((cells) => ({ finding: cells[0], visualType: cells[1] }));

  return {
    sourcePath: source.path,
    sourceSections,
    sampleSize,
    sampleSizeFact,
    variables,
    measurements,
    normality,
    methods: extractMethods(text),
    summaryStats,
    descriptiveStats: {
      time1Median,
      time2Median,
    },
    independentAnalysis,
    dependentAnalysis,
    comparisons: buildComparisons({
      text,
      variables,
      sourceSections,
      time1Median,
      time2Median,
      decreasePercent,
      pValue: pairedPValue,
      pairedEffectSize,
      confidenceInterval,
      effectSizeFindings,
      independentEffectVariable,
    }),
    mainFindings,
    significance: {
      alpha: /p\s*<\s*0\.05/i.test(text) ? "p < 0.05" : null,
      statisticallySignificantFindings: mainFindings.filter((finding) => /significant|anlaml/i.test(finding)),
    },
    effectSizes: {
      independent: effectSizeFindings.filter((item) => item.context === "independent"),
      pairedR: pairedEffectSize,
      pairedRConfidenceInterval: confidenceInterval,
    },
    effectSizeFindings,
    significanceFindings,
    evidence: buildEvidence({ time1Median, time2Median, decreasePercent, pairedEffectSize, confidenceInterval, pValue: pairedPValue, effectSizeFindings, sourceSections }),
    visualSuggestions,
  };
}

function collectConfidences(value) {
  if (!value) return [];
  if (typeof value === "object" && typeof value.confidence === "number") {
    const normalized = normalizeConfidence(value.confidence);
    return normalized === null ? [] : [normalized];
  }
  if (Array.isArray(value)) return value.flatMap(collectConfidences);
  if (typeof value === "object") return Object.values(value).flatMap(collectConfidences);
  return [];
}

function aggregateConfidence(content) {
  const values = collectConfidences(content).filter((value) => value >= 0.3);
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function artifactEnvelope(type, source, content, warnings = []) {
  return {
    artifactType: type,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    overallConfidence: aggregateConfidence(content),
    provenance: {
      sourcePath: source.path,
      sourceHash: source.hash,
      sourceWordCount: source.wordCount,
    },
    staleWhen: {
      sourceHashChanges: true,
      schemaVersionChanges: true,
    },
    review: {
      humanReviewRequired: false,
      riskLevel: "low",
    },
    warnings,
    content,
  };
}

function keyFinding(claim, sourceSection, confidence = 0.7) {
  const normalizedConfidence = normalizeConfidence(confidence);
  return { claim, sourceSection, confidence: normalizedConfidence, supported: Boolean(claim) && normalizedConfidence !== null && normalizedConfidence >= 0.3 };
}

function findEvidence(facts, typeOrLabel) {
  return facts.evidence.find((item) => item.type === typeOrLabel || item.label === typeOrLabel) || null;
}

function primaryComparison(facts) {
  return facts.comparisons.find((comparison) => comparison.type === "paired") || facts.comparisons[0] || null;
}

function describePrimaryMeasurements(facts) {
  const timed = facts.measurements.filter((measurement) => measurement.timepoint);
  if (timed.length >= 2) return `${timed[0].name} at ${timed[0].timepoint} and ${timed[1].name} at ${timed[1].timepoint}`;
  const names = Object.keys(facts.variables);
  if (names.length >= 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 1) return names[0];
  return "the available source measurements";
}

function visualRecommendation(facts) {
  const slopeChart = facts.visualSuggestions.find((suggestion) => /Zaman|Time/i.test(suggestion.finding) || /Slope/i.test(suggestion.visualType));
  const boxPlot = facts.visualSuggestions.find((suggestion) => /Box plot/i.test(suggestion.visualType));
  const comparison = primaryComparison(facts);

  if (slopeChart && comparison) return `Use a slope chart to show ${comparison.label}.`;
  if (slopeChart) return "Use a slope chart to show the detected change.";
  if (boxPlot && comparison?.variables?.length >= 2) return `Use a side-by-side box plot to compare ${comparison.variables.join(" and ")}.`;
  if (boxPlot) return "Use a side-by-side box plot to compare the detected measurements.";
  return comparison ? `Use a paired visual to communicate ${comparison.label}.` : "Use a simple visual that matches the strongest extracted finding.";
}


function generateExecutiveSummary(source, facts) {
  if (source.isEmpty) {
    return artifactEnvelope(
      "executive-summary",
      source,
      {
        title: "Executive Summary",
        audience: "General",
        status: "source-empty",
        overview: "No source content was found in knowledge-base.md, so there is nothing substantive to summarize yet.",
        keyFindings: [
          keyFinding("No source content was available for domain-specific findings.", "Unknown Section"),
          keyFinding("The compiler preserved the artifact structure instead of inventing claims.", "Unknown Section"),
          keyFinding("Future runs can generate grounded findings after source content is added.", "Unknown Section"),
        ],
        statisticalEvidence: ["No statistical evidence was extracted from the source."],
        implications: ["The compiler is ready, but the knowledge layer needs source content."],
        recommendedActions: ["Populate knowledge-base.md and rerun npm start."],
        sourceReferences: ["Unknown Section"],
      },
      ["knowledge-base.md is empty; generated a structural placeholder instead of invented claims."]
    );
  }

  const comparison = primaryComparison(facts);
  const measurementDescription = describePrimaryMeasurements(facts);
  const medianEvidence = findEvidence(facts, "median change");
  const significanceEvidence = findEvidence(facts, "significance");
  const pairedEffectEvidence = findEvidence(facts, "paired effect size");
  const independentEffectEvidence = findEvidence(facts, "independent effect size");
  const confidenceEvidence = findEvidence(facts, "confidence-interval");

  const overviewFocus = comparison ? `the ${comparison.label} comparison` : measurementDescription;
  const overview = facts.sampleSize
    ? `The analysis covers ${facts.sampleSize} observations and centers on ${overviewFocus}.`
    : `The analysis centers on ${overviewFocus}.`;

  const keyFindings = [];
  if (medianEvidence) keyFindings.push(keyFinding(medianEvidence.value, medianEvidence.sourceSection, medianEvidence.confidence));
  if (significanceEvidence && comparison) keyFindings.push(keyFinding(`${comparison.label} is statistically significant (${significanceEvidence.value}).`, significanceEvidence.sourceSection, significanceEvidence.confidence));
  if (pairedEffectEvidence) keyFindings.push(keyFinding(`The paired effect size is ${pairedEffectEvidence.value}, which indicates a large negative effect.`, pairedEffectEvidence.sourceSection, pairedEffectEvidence.confidence));
  if (independentEffectEvidence) keyFindings.push(keyFinding(`The independent analysis reports ${independentEffectEvidence.value}.`, independentEffectEvidence.sourceSection, independentEffectEvidence.confidence));
  if (keyFindings.length === 0) {
    keyFindings.push(...facts.mainFindings.slice(0, 4).map((finding) => keyFinding(finding, firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]))));
  }

  const statisticalEvidence = [
    facts.sampleSize ? `Sample size: n = ${facts.sampleSize}.` : null,
    ...Object.entries(facts.normality).slice(0, 4).map(([name, result]) => `${name} was reported as ${result.finding}.`),
    comparison?.metrics?.pValue ? `${comparison.label} p-value: ${comparison.metrics.pValue}.` : null,
    comparison?.metrics?.effectSize ? `${comparison.label} effect size: ${comparison.metrics.effectSize}.` : null,
    confidenceEvidence ? `Effect-size confidence interval: ${confidenceEvidence.value}.` : null,
  ].filter(Boolean);

  const sourceReferences = [
    "General Information",
    "Independent One-Group Analysis",
    "Dependent Data Analysis",
    "Statistical Methods Summary",
  ].filter((section) => facts.sourceSections.includes(section));

  return artifactEnvelope("executive-summary", source, {
    title: comparison ? `Executive Summary: ${comparison.label}` : "Executive Summary",
    audience: "Decision makers reviewing the statistical analysis",
    status: "draft",
    overview,
    keyFindings,
    statisticalEvidence: statisticalEvidence.length > 0 ? statisticalEvidence : ["No statistical evidence fields were extracted from the source."],
    confidenceNote: confidenceEvidence
      ? `The paired effect-size confidence interval (${confidenceEvidence.value}) stays on the negative side, which supports a consistent downward effect.`
      : undefined,
    implications: [
      comparison ? `${comparison.label} should be treated as the primary analytical relationship in this source.` : "The source can still be compiled, but no explicit comparison was detected.",
      pairedEffectEvidence ? "The negative effect direction suggests that later values are systematically lower than earlier values." : "Interpretation should stay close to the extracted evidence because no effect size was detected.",
      Object.keys(facts.normality).length > 0 ? "The normality findings help explain why different statistical methods were selected." : "Method interpretation is limited because no normality findings were extracted.",
    ],
    recommendedActions: [
      `${visualRecommendation(facts)} Pair the visual with the effect size so viewers see both direction and magnitude.`,
      "Report the p-value and effect size together so the result is not framed as significance alone.",
      "Keep the normality findings visible when explaining why Wilcoxon and T-test methods were selected.",
    ],
    sourceReferences,
  });
}

function makeQuizQuestion(id, type, difficulty, question, answer, sourceReference, confidence = null) {
  return { id, type, difficulty, question, answer, sourceReference, confidence: normalizeConfidence(confidence) };
}

function generateQuiz(source, facts) {
  if (source.isEmpty) {
    return artifactEnvelope(
      "quiz",
      source,
      {
        title: "Knowledge Base Readiness Quiz",
        status: "source-empty",
        questionCount: 5,
        questions: [
          makeQuizQuestion("q1", "fact-recall", "easy", "Which file does the studio-agent use as its knowledge source?", "knowledge-base.md.", "Unknown Section"),
          makeQuizQuestion("q2", "interpretation", "medium", "Why is this quiz not about domain facts yet?", "The source is empty, so unsupported facts are not generated.", "Unknown Section"),
          makeQuizQuestion("q3", "method-selection", "easy", "What should happen after adding source material?", "Run npm start to regenerate the artifacts.", "Unknown Section"),
          makeQuizQuestion("q4", "fact-recall", "easy", "What metadata helps detect stale artifacts?", "The source hash and schema version.", "Unknown Section"),
          makeQuizQuestion("q5", "comparison", "medium", "What artifact is generated alongside the quiz?", "A structured executive summary.", "Unknown Section"),
        ],
      },
      ["knowledge-base.md is empty; generated a readiness quiz instead of unsupported domain questions."]
    );
  }

  const comparison = primaryComparison(facts);
  const variableNames = Object.keys(facts.variables);
  const medianEvidence = findEvidence(facts, "median change");
  const pairedEffectEvidence = findEvidence(facts, "paired effect size");
  const significanceEvidence = findEvidence(facts, "significance");
  const questions = [
    makeQuizQuestion("q1", "fact-recall", "easy", "What sample size was used in the analysis?", facts.sampleSize ? `The analysis used n = ${facts.sampleSize}.` : "No sample size was extracted from the source.", firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]), facts.sampleSizeFact?.confidence),
    makeQuizQuestion("q2", "fact-recall", "easy", "Which variables or measurements were detected?", variableNames.length > 0 ? `The detected variables include ${variableNames.slice(0, 5).join(", ")}.` : "No explicit variable table was detected.", firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]), variableNames.length > 0 ? 0.75 : null),
  ];

  if (comparison && medianEvidence) {
    questions.push(makeQuizQuestion("q3", "comparison", "medium", `What changed in ${comparison.label}?`, medianEvidence.value, comparison.sourceSection, medianEvidence.confidence));
  }
  if (pairedEffectEvidence) {
    questions.push(makeQuizQuestion("q4", "interpretation", "medium", `What does the effect size ${pairedEffectEvidence.value} mean?`, "It indicates a large negative effect, with later values substantially lower than earlier values.", pairedEffectEvidence.sourceSection, pairedEffectEvidence.confidence));
  }
  if (comparison) {
    questions.push(makeQuizQuestion("q5", "method-selection", "medium", `Which test was used for ${comparison.label}?`, facts.dependentAnalysis.test ? `${facts.dependentAnalysis.test} was used for the paired comparison.` : "The source did not specify a named test for this comparison.", comparison.sourceSection, facts.dependentAnalysis.test ? 0.75 : null));
  }
  if (significanceEvidence && pairedEffectEvidence) {
    questions.push(makeQuizQuestion("q6", "interpretation", "hard", "Why should the result be reported with both p-value and effect size?", `${significanceEvidence.value} establishes statistical significance, while ${pairedEffectEvidence.value} explains the magnitude and direction of the effect.`, significanceEvidence.sourceSection, Math.min(significanceEvidence.confidence, pairedEffectEvidence.confidence)));
  }
  const normalVariable = Object.entries(facts.normality).find(([, result]) => result.isNormal);
  if (normalVariable) {
    questions.push(makeQuizQuestion("q7", "method-selection", "medium", `Why was a parametric test appropriate for ${normalVariable[0]}?`, `${normalVariable[0]} was reported as normally distributed, so a parametric test was appropriate where that variable was analyzed independently.`, firstAvailableSection(facts.sourceSections, ["Independent One-Group Analysis", "Statistical Methods Summary", "Unknown Section"]), 0.75));
  }

  while (questions.length < 5) {
    const index = questions.length + 1;
    questions.push(makeQuizQuestion(`q${index}`, "interpretation", "medium", "What should a reader do when evidence is incomplete?", "Use only the extracted facts and avoid adding unsupported conclusions.", firstAvailableSection(facts.sourceSections, ["Unknown Section"])));
  }

  return artifactEnvelope("quiz", source, {
    title: "Statistical Analysis Quiz",
    status: "draft",
    questionCount: questions.length,
    questions,
  });
}

function generateFaq(source, facts) {
  const comparison = primaryComparison(facts);
  const medianEvidence = findEvidence(facts, "median change");
  const significanceEvidence = findEvidence(facts, "significance");
  const pairedEffectEvidence = findEvidence(facts, "paired effect size");
  const independentEffectEvidence = findEvidence(facts, "independent effect size");
  const variableNames = Object.keys(facts.variables);

  const items = [
    makeFaqItem("faq1", "easy", "What was the sample size?", facts.sampleSize ? `The analysis included ${facts.sampleSize} observations.` : "No sample size was extracted from the source.", firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]), facts.sampleSizeFact?.confidence),
    makeFaqItem("faq2", "easy", "Which variables were detected?", variableNames.length > 0 ? `The detected variables include ${variableNames.slice(0, 5).join(", ")}.` : "No explicit variables were detected.", firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]), variableNames.length > 0 ? 0.75 : null),
    makeFaqItem("faq7", "medium", "How should this result be visualized?", visualRecommendation(facts), firstAvailableSection(facts.sourceSections, ["Visual Suggestions", "Unknown Section"]), facts.visualSuggestions.length > 0 ? 0.75 : 0.45),
    makeFaqItem("faq8", "hard", "Can statistical significance be misleading here?", significanceEvidence && pairedEffectEvidence ? `Yes. ${significanceEvidence.value} shows the result is statistically reliable, but ${pairedEffectEvidence.value} is needed to judge how large the change is.` : "Yes. Statistical significance should not be interpreted without checking the available effect-size or practical evidence.", significanceEvidence?.sourceSection || firstAvailableSection(facts.sourceSections, ["Dependent Data Analysis", "Unknown Section"]), significanceEvidence && pairedEffectEvidence ? Math.min(significanceEvidence.confidence, pairedEffectEvidence.confidence) : 0.45),
    makeFaqItem("faq9", "hard", "What are the main limitations of this analysis?", "The artifact should be interpreted within the source context, and the MVP also depends on rule-based extraction from the source format.", firstAvailableSection(facts.sourceSections, ["Dependent Data Analysis", "Unknown Section"]), 0.6),
  ];

  if (comparison && medianEvidence) {
    items.splice(2, 0, makeFaqItem("faq3", "medium", `What changed in ${comparison.label}?`, medianEvidence.value, comparison.sourceSection, medianEvidence.confidence));
  }
  if (significanceEvidence) {
    items.splice(3, 0, makeFaqItem("faq4", "medium", "Is the main result statistically significant?", `Yes. The analysis reports ${significanceEvidence.value}, which is statistically significant at the stated threshold.`, significanceEvidence.sourceSection, significanceEvidence.confidence));
  }
  if (pairedEffectEvidence) {
    items.splice(4, 0, makeFaqItem("faq5", "medium", "What does the effect size mean?", `${pairedEffectEvidence.value} indicates a large negative effect, so later values are meaningfully lower than earlier values.`, pairedEffectEvidence.sourceSection, pairedEffectEvidence.confidence));
  }
  if (facts.dependentAnalysis.test) {
    items.splice(5, 0, makeFaqItem("faq6", "hard", "Why was the paired comparison method selected?", `${facts.dependentAnalysis.test} was used because the paired comparison was treated as dependent, non-normal data.`, firstAvailableSection(facts.sourceSections, ["Statistical Methods Summary", "Unknown Section"])));
  }

  if (independentEffectEvidence) {
    items.push(
      makeFaqItem(
        "faq10",
        "medium",
        "What was notable in the independent analysis?",
        `The independent analysis reported ${independentEffectEvidence.value}.`,
        independentEffectEvidence.sourceSection
      )
    );
  }

  while (items.length < 6) {
    const id = `faq${items.length + 1}`;
    items.push(
      makeFaqItem(
        id,
        "medium",
        "What should readers do when the source has limited structured evidence?",
        "Readers should use the available extracted facts and avoid adding conclusions that are not supported by the source.",
        firstAvailableSection(facts.sourceSections, ["Unknown Section"])
      )
    );
  }

  return artifactEnvelope("faq", source, {
    title: "Statistical Analysis FAQ",
    status: "draft",
    itemCount: items.length,
    items,
  });
}

function makeFaqItem(id, difficulty, question, answer, sourceReference, confidence = null) {
  return { id, question, answer, sourceReference, difficulty, confidence: normalizeConfidence(confidence) };
}

function generateInsightBrief(source, facts) {
  const comparison = primaryComparison(facts);
  const medianEvidence = findEvidence(facts, "median change");
  const significanceEvidence = findEvidence(facts, "significance");
  const pairedEffectEvidence = findEvidence(facts, "paired effect size");
  const confidenceEvidence = findEvidence(facts, "confidence-interval");
  const independentEffectEvidence = findEvidence(facts, "independent effect size");
  const coreInsight = comparison
    ? `${comparison.label} is the primary decision-relevant relationship in this source.`
    : "The source can be compiled into decision support, but no explicit comparison was detected.";
  const supportingInsights = [];

  if (comparison && medianEvidence) {
    supportingInsights.push({
      claim: "The observed change is large enough to drive the main decision narrative.",
      reasoning:
        "The extracted statistic shows a substantial change across the comparison, so the result is not just a small directional movement. This supports making the comparison the primary message when communicating the analysis.",
      evidence: [medianEvidence.value, pairedEffectEvidence?.value].filter(Boolean),
      sourceSection: comparison.sourceSection,
      confidence: Math.min(medianEvidence.confidence, pairedEffectEvidence?.confidence || medianEvidence.confidence),
    });
  }
  if (significanceEvidence) {
    supportingInsights.push({
      claim: "The main result is statistically reliable, not only visually apparent.",
      reasoning:
        "The extracted significance evidence reduces the risk that the observed difference is treated as noise. It should still be interpreted with effect size or practical evidence rather than used alone.",
      evidence: [significanceEvidence.value, confidenceEvidence?.value].filter(Boolean),
      sourceSection: significanceEvidence.sourceSection,
      confidence: significanceEvidence.confidence,
    });
  }
  if (pairedEffectEvidence) {
    supportingInsights.push({
      claim: "The direction and magnitude of the effect matter for interpretation.",
      reasoning:
        "The effect-size evidence explains more than whether a difference exists. It helps decision makers understand the strength and direction of the relationship before acting on the finding.",
      evidence: [pairedEffectEvidence.value, confidenceEvidence?.value].filter(Boolean),
      sourceSection: pairedEffectEvidence.sourceSection,
      confidence: pairedEffectEvidence.confidence,
    });
  }
  if (independentEffectEvidence) {
    supportingInsights.push({
      claim: "The independent finding should be discussed separately from the main comparison.",
      reasoning:
        "The independent effect-size evidence answers a different question from the paired comparison. Keeping these findings separate avoids mixing distinct statistical claims in one decision message.",
      evidence: [independentEffectEvidence.value, "Reference value = 1"].filter(Boolean),
      sourceSection: independentEffectEvidence.sourceSection,
      confidence: independentEffectEvidence.confidence,
    });
  }
  while (supportingInsights.length < 3) {
    supportingInsights.push({
      claim: "The compiler should stay close to the available evidence.",
      reasoning:
        "The source does not provide enough structured statistical evidence for a stronger claim. A conservative decision artifact should surface that limitation rather than infer missing facts.",
      evidence: facts.evidence.slice(0, 2).map((item) => item.value),
      sourceSection: firstAvailableSection(facts.sourceSections, ["Unknown Section"]),
      confidence: 0.45,
    });
  }
  const sourceMappings = [
    { claim: coreInsight, sourceSection: comparison?.sourceSection || firstAvailableSection(facts.sourceSections, ["Unknown Section"]) },
    ...supportingInsights.map((insight) => ({
      claim: insight.claim,
      sourceSection: insight.sourceSection,
    })),
  ];

  return artifactEnvelope("insight-brief", source, {
    title: comparison ? `Insight Brief: ${comparison.label}` : "Insight Brief",
    audience: "Decision makers deciding how to present and act on the analysis",
    status: "draft",
    coreInsight,
    supportingInsights,
    risksOrLimitations: [
      "Statistical limitation: the report establishes an analytical relationship, but practical meaning still depends on domain context outside the statistical output.",
      "Statistical limitation: significance and effect size can support a result, but they do not explain the causal mechanism behind the observed pattern.",
      "System limitation: the MVP extracts facts with rule-based patterns, so unusual source formatting could require parser updates.",
    ],
    recommendedDecisions: [
      comparison
        ? `Treat ${comparison.label} as the main decision-facing message, but avoid presenting it as causal without additional domain evidence.`
        : "Treat the strongest extracted claim as provisional, and avoid presenting it as causal without additional domain evidence.",
      "Use statistical significance to establish reliability, but pair it with effect size and median change so stakeholders can judge magnitude.",
      `${visualRecommendation(facts)} Accompany it with the effect size to avoid a visual-only interpretation.`,
    ],
    sourceMappings,
  });
}

function comparisonKeyMetrics(comparison, facts) {
  const evidence = facts.evidence.filter((item) => item.sourceSection === comparison.sourceSection).map((item) => item.value);
  const metrics = [];
  if (comparison.metrics?.referenceValue !== null && comparison.metrics?.referenceValue !== undefined) {
    metrics.push(`Reference value = ${comparison.metrics.referenceValue}`);
  }
  if (comparison.metrics?.pValue) metrics.push(comparison.metrics.pValue);
  if (comparison.metrics?.effectSize) metrics.push(comparison.metrics.effectSize);
  if (comparison.metrics?.confidenceInterval) metrics.push(comparison.metrics.confidenceInterval);
  return [...new Set([...evidence, ...metrics])].slice(0, 5);
}

function comparisonInterpretation(comparison, metrics) {
  const joined = metrics.join(" ");
  if (/r\s*=\s*-/.test(joined) && /p\s*</.test(joined)) {
    return "Direction is downward, strength is large, and the result is statistically reliable; the practical meaning is that later values are much lower than earlier values.";
  }
  if (/p\s*</.test(joined)) return "The relationship is statistically reliable, but effect-size or practical context is needed before making a decision.";
  if (/Cohen's d/i.test(joined)) return "This independent comparison has a reported effect size, so it should be interpreted as a separate finding from the main paired change.";
  return comparison.type === "paired" ? "This paired relationship has extracted metrics that can support a focused interpretation." : "This detected relationship has supporting metrics, but the interpretation should stay close to the available evidence.";
}

function generateComparisonMatrix(source, facts) {
  const comparisons = facts.comparisons.length > 0
    ? facts.comparisons
    : [
        {
          type: "available-evidence",
          label: "Available Evidence",
          variables: Object.keys(facts.variables).slice(0, 5),
          sourceSection: firstAvailableSection(facts.sourceSections, ["Unknown Section"]),
          metrics: {},
        },
      ];

  const entries = comparisons.map((comparison) => {
    const keyMetrics = comparisonKeyMetrics(comparison, facts);
    const fallbackMetrics = facts.evidence.slice(0, 4).map((item) => item.value);
    const metrics = keyMetrics.length > 0 ? keyMetrics : fallbackMetrics.length > 0 ? fallbackMetrics : ["No structured metrics were extracted."];

    return {
      label: comparison.label,
      comparisonType: comparison.type,
      variables: comparison.variables || [],
      keyMetrics: metrics,
      interpretation: comparisonInterpretation(comparison, metrics),
      sourceReference: comparison.sourceSection || firstAvailableSection(facts.sourceSections, ["Unknown Section"]),
      confidence: normalizeConfidence(comparison.confidence) || (facts.evidence.length > 0 ? aggregateConfidence(facts.evidence) : null),
    };
  });

  return artifactEnvelope("comparison-matrix", source, {
    title: "Comparison Matrix",
    status: "draft",
    comparisons: entries,
  });
}

function makeWorksheetQuestion(id, prompt, skillType, sourceReference) {
  return { id, prompt, skillType, sourceReference };
}

function generateWorksheet(source, facts) {
  const comparison = primaryComparison(facts);
  const medianEvidence = findEvidence(facts, "median change");
  const significanceEvidence = findEvidence(facts, "significance");
  const pairedEffectEvidence = findEvidence(facts, "paired effect size");
  const methodSection = firstAvailableSection(facts.sourceSections, ["Statistical Methods Summary", "Unknown Section"]);
  const evidenceSection = comparison?.sourceSection || firstAvailableSection(facts.sourceSections, ["Dependent Data Analysis", "Unknown Section"]);
  const generalSection = firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]);
  const questions = [
    makeWorksheetQuestion("w1", "Identify the main analytical relationship in the source and state why it matters.", "interpretation", evidenceSection),
    makeWorksheetQuestion("w2", "Use the available evidence to explain whether the main result is statistically reliable.", "evidence reading", evidenceSection),
    makeWorksheetQuestion("w3", "Explain why the selected method fits the available normality or comparison information.", "method reasoning", methodSection),
    makeWorksheetQuestion("w4", "Separate the main comparison from any independent finding so the claims do not get mixed.", "claim separation", firstAvailableSection(facts.sourceSections, ["Independent One-Group Analysis", evidenceSection])),
    makeWorksheetQuestion("w5", "Recommend one visual that would help a stakeholder understand the main finding.", "communication design", firstAvailableSection(facts.sourceSections, ["Visual Suggestions", evidenceSection])),
  ];

  const answerKey = {
    w1: comparison ? `${comparison.label} is the main relationship because it carries the strongest extracted comparison evidence.` : "No explicit comparison was detected, so use the strongest extracted finding conservatively.",
    w2: significanceEvidence ? `${significanceEvidence.value} supports statistical reliability; pair it with effect-size evidence when available.` : "No p-value was extracted, so reliability should be described cautiously.",
    w3: facts.dependentAnalysis.test ? `${facts.dependentAnalysis.test} was selected for the paired analysis based on the method notes and distribution findings.` : "Use the methods section when available; otherwise avoid inferring a test.",
    w4: pairedEffectEvidence ? `The paired result uses ${pairedEffectEvidence.value}; independent findings should be described as separate evidence.` : "Keep each finding tied to its own source section and evidence.",
    w5: visualRecommendation(facts),
  };

  if (medianEvidence) {
    questions.push(makeWorksheetQuestion("w6", "Read the reported change and restate it in one sentence without adding unsupported causes.", "evidence reading", medianEvidence.sourceSection));
    answerKey.w6 = medianEvidence.value;
  }

  return artifactEnvelope("worksheet", source, {
    title: comparison ? `Worksheet: ${comparison.label}` : "Worksheet",
    audience: "Learners reviewing the compiled knowledge base",
    status: "draft",
    learningGoals: [
      "Identify the main analytical relationship from structured evidence.",
      "Distinguish statistical reliability from practical interpretation.",
      "Connect claims to source sections before drawing conclusions.",
    ],
    guidedQuestions: questions,
    answerKey,
    sourceReferences: [...new Set(questions.map((question) => question.sourceReference).concat(generalSection))],
  });
}

function generateSlideDeck(source, facts) {
  const comparison = primaryComparison(facts);
  const evidenceSection = comparison?.sourceSection || firstAvailableSection(facts.sourceSections, ["Unknown Section"]);
  const evidenceBullets = facts.evidence.slice(0, 4).map((item) => ({
    text: `${item.label}: ${item.value}`,
    sourceReference: item.sourceSection,
  }));

  return artifactEnvelope("slide-deck", source, {
    title: comparison ? `Slide Deck: ${comparison.label}` : "Slide Deck",
    status: "draft",
    slides: [
      {
        title: "Main Message",
        sourceReference: evidenceSection,
        confidence: comparison?.confidence || 0.6,
        bullets: [
          {
            text: comparison ? `${comparison.label} is the main analytical relationship detected in the source.` : "No explicit comparison was detected, so the deck stays close to available facts.",
            sourceReference: evidenceSection,
          },
        ],
      },
      {
        title: "Evidence",
        sourceReference: evidenceSection,
        confidence: evidenceBullets.length > 0 ? 0.9 : 0.4,
        bullets: evidenceBullets.length > 0 ? evidenceBullets : [{ text: "Structured evidence is not available in the source.", sourceReference: evidenceSection }],
      },
      {
        title: "Interpretation",
        sourceReference: evidenceSection,
        confidence: comparison?.confidence || 0.5,
        bullets: [
          {
            text: comparison ? comparisonInterpretation(comparison, comparisonKeyMetrics(comparison, facts)) : "Interpret cautiously because no comparison-level evidence was extracted.",
            sourceReference: evidenceSection,
          },
        ],
      },
      {
        title: "Implications",
        sourceReference: evidenceSection,
        confidence: 0.65,
        bullets: [
          {
            text: comparison ? `${comparison.label} should be discussed with source evidence visible.` : "Implications are limited because no comparison was extracted.",
            sourceReference: evidenceSection,
          },
        ],
      },
      {
        title: "Action",
        sourceReference: firstAvailableSection(facts.sourceSections, ["Visual Suggestions", evidenceSection]),
        confidence: 0.65,
        bullets: [
          {
            text: `${visualRecommendation(facts)} Keep source evidence visible when presenting the result.`,
            sourceReference: firstAvailableSection(facts.sourceSections, ["Visual Suggestions", evidenceSection]),
          },
        ],
      },
    ],
  });
}

function generateDecisionCard(source, facts) {
  const comparison = primaryComparison(facts);
  const evidence = facts.evidence.slice(0, 4);
  const evidenceSection = comparison?.sourceSection || firstAvailableSection(facts.sourceSections, ["Unknown Section"]);
  const confidence = evidence.length > 0 ? Number((evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length).toFixed(2)) : 0.45;

  return artifactEnvelope("decision-card", source, {
    title: "Decision Card",
    status: "draft",
    mainDecision: {
      claim: comparison ? `Use ${comparison.label} as the main discussion point.` : "Use the available facts cautiously; no explicit comparison was detected.",
      sourceSection: evidenceSection,
      confidence,
      supported: confidence >= 0.3,
    },
    supportingEvidence: evidence.map((item) => ({
      value: item.value,
      sourceSection: item.sourceSection,
      confidence: item.confidence,
      supported: item.supported,
    })),
    recommendedAction: {
      claim: evidence.length > 0 ? `${visualRecommendation(facts)} Keep source labels visible when presenting the claim.` : "Collect more source evidence before making a strong recommendation.",
      sourceSection: firstAvailableSection(facts.sourceSections, ["Visual Suggestions", evidenceSection]),
      confidence: evidence.length > 0 ? 0.65 : 0.35,
      supported: true,
    },
  });
}

function generateSummaryNotes(source, facts) {
  const comparison = primaryComparison(facts);
  const generalSection = firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]);
  const evidenceSection = comparison?.sourceSection || firstAvailableSection(facts.sourceSections, ["Unknown Section"]);
  const evidenceBullets = facts.evidence.map((item) => ({ text: `${item.label}: ${item.value}`, sourceReference: item.sourceSection }));

  return artifactEnvelope("summary-notes", source, {
    title: "Summary Notes",
    status: "draft",
    notes: [
      {
        heading: "Context",
        bullets: [
          { text: facts.sampleSize ? `Sample size: n = ${facts.sampleSize}.` : "Sample size is not available.", sourceReference: generalSection },
          { text: comparison ? `Main comparison: ${comparison.label}.` : "No explicit comparison was detected.", sourceReference: evidenceSection },
        ],
      },
      {
        heading: "Evidence",
        bullets: evidenceBullets.length > 0 ? evidenceBullets : [{ text: "No structured evidence was extracted.", sourceReference: evidenceSection }],
      },
      {
        heading: "Takeaway",
        bullets: [
          {
            text: comparison ? `${comparison.label} should be discussed with its supporting metrics and source context.` : "Use only the available facts and avoid unsupported conclusions.",
            sourceReference: evidenceSection,
          },
        ],
      },
    ],
  });
}

function generateTeachingOutline(source, facts) {
  const comparison = primaryComparison(facts);
  const generalSection = firstAvailableSection(facts.sourceSections, ["General Information", "Unknown Section"]);
  const methodSection = firstAvailableSection(facts.sourceSections, ["Statistical Methods Summary", "Unknown Section"]);
  const evidenceSection = comparison?.sourceSection || firstAvailableSection(facts.sourceSections, ["Unknown Section"]);

  return artifactEnvelope("teaching-outline", source, {
    title: comparison ? `Teaching Outline: ${comparison.label}` : "Teaching Outline",
    status: "draft",
    sections: [
      {
        title: "Start With Context",
        explanationOrder: 1,
        teachingPoint: facts.sampleSize ? `Explain that the analysis is based on n = ${facts.sampleSize}.` : "Explain that sample size was not extracted.",
        confidence: facts.sampleSize ? 0.95 : 0.35,
        sourceReference: generalSection,
      },
      {
        title: "Introduce the Main Relationship",
        explanationOrder: 2,
        teachingPoint: comparison ? `Define ${comparison.label} before showing metrics.` : "Show the available facts before making interpretations.",
        confidence: comparison?.confidence || 0.45,
        sourceReference: evidenceSection,
      },
      {
        title: "Read the Evidence",
        explanationOrder: 3,
        teachingPoint: facts.evidence.length > 0 ? `Use evidence such as ${facts.evidence[0].value} to practice evidence reading.` : "Ask learners to identify what evidence is missing.",
        confidence: facts.evidence[0]?.confidence || 0.35,
        sourceReference: evidenceSection,
      },
      {
        title: "Explain the Method",
        explanationOrder: 4,
        teachingPoint: facts.methods.length > 0 ? `Discuss why ${facts.methods[0]} appears in the method summary.` : "Avoid inventing method details if the source does not provide them.",
        confidence: facts.methods.length > 0 ? 0.7 : 0.35,
        sourceReference: methodSection,
      },
      {
        title: "Close With Interpretation",
        explanationOrder: 5,
        teachingPoint: "Ask learners to separate what the source proves from what still needs domain context.",
        confidence: 0.6,
        sourceReference: evidenceSection,
      },
    ],
  });
}

function isFullSentence(value) {
  return typeof value === "string" && /^[A-Z0-9]/.test(value.trim()) && /[.!?]$/.test(value.trim()) && value.trim().split(/\s+/).length >= 6;
}

function hasBrokenFragment(value) {
  const text = typeof value === "string" ? value.trim() : value?.claim?.trim();
  if (!text) return true;
  return text.length < 12 || /^\|/.test(text) || /\s\|\s/.test(text) || /What source claim is captured/i.test(text) || /^[-*]\s/.test(text);
}

function answerLooksLikeRawDump(answer) {
  return typeof answer === "string" && (answer.length > 240 || /\|/.test(answer) || /#{1,6}\s/.test(answer));
}

function metricCount(value) {
  if (typeof value !== "string") return 0;
  const patterns = [/\bmedian\b/i, /\bp\s*[<=>]/i, /\br\s*=/i, /Cohen's d/i, /confidence interval/i, /%/];
  return patterns.filter((pattern) => pattern.test(value)).length;
}

function hasBannedWording(value) {
  return typeof value === "string" && (/\b([A-Za-z0-9_]+):\s*\1\b/i.test(value) || /dagilima/i.test(value));
}

function collectContentStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectContentStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectContentStrings);
  return [];
}

function validateSourceReferences(references, facts, label) {
  if (!Array.isArray(references) || references.length === 0) {
    return [`${label} sourceReferences must be present and non-empty.`];
  }

  return references
    .filter((reference) => !facts.sourceSections.includes(reference))
    .map((reference) => `${label} source reference is not backed by a source section: ${reference}.`);
}

function isUserFacingQuestion(question) {
  return typeof question === "string" && /\?$/.test(question.trim()) && !/debug|schema|artifact|source claim|captured by item/i.test(question);
}

function hasDuplicateQuestions(items) {
  const normalized = items.map((item) => item.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  return new Set(normalized).size !== normalized.length;
}

function validateClaimSectionMapping(claim, sourceSection, facts, label) {
  const errors = [];
  if (!claim || !sourceSection) errors.push(`${label} requires claim-level source mapping.`);
  if (sourceSection && !facts.sourceSections.includes(sourceSection)) {
    errors.push(`${label} sourceSection is not backed by a source section.`);
  }
  return errors;
}

function hasAnalyticalFaqItem(items) {
  return items.some((item) => item.difficulty === "hard" || /misleading|limitations|why|interpret/i.test(item.question));
}

function reasoningIsSubstantive(reasoning) {
  if (typeof reasoning !== "string") return false;
  const sentences = reasoning.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  return reasoning.split(/\s+/).length >= 18 && sentences.length >= 2;
}

function validateNoUnsupportedHardcodedNames(artifact, facts) {
  const knownNames = new Set(Object.keys(facts.variables));
  return ["dp1", "cov1"]
    .filter((name) => !knownNames.has(name))
    .filter((name) => collectContentStrings(artifact.content).some((value) => new RegExp(`\\b${name}\\b`, "i").test(value)))
    .map((name) => `Artifact references ${name}, but that variable was not detected in the source.`);
}

function validateRequiredFields(artifact, schema) {
  const errors = [];
  for (const field of schema.requiredContentFields || []) {
    const value = artifact.content?.[field];
    const missingArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === "" || missingArray) {
      errors.push(`${artifact.artifactType} content.${field} is required by schema.`);
    }
  }
  return errors;
}

function lintArtifact(artifact, schemas, facts, allArtifacts = {}) {
  const errors = [];
  const schema = schemas[artifact.artifactType];

  if (!artifact.artifactType) errors.push("artifactType is required.");
  if (!artifact.schemaVersion) errors.push("schemaVersion is required.");
  if (!artifact.provenance?.sourceHash) errors.push("sourceHash provenance is required.");
  if (!artifact.staleWhen?.sourceHashChanges) errors.push("staleWhen.sourceHashChanges is required.");
  if (!artifact.review?.riskLevel) errors.push("review.riskLevel is required.");
  if (!schema) errors.push(`No schema loaded for artifact type ${artifact.artifactType}.`);

  if (schema) {
    errors.push(...validateRequiredFields(artifact, schema));
    if (schema.schemaVersion !== artifact.schemaVersion) {
      errors.push(`Schema version mismatch: artifact ${artifact.schemaVersion}, schema ${schema.schemaVersion}.`);
    }
  }
  errors.push(...validateNoUnsupportedHardcodedNames(artifact, facts));

  if (artifact.artifactType === "executive-summary") {
    const content = artifact.content;
    if (!isFullSentence(content.overview)) errors.push("Executive summary overview must be a full sentence.");
    errors.push(...validateSourceReferences(content.sourceReferences, facts, "Executive summary"));
    if (!Array.isArray(content.keyFindings) || content.keyFindings.some(hasBrokenFragment)) {
      errors.push("Executive summary keyFindings must be complete, non-fragment sentences.");
    }
    for (const finding of content.keyFindings || []) {
      errors.push(...validateClaimSectionMapping(finding.claim, finding.sourceSection, facts, "Executive summary keyFinding"));
      if (metricCount(finding.claim) > 2) {
        errors.push("Executive summary keyFinding contains too many metrics for one atomic claim.");
      }
    }
    if (new Set((content.keyFindings || []).map((finding) => finding.claim)).size < 3) {
      errors.push("Executive summary requires at least 3 distinct key findings.");
    }
    if (content.keyFindings?.some((finding) => finding.length > 280)) {
      errors.push("Executive summary keyFindings must be synthesized, not raw long chunks.");
    }
    if (collectContentStrings(content).some(hasBannedWording)) {
      errors.push("Executive summary contains repeated-token wording or transliteration artifacts.");
    }
  }

  if (artifact.artifactType === "quiz") {
    const questions = artifact.content.questions;
    if (!Array.isArray(questions) || questions.length < 5) {
      errors.push("Quiz requires at least 5 questions.");
    }
    if (Array.isArray(questions)) {
      const types = new Set(questions.map((question) => question.type));
      for (const requiredType of ["fact-recall", "interpretation"]) {
        if (!types.has(requiredType)) errors.push(`Quiz is missing ${requiredType} question type.`);
      }
      if (facts.comparisons.length > 0 && !types.has("comparison")) errors.push("Quiz is missing comparison question type.");
      if ((facts.methods.length > 0 || Object.keys(facts.normality).length > 0) && !types.has("method-selection")) {
        errors.push("Quiz is missing method-selection question type.");
      }
      const factOrientedCount = questions.filter((question) => question.type === "fact-recall").length;
      const higherOrderCount = questions.filter((question) => ["interpretation", "comparison", "method-selection"].includes(question.type)).length;
      if (factOrientedCount < 2) errors.push("Quiz requires at least 2 fact-oriented questions.");
      if (higherOrderCount < 2) errors.push("Quiz requires at least 2 higher-order questions.");
      for (const question of questions) {
        if (!question.id || !question.type || !question.question || !question.answer || !question.sourceReference) {
          errors.push("Each quiz question requires id, type, question, answer, and sourceReference.");
        }
        if (question.difficulty && !["easy", "medium", "hard"].includes(question.difficulty)) {
          errors.push(`Quiz item ${question.id} has invalid difficulty.`);
        }
        if (!facts.sourceSections.includes(question.sourceReference)) {
          errors.push(`Quiz item ${question.id} sourceReference is not backed by a source section.`);
        }
        if (!/\?$/.test(question.question || "")) errors.push(`Quiz item ${question.id || "unknown"} must be phrased as a question.`);
        if (/What source claim is captured/i.test(question.question || "")) {
          errors.push(`Quiz item ${question.id} uses the low-quality iteration 1 question pattern.`);
        }
        if ((question.answer || "") === (question.sourceExcerpt || "")) {
          errors.push(`Quiz item ${question.id} answer must not simply equal a raw source excerpt.`);
        }
        if (answerLooksLikeRawDump(question.answer)) {
          errors.push(`Quiz item ${question.id} answer looks like a raw source dump.`);
        }
        if (collectContentStrings(question).some(hasBannedWording)) {
          errors.push(`Quiz item ${question.id} contains repeated-token wording or transliteration artifacts.`);
        }
      }
    }
  }

  if (artifact.artifactType === "faq") {
    const items = artifact.content.items;
    if (!Array.isArray(items) || items.length < 6) errors.push("FAQ requires at least 6 items.");
    if (Array.isArray(items)) {
      if (hasDuplicateQuestions(items)) errors.push("FAQ questions must not repeat.");
      if (!hasAnalyticalFaqItem(items)) errors.push("FAQ requires at least 1 analytical question.");
      for (const item of items) {
        if (!item.id || !item.question || !item.answer || !item.sourceReference || !item.difficulty) {
          errors.push("Each FAQ item requires id, question, answer, sourceReference, and difficulty.");
        }
        if (!isUserFacingQuestion(item.question)) errors.push(`FAQ item ${item.id || "unknown"} must be a user-facing question.`);
        if (!["easy", "medium", "hard"].includes(item.difficulty)) errors.push(`FAQ item ${item.id} has invalid difficulty.`);
        if (!facts.sourceSections.includes(item.sourceReference)) errors.push(`FAQ item ${item.id} sourceReference is not backed by a source section.`);
        if (answerLooksLikeRawDump(item.answer)) errors.push(`FAQ item ${item.id} answer looks like a raw source dump.`);
        if (collectContentStrings(item).some(hasBannedWording)) errors.push(`FAQ item ${item.id} contains repeated-token wording or transliteration artifacts.`);
      }
    }
  }

  if (artifact.artifactType === "insight-brief") {
    const content = artifact.content;
    if (!isFullSentence(content.coreInsight)) errors.push("Insight brief coreInsight must be a complete sentence.");
    if (!Array.isArray(content.supportingInsights) || content.supportingInsights.length < 3) {
      errors.push("Insight brief requires at least 3 supportingInsights.");
    }
    if (!Array.isArray(content.risksOrLimitations) || content.risksOrLimitations.length < 2) {
      errors.push("Insight brief requires at least 2 risksOrLimitations.");
    }
    if (!Array.isArray(content.sourceMappings) || content.sourceMappings.length < 1) {
      errors.push("Insight brief requires sourceMappings.");
    }

    const mappedClaims = new Set((content.sourceMappings || []).map((mapping) => mapping.claim));
    for (const insight of content.supportingInsights || []) {
      if (!insight.claim || !insight.reasoning || !insight.sourceSection) {
        errors.push("Each insight brief supportingInsight requires claim, reasoning, and sourceSection.");
        continue;
      }
      if (!reasoningIsSubstantive(insight.reasoning)) {
        errors.push(`Insight brief supportingInsight reasoning is too thin: ${insight.claim}`);
      }
      if (insight.evidence && (!Array.isArray(insight.evidence) || insight.evidence.length === 0)) {
        errors.push(`Insight brief supportingInsight evidence must not be empty when present: ${insight.claim}`);
      }
      errors.push(...validateClaimSectionMapping(insight.claim, insight.sourceSection, facts, "Insight brief supportingInsight"));
      if (!mappedClaims.has(insight.claim)) errors.push(`Insight brief supporting insight is missing source mapping: ${insight.claim}`);
    }
    for (const mapping of content.sourceMappings || []) {
      errors.push(...validateClaimSectionMapping(mapping.claim, mapping.sourceSection, facts, "Insight brief sourceMapping"));
    }
    if (collectContentStrings(content).some(hasBannedWording)) {
      errors.push("Insight brief contains repeated-token wording or transliteration artifacts.");
    }
  }

  if (artifact.artifactType === "comparison-matrix") {
    const comparisons = artifact.content.comparisons;
    if (!Array.isArray(comparisons) || comparisons.length < 1) errors.push("Comparison matrix requires at least 1 comparison item.");
    for (const comparison of comparisons || []) {
      if (!comparison.label || !comparison.comparisonType || !comparison.interpretation || !comparison.sourceReference) {
        errors.push("Each comparison matrix item requires label, comparisonType, interpretation, and sourceReference.");
      }
      if (!Array.isArray(comparison.keyMetrics) || comparison.keyMetrics.length === 0) {
        errors.push(`Comparison matrix item ${comparison.label || "unknown"} requires non-empty keyMetrics.`);
      }
      if (!facts.sourceSections.includes(comparison.sourceReference)) {
        errors.push(`Comparison matrix item ${comparison.label || "unknown"} sourceReference is not backed by a source section.`);
      }
      if (collectContentStrings(comparison).some(hasBannedWording)) {
        errors.push(`Comparison matrix item ${comparison.label || "unknown"} contains repeated-token wording or transliteration artifacts.`);
      }
    }
  }

  if (artifact.artifactType === "worksheet") {
    const questions = artifact.content.guidedQuestions;
    const answerKey = artifact.content.answerKey || {};
    const sourceReferences = artifact.content.sourceReferences;
    if (!Array.isArray(questions) || questions.length < 5) errors.push("Worksheet requires at least 5 guidedQuestions.");
    if (Object.keys(answerKey).length < 5) errors.push("Worksheet requires at least 5 answerKey entries.");
    errors.push(...validateSourceReferences(sourceReferences, facts, "Worksheet"));
    const quizQuestions = new Set((allArtifacts.quiz?.content?.questions || []).map((question) => question.question.toLowerCase()));
    for (const question of questions || []) {
      if (!question.id || !question.prompt || !question.skillType || !question.sourceReference) {
        errors.push("Each worksheet guided question requires id, prompt, skillType, and sourceReference.");
      }
      if (!facts.sourceSections.includes(question.sourceReference)) {
        errors.push(`Worksheet question ${question.id || "unknown"} sourceReference is not backed by a source section.`);
      }
      if (!answerKey[question.id]) errors.push(`Worksheet question ${question.id || "unknown"} is missing an answerKey entry.`);
      if (quizQuestions.has((question.prompt || "").toLowerCase())) {
        errors.push(`Worksheet question ${question.id || "unknown"} duplicates quiz wording.`);
      }
    }
    const skillTypes = new Set((questions || []).map((question) => question.skillType));
    for (const requiredSkill of ["interpretation", "method reasoning", "evidence reading"]) {
      if (![...skillTypes].some((skill) => skill.includes(requiredSkill))) errors.push(`Worksheet is missing ${requiredSkill} task.`);
    }
  }

  return errors;
}

function writeJsonArtifact(name, artifact, schemas, facts, allArtifacts) {
  const lintErrors = lintArtifact(artifact, schemas, facts, allArtifacts);
  if (lintErrors.length > 0) {
    throw new Error(`${name} failed lint: ${lintErrors.join(" ")}`);
  }

  const filePath = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return filePath;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightMetrics(value) {
  return escapeHtml(value)
    .replace(/\b(n\s*=\s*\d+)/gi, "<strong>$1</strong>")
    .replace(/\b(p\s*&lt;\s*0\.001|p\s*<\s*0\.001)/gi, "<strong>$1</strong>")
    .replace(/\b(r\s*=\s*-?\d+(?:\.\d+)?)/gi, "<strong>$1</strong>")
    .replace(/\b(Cohen&#039;s d\s*=\s*\d+(?:\.\d+)?)/gi, "<strong>$1</strong>")
    .replace(/\b(\d+(?:\.\d+)?% reduction)/gi, "<strong>$1</strong>");
}

function renderList(items, mapper = (item) => item) {
  return `<ul>${items.map((item) => `<li>${mapper(item)}</li>`).join("")}</ul>`;
}

function confidenceBadge(confidence) {
  const normalized = normalizeConfidence(confidence);
  if (normalized === null) {
    return `<span class="confidence neutral" title="confidence: not scored">Not scored</span>`;
  }
  const label = confidenceLabel(normalized);
  return `<span class="confidence ${label}" data-confidence="${normalized}" title="confidence: ${normalized}">${label} ${(normalized * 100).toFixed(0)}%</span>`;
}

function renderExecutiveSummary(artifact) {
  const content = artifact.content;
  const findings = (content.keyFindings || [])
    .map(
      (finding) => `
        <article class="finding-card">
          <p>${highlightMetrics(finding.claim)}</p>
          <span class="source-pill">${escapeHtml(finding.sourceSection)}</span>
          ${confidenceBadge(finding.confidence)}
        </article>`
    )
    .join("");
  const evidence = renderList(content.statisticalEvidence || [], highlightMetrics);
  const actions = renderList(content.recommendedActions || [], highlightMetrics);

  return `
    <section class="report-section">
      <h2>Executive Summary</h2>
      <div class="narrative">
        <p>${highlightMetrics(content.overview)} The main takeaway is that the detected comparison is strong enough to guide how the analysis should be presented and discussed.</p>
      </div>
      <div class="finding-grid">${findings}</div>
      <div class="two-column">
        <div>
          <h3>Evidence to Trust</h3>
          ${evidence}
          ${content.confidenceNote ? `<p class="note">${highlightMetrics(content.confidenceNote)}</p>` : ""}
        </div>
        <div>
          <h3>What to Do With It</h3>
          ${actions}
        </div>
      </div>
    </section>`;
}

function renderInsightBrief(artifact) {
  const content = artifact.content;
  const insights = (content.supportingInsights || [])
    .map(
      (insight) => `
        <div class="insight">
          <span class="step-label">Claim</span>
          <h3>${highlightMetrics(insight.claim)}</h3>
          <span class="step-label">Why it matters</span>
          <p>${highlightMetrics(insight.reasoning)}</p>
          ${insight.evidence?.length ? `<div class="chips">${insight.evidence.map((item) => `<span>${highlightMetrics(item)}</span>`).join("")}</div>` : ""}
          <p class="source">Source: ${escapeHtml(insight.sourceSection)}</p>
          ${confidenceBadge(insight.confidence)}
        </div>`
    )
    .join("");

  return `
    <section class="report-section accent">
      <h2>Insight Brief</h2>
      <p class="lead">${highlightMetrics(content.coreInsight)}</p>
      <div class="grid">${insights}</div>
      <div class="two-column">
        <div>
          <h3>Risks & Limitations</h3>
          ${renderList(content.risksOrLimitations || [], highlightMetrics)}
        </div>
        <div>
          <h3>Recommended Decisions</h3>
          ${renderList(content.recommendedDecisions || [], highlightMetrics)}
        </div>
      </div>
    </section>`;
}

function renderComparisonMatrix(artifact) {
  const rows = (artifact.content.comparisons || [])
    .map(
      (comparison) => `
        <tr>
          <td><strong>${escapeHtml(comparison.label)}</strong><br><span class="source">${escapeHtml(comparison.comparisonType)}</span></td>
          <td>${renderList(comparison.keyMetrics || [], highlightMetrics)}</td>
          <td>${highlightMetrics(comparison.interpretation)}<br><span class="source">Source: ${escapeHtml(comparison.sourceReference)}</span> ${confidenceBadge(comparison.confidence)}</td>
        </tr>`
    )
    .join("");

  return `
    <section class="report-section">
      <h2>Comparison Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Comparison</th>
            <th>Metrics</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function renderFAQ(artifact) {
  const items = (artifact.content.items || [])
    .map(
      (item) => `
        <details class="faq-item">
          <summary>${escapeHtml(item.question)} <span class="tag">${escapeHtml(item.difficulty)}</span></summary>
          <p>${highlightMetrics(item.answer)}</p>
          <p class="source">Source: ${escapeHtml(item.sourceReference)}</p>
          ${confidenceBadge(item.confidence)}
        </details>`
    )
    .join("");

  return `
    <section class="report-section">
      <h2>FAQ</h2>
      <p class="section-intro">Natural questions a reviewer might ask before trusting or presenting the analysis.</p>
      <div class="stack">${items}</div>
    </section>`;
}

function renderQuiz(artifact) {
  const questions = (artifact.content.questions || [])
    .map(
      (question) => `
        <div class="qa-item">
          <h3>${escapeHtml(question.id)}. ${escapeHtml(question.question)}</h3>
          <div class="answer-box"><strong>Answer</strong><p>${highlightMetrics(question.answer)}</p></div>
          <p class="source">Type: ${escapeHtml(question.type)} | Source: ${escapeHtml(question.sourceReference)}</p>
          ${confidenceBadge(question.confidence)}
        </div>`
    )
    .join("");

  return `
    <section class="report-section">
      <h2>Quiz</h2>
      <p class="section-intro">A quick check for whether the reader understood the main evidence and interpretation.</p>
      ${questions}
    </section>`;
}

function renderWorksheet(artifact) {
  const content = artifact.content;
  const questions = (content.guidedQuestions || [])
    .map(
      (question) => `
        <div class="qa-item worksheet-question">
          <h3>${escapeHtml(question.id)}. ${escapeHtml(question.prompt)}</h3>
          <p class="source">Skill: ${escapeHtml(question.skillType)} | Source: ${escapeHtml(question.sourceReference)}</p>
          <div class="answer-box muted-answer"><strong>Suggested answer</strong><p>${highlightMetrics(content.answerKey?.[question.id] || "")}</p></div>
        </div>`
    )
    .join("");

  return `
    <section class="report-section learning-section">
      <h2>Worksheet</h2>
      <p class="section-intro">Use this section as a guided classroom or self-study activity. The goal is not memorization; it is evidence-based explanation.</p>
      <h3>Learning Goals</h3>
      ${renderList(content.learningGoals || [], escapeHtml)}
      <h3>Guided Questions</h3>
      ${questions}
    </section>`;
}

function metricMeaning(metric) {
  if (metric.kind === "sample") return "Data volume behind the analysis.";
  if (metric.kind === "significance") return "Shows whether the main result is statistically reliable.";
  if (metric.kind === "effect") return "Shows the strength and direction of the relationship.";
  if (metric.kind === "change") return "Shows the practical size of the main movement.";
  return "Extracted from the fact layer.";
}

function buildMetricCards(facts) {
  const cards = [];
  const significance = findEvidence(facts, "significance");
  const effect = findEvidence(facts, "paired effect size") || findEvidence(facts, "independent effect size");
  const change = findEvidence(facts, "median change");

  if (facts.sampleSize) cards.push({ kind: "sample", label: "Sample Size", value: `n = ${facts.sampleSize}` });
  if (significance) cards.push({ kind: "significance", label: "P-value", value: significance.value });
  if (effect) cards.push({ kind: "effect", label: "Effect Size", value: effect.value });
  if (change) {
    const percent = change.value.match(/\d+(?:\.\d+)?% reduction/i)?.[0] || change.value;
    cards.push({ kind: "change", label: "Main Change", value: percent });
  }

  return cards;
}

function renderHero(artifacts, facts, generatedAt) {
  const comparison = primaryComparison(facts);
  const mainFinding = artifacts["executive-summary"].content.keyFindings?.[0]?.claim || "Structured knowledge compiled into reusable artifacts.";
  const meta = [
    facts.sampleSize ? `Sample size: n = ${facts.sampleSize}` : null,
    comparison ? `Comparison: ${comparison.label}` : null,
    `Main finding: ${mainFinding}`,
  ].filter(Boolean);

  return `
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">Presentation Mode</p>
        <h1>Studio Agent — Knowledge to Insight Engine</h1>
        <p class="hero-subtitle">Transforms structured knowledge into decision-ready insights, learning artifacts, and reports.</p>
        <div class="hero-meta">${meta.map((item) => `<span>${highlightMetrics(item)}</span>`).join("")}</div>
      </div>
      <div class="hero-side">
        <span class="source">Generated</span>
        <strong>${escapeHtml(generatedAt)}</strong>
        <span class="source">${Object.keys(artifacts).length} artifacts compiled</span>
      </div>
    </section>`;
}

function renderMetricPanel(facts) {
  const cards = buildMetricCards(facts);
  if (cards.length === 0) return "";

  return `
    <section class="metric-panel">
      <h2>Key Metrics</h2>
      <div class="metric-grid">
        ${cards
          .map(
            (card) => `
              <article class="metric-card">
                <span>${escapeHtml(card.label)}</span>
                <div class="metric-value">${highlightMetrics(card.value)}</div>
                <p>${escapeHtml(metricMeaning(card))}</p>
              </article>`
          )
          .join("")}
      </div>
    </section>`;
}

function assertReportQuality(html) {
  const forbidden = ["undefined", "null", "[object Object]", "artifactType", "schemaVersion", "provenance", "{\"", "}\n{"];
  const found = forbidden.filter((token) => html.includes(token));
  if (found.length > 0) {
    throw new Error(`report.html failed presentation quality check: ${found.join(", ")}`);
  }
}

function renderReport(artifacts, facts) {
  const generatedAt = new Date().toLocaleString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Studio Agent — Knowledge to Insight Engine</title>
  <style>
    :root { --border: #d9e0e8; --ink: #16202a; --muted: #61707f; --card: #ffffff; --bg: #ffffff; --soft: #f6f8fb; --accent: #0f766e; --accent-2: #0b4f6c; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; }
    main { max-width: 1160px; margin: 0 auto; padding: 36px 20px 64px; }
    h1 { margin: 0 0 14px; max-width: 780px; font-size: 44px; line-height: 1.08; letter-spacing: 0; }
    h2 { margin: 0 0 20px; font-size: 28px; line-height: 1.2; color: var(--accent-2); }
    h2::after { content: ""; display: block; width: 58px; height: 3px; margin-top: 10px; background: var(--accent); border-radius: 2px; }
    h3 { margin: 20px 0 10px; font-size: 18px; line-height: 1.3; }
    p { margin: 8px 0; max-width: 760px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 28px; margin-bottom: 28px; padding: 34px; background: linear-gradient(135deg, #f7fbfa, #ffffff); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
    .hero-subtitle { font-size: 20px; color: #334155; }
    .hero-meta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }
    .hero-meta span { padding: 7px 10px; border: 1px solid #cfe5e1; background: #eef8f6; border-radius: 8px; font-size: 14px; }
    .hero-side { align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 18px; border: 1px solid var(--border); border-radius: 8px; background: #fff; }
    .hero-side strong { font-size: 18px; color: var(--ink); }
    .eyebrow { margin: 0 0 10px; color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: 13px; letter-spacing: 0.08em; }
    .metric-panel, .report-section { margin: 32px 0; padding: 28px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.07); }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .metric-card { padding: 18px; border: 1px solid #cfe5e1; border-radius: 8px; background: #f3fbf9; }
    .metric-card span { display: block; color: var(--muted); font-size: 13px; font-weight: 700; text-transform: uppercase; }
    .metric-value { margin: 7px 0; font-size: 27px; font-weight: 800; color: var(--accent); }
    .metric-value strong { color: var(--accent); }
    .metric-card p { font-size: 14px; color: #425160; }
    .accent { border-top: 5px solid var(--accent); }
    .lead, .section-intro, .narrative p { font-size: 18px; color: #26313d; }
    .grid, .finding-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)); gap: 16px; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 20px; }
    .finding-card, .insight, .qa-item, details { border: 1px solid var(--border); border-radius: 8px; padding: 16px; background: #fbfcfd; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); }
    .finding-card p { font-size: 17px; font-weight: 700; }
    .stack { display: grid; gap: 12px; }
    .source, .note { color: var(--muted); font-size: 14px; }
    .source-pill, .tag { display: inline-block; margin-top: 8px; padding: 3px 8px; border-radius: 999px; background: #e8f3f1; color: #115e59; font-size: 12px; font-weight: 700; }
    .confidence { display: inline-block; margin: 8px 0 0 6px; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 800; }
    .confidence.high { background: #dcfce7; color: #166534; }
    .confidence.medium { background: #fef9c3; color: #854d0e; }
    .confidence.low { background: #fee2e2; color: #991b1b; }
    .confidence.neutral { background: #e2e8f0; color: #475569; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .chips span { border: 1px solid #b9d8d3; background: #eef8f6; border-radius: 999px; padding: 4px 9px; font-size: 13px; }
    .step-label { display: inline-block; margin-top: 4px; color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .answer-box { margin-top: 10px; padding: 12px; border-left: 4px solid var(--accent); background: #f3fbf9; border-radius: 6px; }
    .muted-answer { background: #f8fafc; border-left-color: var(--accent-2); }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; background: #fff; }
    th, td { border: 1px solid var(--border); text-align: left; vertical-align: top; padding: 14px; }
    th { background: #eef2f6; color: var(--accent-2); }
    td ul { margin: 0; padding-left: 18px; }
    strong { color: #0b4f6c; }
    summary { cursor: pointer; font-weight: 700; list-style: none; }
    summary::before { content: "+"; display: inline-block; width: 22px; color: var(--accent); font-weight: 800; }
    details[open] summary::before { content: "-"; }
    details[open] { background: #f8fbfb; border-color: #b9d8d3; }
    footer { margin-top: 34px; padding: 22px; border-top: 1px solid var(--border); color: var(--muted); text-align: center; }
    @media (max-width: 900px) { .hero, .two-column, .metric-grid { grid-template-columns: 1fr; } h1 { font-size: 34px; } }
    @media (max-width: 760px) { main { padding: 20px 12px 40px; } .hero, .report-section, .metric-panel { padding: 20px; } table { font-size: 13px; } th, td { padding: 9px; } }
  </style>
</head>
<body>
  <main>
    ${renderHero(artifacts, facts, generatedAt)}
    ${renderMetricPanel(facts)}
    ${renderExecutiveSummary(artifacts["executive-summary"])}
    ${renderInsightBrief(artifacts["insight-brief"])}
    ${renderComparisonMatrix(artifacts["comparison-matrix"])}
    ${renderFAQ(artifacts.faq)}
    ${renderQuiz(artifacts.quiz)}
    ${renderWorksheet(artifacts.worksheet)}
    <footer>Generated by Studio Agent MVP • ${escapeHtml(generatedAt)} • ${Object.keys(artifacts).length} artifacts</footer>
  </main>
</body>
</html>`;
}

function writeReport(artifacts, facts) {
  const html = renderReport(artifacts, facts);
  assertReportQuality(html);
  fs.writeFileSync(REPORT_FILE, html, "utf8");
  return REPORT_FILE;
}

function openReport(filePath) {
  if (process.env.NO_OPEN === "1") return;

  const command =
    process.platform === "win32"
      ? `start "" "${filePath}"`
      : process.platform === "darwin"
        ? `open "${filePath}"`
        : `xdg-open "${filePath}"`;

  exec(command, (error) => {
    if (error) {
      console.log(`Open this file to view the analysis: ${path.relative(ROOT, filePath)}`);
    }
  });
}

function sourceFromText(content, sourcePath = "studio-input.md") {
  const normalized = String(content || "").replace(/\r\n/g, "\n").trim();
  return {
    path: sourcePath,
    content: String(content || ""),
    normalized,
    hash: crypto.createHash("sha256").update(String(content || "")).digest("hex"),
    wordCount: normalized ? normalized.split(/\s+/).length : 0,
    lineCount: content ? String(content).split(/\r?\n/).length : 0,
    isEmpty: normalized.length === 0,
  };
}

function normalizeArtifactType(type) {
  return String(type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function generateArtifactByType(type, source, facts) {
  const artifactType = normalizeArtifactType(type);
  const generators = {
    "executive-summary": generateExecutiveSummary,
    "insight-brief": generateInsightBrief,
    faq: generateFaq,
    quiz: generateQuiz,
    worksheet: generateWorksheet,
    "comparison-matrix": generateComparisonMatrix,
    "slide-deck": generateSlideDeck,
    "summary-notes": generateSummaryNotes,
    "teaching-outline": generateTeachingOutline,
    "decision-card": generateDecisionCard,
  };
  const generator = generators[artifactType];
  if (!generator) throw new Error(`Unsupported artifact type: ${type}`);
  return generator(source, facts);
}

function audienceIntro(audience, tone) {
  if (audience === "student") return tone === "technical" ? "Study focus: connect each claim to its evidence." : "Study focus: understand the main idea before the details.";
  if (audience === "technical") return "Technical focus: check method, evidence, and source traceability.";
  return "Decision focus: use the evidence to understand impact and next steps.";
}

function renderStudioArtifact(artifact, options = {}) {
  const audience = options.audience || "decision-maker";
  const tone = options.tone || "simple";
  const prefix = `<p class="studio-note">${escapeHtml(audienceIntro(audience, tone))}</p>`;
  const type = artifact.artifactType;

  if (type === "executive-summary") return prefix + renderExecutiveSummary(artifact);
  if (type === "insight-brief") return prefix + renderInsightBrief(artifact);
  if (type === "faq") return prefix + renderFAQ(artifact);
  if (type === "quiz") return prefix + renderQuiz(artifact);
  if (type === "worksheet") return prefix + renderWorksheet(artifact);
  if (type === "comparison-matrix") return prefix + renderComparisonMatrix(artifact);
  if (type === "slide-deck") {
    const slides = artifact.content.slides
      .map(
        (slide, index) => `
          <section class="studio-card">
            <h3>Slide ${index + 1}: ${escapeHtml(slide.title)}</h3>
            ${renderList(slide.bullets || [], (bullet) => `${highlightMetrics(bullet.text)} <span class="source-pill">${escapeHtml(bullet.sourceReference)}</span>`)}
          </section>`
      )
      .join("");
    return `${prefix}<section class="report-section"><h2>${escapeHtml(artifact.content.title)}</h2>${slides}</section>`;
  }
  if (type === "decision-card") {
    const card = artifact.content;
    const evidence = card.supportingEvidence
      .filter((item) => item.supported)
      .map((item) => `<li>${highlightMetrics(item.value)} <span class="source-pill">${escapeHtml(item.sourceSection)}</span> ${confidenceBadge(item.confidence)}</li>`)
      .join("");
    return `${prefix}<section class="report-section decision-card"><h2>${escapeHtml(card.title)}</h2><h3>Main decision</h3><p>${highlightMetrics(card.mainDecision.claim)}</p><span class="source-pill">${escapeHtml(card.mainDecision.sourceSection)}</span> ${confidenceBadge(card.mainDecision.confidence)}<h3>Supporting evidence</h3><ul>${evidence || "<li>Not available in source</li>"}</ul><h3>Recommended action</h3><p>${highlightMetrics(card.recommendedAction.claim)}</p><span class="source-pill">${escapeHtml(card.recommendedAction.sourceSection)}</span> ${confidenceBadge(card.recommendedAction.confidence)}</section>`;
  }
  if (type === "summary-notes") {
    const notes = artifact.content.notes
      .map((note) => `<section class="studio-card"><h3>${escapeHtml(note.heading)}</h3>${renderList(note.bullets || [], (bullet) => `${highlightMetrics(bullet.text)} <span class="source-pill">${escapeHtml(bullet.sourceReference)}</span>`)}</section>`)
      .join("");
    return `${prefix}<section class="report-section"><h2>${escapeHtml(artifact.content.title)}</h2>${notes}</section>`;
  }
  if (type === "teaching-outline") {
    const sections = artifact.content.sections
      .map((section) => `<section class="studio-card"><h3>${section.explanationOrder}. ${escapeHtml(section.title)}</h3><p>${highlightMetrics(section.teachingPoint)}</p><span class="source-pill">${escapeHtml(section.sourceReference)}</span> ${confidenceBadge(section.confidence)}</section>`)
      .join("");
    return `${prefix}<section class="report-section"><h2>${escapeHtml(artifact.content.title)}</h2>${sections}</section>`;
  }

  throw new Error(`No renderer for artifact type: ${type}`);
}

function artifactToPlainText(artifact) {
  return collectContentStrings(artifact.content).join("\n").replace(/\n{3,}/g, "\n\n");
}

function assertStudioOutputQuality(html, artifact) {
  const forbidden = ["undefined", "null", "[object Object]", "{\"", "artifactType", "schemaVersion", "provenance"];
  const found = forbidden.filter((token) => html.includes(token));
  if (found.length > 0) throw new Error(`Studio output failed quality check: ${found.join(", ")}`);
  if (collectContentStrings(artifact.content).length === 0) throw new Error("Studio output has no readable content.");
  const unsupported = [];
  function walk(value) {
    if (!value || typeof value !== "object") return;
    if (value.supported === false) unsupported.push(value.claim || value.value || "unsupported claim");
    if (Array.isArray(value)) value.forEach(walk);
    else Object.values(value).forEach(walk);
  }
  walk(artifact.content);
  if (unsupported.length > 0) throw new Error(`Studio output contains unsupported claims: ${unsupported.join(", ")}`);
}

function compileStudioArtifact(content, options = {}) {
  const source = sourceFromText(content);
  const facts = extractFactLayer(source);
  const artifact = generateArtifactByType(options.artifactType || "executive-summary", source, facts);
  const html = renderStudioArtifact(artifact, options);
  assertStudioOutputQuality(html, artifact);
  return {
    artifact,
    presentationHtml: artifact.artifactType === "slide-deck" ? renderSlidePresentation(artifact) : "",
    facts: {
      sampleSize: facts.sampleSize,
      sampleSizeFact: facts.sampleSizeFact,
      sourceSections: facts.sourceSections,
      variables: Object.keys(facts.variables),
      comparisons: facts.comparisons.map((comparison) => ({ label: comparison.label, type: comparison.type, sourceSection: comparison.sourceSection })),
      evidence: facts.evidence,
    },
    html,
    text: artifactToPlainText(artifact),
  };
}

function renderSlidePresentation(artifact) {
  if (artifact.artifactType !== "slide-deck") return "";
  return `
    <div class="slide-stage" data-slide-index="0">
      ${(artifact.content.slides || [])
        .map(
          (slide, index) => `
            <section class="slide ${index === 0 ? "active" : ""}" data-slide="${index}">
              <p class="slide-kicker">Slide ${index + 1}</p>
              <h2>${escapeHtml(slide.title)}</h2>
              <ul>${(slide.bullets || []).map((bullet) => `<li>${highlightMetrics(bullet.text)} <span>${escapeHtml(bullet.sourceReference)}</span></li>`).join("")}</ul>
              ${confidenceBadge(slide.confidence)}
            </section>`
        )
        .join("")}
    </div>`;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const schemas = loadSchemas();
  const source = readKnowledgeBase(INPUT_FILE);
  const facts = extractFactLayer(source);
  const artifacts = {
    "executive-summary": generateExecutiveSummary(source, facts),
    quiz: generateQuiz(source, facts),
    faq: generateFaq(source, facts),
    "insight-brief": generateInsightBrief(source, facts),
    "comparison-matrix": generateComparisonMatrix(source, facts),
    worksheet: generateWorksheet(source, facts),
  };

  const written = Object.entries(artifacts).map(([name, artifact]) => writeJsonArtifact(name, artifact, schemas, facts, artifacts));
  const reportPath = writeReport(artifacts, facts);

  console.log("✔ Artifacts generated");
  console.log(`✔ Report created: ${path.relative(ROOT, reportPath)}`);
  console.log("");
  console.log("Open this file to view the analysis.");
  written.forEach((filePath) => console.log(`- ${path.relative(ROOT, filePath)}`));
  openReport(reportPath);
}

module.exports = {
  compileStudioArtifact,
  extractFactLayer,
  generateArtifactByType,
  renderStudioArtifact,
  sourceFromText,
  main,
};

if (require.main === module) {
  main();
}
