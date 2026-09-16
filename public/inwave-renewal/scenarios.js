// Existing platform demonstration scenarios, preserved from public/index.html.
// These are illustrative scenarios, not live advertising results.
export const platformScenarios = [
  {
    label: "출근 시간대 시청 흐름 분석",
    kpis: {
      visitors: 37203,
      viewers: 1477,
      dwell: "4.8s",
      attention: "58%",
    },
    bars: [
      { label: "20대", value: 82 },
      { label: "30대", value: 96 },
      { label: "40대", value: 61 },
      { label: "50대", value: 34 },
      { label: "60대", value: 24 },
      { label: "70대+", value: 12 },
    ],
    heatmap: [
      1, 2, 2, 3, 4, 3, 1, 1, 2, 3, 3, 2, 0, 1, 2, 2, 3, 2, 0, 1, 1, 2, 2, 1, 0,
      1, 2, 3, 4, 3, 1, 2, 2, 3, 3, 2,
    ],
    audiencePattern: {
      hours: [8, 10, 12, 14, 16, 18, 20],
      density: [70, 110, 160, 175, 150, 120, 80],
      maleRatio: 0.35,
      femaleRatio: 0.65,
      ageRange: { min: 10, max: 75 },
    },
    dwell: [
      { label: "Pass", value: 42, highlight: false },
      { label: "Short", value: 68, highlight: false },
      { label: "Engaged", value: 84, highlight: true },
      { label: "Deep", value: 51, highlight: true },
    ],
  },
  {
    label: "점심 시간대 광고 반응 분석",
    kpis: {
      visitors: 45594,
      viewers: 15721,
      dwell: "6.1s",
      attention: "63%",
    },
    bars: [
      { label: "20대", value: 76 },
      { label: "30대", value: 88 },
      { label: "40대", value: 71 },
      { label: "50대", value: 42 },
      { label: "60대", value: 28 },
      { label: "70대+", value: 15 },
    ],
    heatmap: [
      0, 1, 2, 2, 3, 2, 1, 2, 3, 4, 4, 3, 1, 2, 3, 4, 3, 2, 1, 1, 2, 3, 2, 1, 0,
      1, 2, 4, 4, 3, 1, 2, 2, 3, 2, 1,
    ],
    audiencePattern: {
      hours: [8, 10, 12, 14, 16, 18, 20],
      density: [45, 85, 170, 185, 160, 105, 60],
      maleRatio: 0.42,
      femaleRatio: 0.58,
      ageRange: { min: 12, max: 72 },
    },
    dwell: [
      { label: "Pass", value: 26, highlight: false },
      { label: "Short", value: 54, highlight: false },
      { label: "Engaged", value: 91, highlight: true },
      { label: "Deep", value: 67, highlight: true },
    ],
  },
  {
    label: "퇴근 시간대 고관심 시청 흐름",
    kpis: {
      visitors: 51248,
      viewers: 18394,
      dwell: "7.4s",
      attention: "71%",
    },
    bars: [
      { label: "20대", value: 66 },
      { label: "30대", value: 94 },
      { label: "40대", value: 77 },
      { label: "50대", value: 46 },
      { label: "60대", value: 31 },
      { label: "70대+", value: 17 },
    ],
    heatmap: [
      1, 1, 2, 3, 4, 4, 1, 2, 3, 3, 4, 4, 0, 1, 2, 3, 4, 3, 0, 1, 1, 2, 3, 3, 1,
      2, 3, 4, 4, 4, 1, 2, 2, 3, 4, 3,
    ],
    audiencePattern: {
      hours: [8, 10, 12, 14, 16, 18, 20],
      density: [30, 60, 95, 135, 175, 190, 130],
      maleRatio: 0.48,
      femaleRatio: 0.52,
      ageRange: { min: 15, max: 70 },
    },
    dwell: [
      { label: "Pass", value: 18, highlight: false },
      { label: "Short", value: 40, highlight: false },
      { label: "Engaged", value: 86, highlight: true },
      { label: "Deep", value: 82, highlight: true },
    ],
  },
  {
    label: "주말 시간대 가족 단위 반응 분석",
    kpis: {
      visitors: 28974,
      viewers: 9342,
      dwell: "5.9s",
      attention: "66%",
    },
    bars: [
      { label: "20대", value: 58 },
      { label: "30대", value: 74 },
      { label: "40대", value: 82 },
      { label: "50대", value: 49 },
      { label: "60대", value: 35 },
      { label: "70대+", value: 21 },
    ],
    heatmap: [
      0, 1, 1, 2, 3, 2, 0, 1, 2, 2, 3, 2, 1, 2, 3, 3, 4, 3, 1, 2, 3, 4, 4, 3, 1,
      1, 2, 3, 3, 2, 1, 2, 3, 4, 3, 2,
    ],
    audiencePattern: {
      hours: [8, 10, 12, 14, 16, 18, 20],
      density: [40, 70, 120, 155, 145, 95, 55],
      maleRatio: 0.4,
      femaleRatio: 0.6,
      ageRange: { min: 10, max: 76 },
    },
    dwell: [
      { label: "Pass", value: 24, highlight: false },
      { label: "Short", value: 48, highlight: false },
      { label: "Engaged", value: 73, highlight: true },
      { label: "Deep", value: 58, highlight: true },
    ],
  },
];
