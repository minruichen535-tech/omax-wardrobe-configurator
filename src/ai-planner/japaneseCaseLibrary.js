const DEMAND_KEYS = [
  "longClothes",
  "shortClothes",
  "shoes",
  "bags",
  "jewelry",
  "trousers",
  "luggage",
  "bedding"
];

const CASE_PROFILES = [
  ["1人", "low",  [4, 3, 1, 1, 0, 1, 0, 1]],
  ["1人", "low",  [2, 5, 2, 1, 0, 2, 0, 1]],
  ["1人", "mid",  [4, 4, 1, 3, 2, 2, 1, 1]],
  ["1人", "mid",  [2, 4, 3, 2, 1, 4, 1, 1]],
  ["2人", "low",  [4, 4, 2, 2, 0, 2, 1, 2]],
  ["2人", "mid",  [5, 4, 2, 3, 1, 3, 1, 2]],
  ["2人", "mid",  [3, 5, 4, 2, 1, 3, 1, 2]],
  ["2人", "high", [5, 5, 3, 4, 3, 4, 2, 2]],
  ["3人", "low",  [4, 5, 3, 2, 0, 3, 2, 3]],
  ["3人", "mid",  [5, 5, 3, 3, 1, 4, 2, 3]],
  ["3人", "mid",  [3, 5, 5, 3, 1, 3, 2, 3]],
  ["3人", "high", [5, 5, 4, 4, 3, 4, 3, 3]],
  ["4人以上", "low",  [4, 5, 4, 2, 0, 3, 3, 4]],
  ["4人以上", "mid",  [5, 5, 4, 3, 1, 4, 3, 4]],
  ["4人以上", "high", [5, 5, 5, 4, 2, 4, 4, 4]],
  ["4人以上", "high", [4, 5, 4, 5, 3, 5, 4, 5]]
];

export const japaneseCaseLibrary = CASE_PROFILES.map(([people, budgetTier, values], index) => {
  const caseId = `JP-MC-${String(index + 1).padStart(3, "0")}`;
  const demandProfile = Object.fromEntries(DEMAND_KEYS.map((key, valueIndex) => [key, values[valueIndex]]));
  demandProfile.pants = demandProfile.trousers;
  return {
    caseId,
    modelPath: `/customer-home/case/${caseId}.glb`,
    people,
    tags: [people, budgetTier, ...topDemandKeys(demandProfile, 2)],
    demandProfile,
    layoutPreference: index % 5 === 4 ? "L型" : "I型",
    layoutTemplate: buildCaseLayoutTemplate(demandProfile),
    budgetTier
  };
});

function buildCaseLayoutTemplate(profile) {
  const template = [];
  if (Number(profile.shortClothes) > 0) {
    template.push({ zone: "shortHangZone", components: ["singleRail", "singleRail"] });
  }
  if (Number(profile.longClothes) > 0) {
    template.push({ zone: "longHangZone", components: ["singleRail"] });
  }
  if (Number(profile.shoes) > 0) {
    template.push({ zone: "shoeZone", components: ["woodShelf", "woodShelf", "woodShelf"] });
  }
  if (Number(profile.bags) > 0 || Number(profile.bedding) > 0) {
    template.push({ zone: "storageZone", components: ["cabinet", "woodShelf", "woodShelf"] });
  }
  const accessories = [
    ...(Number(profile.trousers ?? profile.pants) > 0 ? ["trouserRack"] : []),
    ...(Number(profile.jewelry) > 0 ? ["jewelryBox"] : [])
  ];
  if (accessories.length) template.push({ zone: "accessoryZone", components: accessories });
  if (Number(profile.luggage) > 0) {
    template.push({ zone: "luggageZone", components: ["singleRail"] });
  }
  return template;
}

const MATCH_WEIGHTS = {
  people: 3,
  budgetTier: 2,
  longClothes: 2,
  shortClothes: 2,
  shoes: 1.5,
  bags: 1,
  jewelry: 1,
  trousers: 1.5,
  luggage: 1,
  bedding: 1
};

export function findSimilarJapaneseCases(answers = {}, limit = 3) {
  const input = normalizeCaseAnswers(answers);
  return japaneseCaseLibrary
    .map((caseData) => scoreCase(caseData, input))
    .sort((left, right) => right.score - left.score || left.caseId.localeCompare(right.caseId))
    .slice(0, Math.max(0, Number(limit) || 0));
}

export function getJapaneseCaseDistributionTarget(caseData = {}) {
  const profile = caseData.demandProfile || {};
  const rawTarget = {
    longHangZone: Number(profile.longClothes) || 0,
    shortHangZone: Number(profile.shortClothes) || 0,
    shoeZone: Number(profile.shoes) || 0,
    storageZone: (Number(profile.bags) || 0) + (Number(profile.bedding) || 0),
    jewelryZone: Number(profile.jewelry) || 0,
    trouserZone: Number(profile.trousers ?? profile.pants) || 0,
    luggageZone: Number(profile.luggage) || 0
  };
  const total = Object.values(rawTarget).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(rawTarget).map(([zoneType, value]) => [
    zoneType,
    round(value / total)
  ]));
}

function scoreCase(caseData, input) {
  let weightedScore = input.people === caseData.people ? MATCH_WEIGHTS.people : 0;
  let totalWeight = MATCH_WEIGHTS.people;
  const reasons = [];
  if (input.people === caseData.people) reasons.push(`people=${caseData.people}`);

  totalWeight += MATCH_WEIGHTS.budgetTier;
  if (input.budgetTier === caseData.budgetTier) {
    weightedScore += MATCH_WEIGHTS.budgetTier;
    reasons.push(`budgetTier=${caseData.budgetTier}`);
  }

  DEMAND_KEYS.forEach((key) => {
    const weight = MATCH_WEIGHTS[key];
    const similarity = 1 - Math.min(5, Math.abs(input.demandProfile[key] - caseData.demandProfile[key])) / 5;
    weightedScore += similarity * weight;
    totalWeight += weight;
  });

  topDemandKeys(input.demandProfile, 3).forEach((key) => {
    if (caseData.demandProfile[key] >= 3) reasons.push(`${key}=${caseData.demandProfile[key]}`);
  });

  return {
    ...caseData,
    score: round(weightedScore / totalWeight * 100),
    matchedReason: reasons.join(", ") || "demandProfile proximity"
  };
}

function normalizeCaseAnswers(answers) {
  const source = answers.needs
    || (answers.demands && !Array.isArray(answers.demands) ? answers.demands : null)
    || answers.demandsWeights
    || answers.needWeights
    || {};
  return {
    people: normalizePeople(answers.people || answers.peopleCount),
    budgetTier: normalizeBudgetTier(answers.budgetTier || answers.budget || answers.budgetRange),
    demandProfile: {
      longClothes: demandValue(source, answers, "longClothes", "长衣"),
      shortClothes: demandValue(source, answers, "shortClothes", "短衣"),
      shoes: demandValue(source, answers, "shoes", "鞋子"),
      bags: demandValue(source, answers, "bags", "包包"),
      jewelry: demandValue(source, answers, "jewelry", "首饰"),
      trousers: demandValue(source, answers, "trousers", "裤子"),
      luggage: demandValue(source, answers, "luggage", "行李箱"),
      bedding: demandValue(source, answers, "bedding", "被褥")
    }
  };
}

function demandValue(source, answers, englishKey, chineseKey) {
  const value = source[englishKey] ?? source[chineseKey] ?? answers[englishKey] ?? answers[chineseKey] ?? 0;
  return Math.max(0, Math.min(5, Number(value) || 0));
}

function normalizePeople(value) {
  const count = Number.parseInt(value, 10);
  if (count >= 4) return "4人以上";
  return count > 0 ? `${count}人` : "1人";
}

function normalizeBudgetTier(value) {
  if (["low", "mid", "high"].includes(value)) return value;
  const numbers = String(value || "").match(/[\d,]+/g)?.map((item) => Number(item.replaceAll(",", ""))) || [];
  const upper = numbers[numbers.length - 1] || 12000;
  if (upper <= 6000) return "low";
  if (upper <= 12000) return "mid";
  return "high";
}

function topDemandKeys(profile, limit) {
  return Object.entries(profile)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
