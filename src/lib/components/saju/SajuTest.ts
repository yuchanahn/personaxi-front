import solTermsData from './solterms_1900-2100.json';

export interface Gan { // 천간(天干)
  name: string;
  symbol: '목' | '화' | '토' | '금' | '수';
  sign: '양' | '음';
  key: number;
  code: string;
  color: string;
}
export interface Ji { // 지지(地支)
  name: string;
  symbol: '목' | '화' | '토' | '금' | '수';
  sign: '양' | '음';
  key: number;
  code: string;
  color: string;
  innerAttri: string;
}
export interface Pillar {
  sky: Gan;
  ground: Ji;
}
export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  time: Pillar;
}
// ==================================
// 핵심 데이터 (from data.js)
// ==================================
const SKY: Gan[] = [
  { name: "갑", symbol: "목", sign: "양", key: 1, code: "甲", color: "green" },
  { name: "을", symbol: "목", sign: "음", key: 2, code: "乙", color: "green" },
  { name: "병", symbol: "화", sign: "양", key: 3, code: "丙", color: "red" },
  { name: "정", symbol: "화", sign: "음", key: 4, code: "丁", color: "red" },
  { name: "무", symbol: "토", sign: "양", key: 5, code: "戊", color: "yellow" },
  { name: "기", symbol: "토", sign: "음", key: 6, code: "己", color: "yellow" },
  { name: "경", symbol: "금", sign: "양", key: 7, code: "庚", color: "white" },
  { name: "신", symbol: "금", sign: "음", key: 8, code: "辛", color: "white" },
  { name: "임", symbol: "수", sign: "양", key: 9, code: "壬", color: "black" },
  { name: "계", symbol: "수", sign: "음", key: 10, code: "癸", color: "black" }
];
const GROUND: Ji[] = [
  { name: "자", symbol: "수", sign: "음", key: 11, code: "子", color: "black", innerAttri: "899" },
  { name: "축", symbol: "토", sign: "음", key: 12, code: "丑", color: "yellow", innerAttri: "975" },
  { name: "인", symbol: "목", sign: "양", key: 13, code: "寅", color: "green", innerAttri: "420" },
  { name: "묘", symbol: "목", sign: "음", key: 14, code: "卯", color: "green", innerAttri: "011" },
  { name: "진", symbol: "토", sign: "양", key: 15, code: "辰", color: "yellow", innerAttri: "194" },
  { name: "사", symbol: "화", sign: "양", key: 16, code: "巳", color: "red", innerAttri: "462" },
  { name: "오", symbol: "화", sign: "음", key: 17, code: "午", color: "red", innerAttri: "253" },
  { name: "미", symbol: "토", sign: "음", key: 18, code: "未", color: "yellow", innerAttri: "315" },
  { name: "신", symbol: "금", sign: "양", key: 19, code: "申", color: "white", innerAttri: "486" },
  { name: "유", symbol: "금", sign: "음", key: 20, code: "酉", color: "white", innerAttri: "677" },
  { name: "술", symbol: "토", sign: "양", key: 21, code: "戌", color: "yellow", innerAttri: "734" },
  { name: "해", symbol: "수", sign: "양", key: 22, code: "亥", color: "black", innerAttri: "408" },
];

// [기존] 부정확한 날짜 배열 (Fallback 용으로만 사용)
const SOLAR_TERM_DATES = [6, 4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7];

interface LoadedSolarTerm {
  Name: string;
  Year: number;
  Month: number;
  Day: number;
  Hour: number;
  Minute: number;
}

type SolarTermsByYear = Record<string, LoadedSolarTerm[]>;
const loadedTerms: SolarTermsByYear = solTermsData;

function getSolarTerm(year: number, month: number): LoadedSolarTerm {
  const approxDay = SOLAR_TERM_DATES[month] || 5;

  if (loadedTerms === null) {
    return { Name: "", Year: year, Month: month, Day: approxDay, Hour: 12, Minute: 0 };
  }

  const yearData = loadedTerms[year.toString()];
  if (!yearData) {
    console.warn(`[getSolarTerm] No data for year ${year}. Using approximation.`);
    return { Name: "", Year: year, Month: month, Day: approxDay, Hour: 12, Minute: 0 };
  }

  const preciseDataFix = loadedTerms[year.toString()].find(
    st => st.Year === year && st.Month === month
  );
  if (preciseDataFix) {
    return { ...preciseDataFix, Month: preciseDataFix.Month };
  }

  return { Name: "", Year: year, Month: month, Day: approxDay, Hour: 12, Minute: 0 };
}


function getYearSky(year: number): Gan {
  const yearSkyCal = year % 10;
  const yearSky = yearSkyCal + 6 < 10 ? yearSkyCal + 6 : yearSkyCal + 6 - 10;
  return SKY[yearSky];
}
function getYearGround(year: number): Ji {
  const yearGroundCal = year % 12;
  const yearGround = yearGroundCal + 8 < 12 ? yearGroundCal + 8 : yearGroundCal + 8 - 12;
  return GROUND[yearGround];
}

function getMonthSky(
  sajuYear: number,
  solarYear: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Gan {
  const yearSky = getYearSky(sajuYear);
  let monthSkyCal: number;

  switch (yearSky.name) {
    case "갑": case "기": monthSkyCal = 2; break;
    case "을": case "경": monthSkyCal = 4; break;
    case "병": case "신": monthSkyCal = 6; break;
    case "정": case "임": monthSkyCal = 8; break;
    case "무": case "계": monthSkyCal = 0; break;
    default: monthSkyCal = 0;
  }

  const solarTermCompare = getSolarTerm(solarYear, month); // month는 0-11

  const birthDate = new Date(solarYear, month, day, hour, minute);
  const solarTermDate = new Date(
    solarTermCompare.Year,
    solarTermCompare.Month, // getSolarTerm에서 0-11로 변환됨
    solarTermCompare.Day,
    solarTermCompare.Hour,
    solarTermCompare.Minute
  );

  let currentMonth = month;
  if (birthDate.getTime() < solarTermDate.getTime()) {
    currentMonth = (month - 1 + 12) % 12;
  }

  const monthGroundIndex = (currentMonth + 1) % 12;
  const actualMonthGroundIndex = GROUND.findIndex(g => g.name === GROUND[monthGroundIndex].name);
  const monthOrder = (actualMonthGroundIndex - 2 + 12) % 12;
  const monthSkyIndex = (monthSkyCal + monthOrder) % 10;

  return SKY[monthSkyIndex];
}

function getMonthGround(
  month: number,
  day: number,
  hour: number,
  minute: number,
  year: number
): Ji {
  const solarTerm = getSolarTerm(year, month);

  const birthDate = new Date(year, month, day, hour, minute);
  const solarTermDate = new Date(
    solarTerm.Year,
    solarTerm.Month,
    solarTerm.Day,
    solarTerm.Hour,
    solarTerm.Minute
  );

  let currentMonth = month;
  if (birthDate.getTime() < solarTermDate.getTime()) {
    currentMonth = (currentMonth - 1 + 12) % 12;
  }

  const groundIndex = (currentMonth + 1) % 12;
  return GROUND[groundIndex];
}

function getDaySky(year: number, month: number, day: number): Gan {
  const standard = new Date(1925, 0, 10);
  const target = new Date(year, month, day);
  const diffTime = target.getTime() - standard.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  let daySkyIndex = diffDays % 10;
  if (daySkyIndex < 0) {
    daySkyIndex += 10;
  }
  return SKY[daySkyIndex];
}
function getDayGround(year: number, month: number, day: number): Ji {
  const standard = new Date(1925, 0, 4);
  const target = new Date(year, month, day);
  const diffTime = target.getTime() - standard.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  let dayGroundIndex = diffDays % 12;
  if (dayGroundIndex < 0) {
    dayGroundIndex += 12;
  }
  return GROUND[dayGroundIndex];
}
function getTimePillar(daySky: Gan, hour: number, minute: number): Pillar {
  let timeSkyCal: number;
  switch (daySky.name) {
    case "갑": case "기": timeSkyCal = 0; break;
    case "을": case "경": timeSkyCal = 2; break;
    case "병": case "신": timeSkyCal = 4; break;
    case "정": case "임": timeSkyCal = 6; break;
    case "무": case "계": timeSkyCal = 8; break;
    default: timeSkyCal = 0;
  }
  let groundIndex: number;
  if (hour >= 23 || hour < 1) {
    groundIndex = 0;
  } else {
    groundIndex = Math.floor((hour + 1) / 2);
  }
  const timeSkyIndex = (timeSkyCal + groundIndex) % 10;
  return {
    sky: SKY[timeSkyIndex],
    ground: GROUND[groundIndex]
  };
}

export function calculateFourPillars(
  birthDate: Date,
  hour: number,
  minute: number
): FourPillars {
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth();
  const day = birthDate.getDate();

  const standardTime = new Date(year, month, day, hour, minute);
  const solarTime = new Date(standardTime.getTime() - (30 * 60000));

  const solarYear = solarTime.getFullYear();
  const solarMonth = solarTime.getMonth();
  const solarDay = solarTime.getDate();
  const solarHour = solarTime.getHours();
  const solarMinute = solarTime.getMinutes();

  let sajuYear = solarYear;
  const ipchun = getSolarTerm(solarYear, 1); // 1 = 2월 (입춘)
  const ipchunDate = new Date(
    ipchun.Year,
    ipchun.Month, // 0-11
    ipchun.Day,
    ipchun.Hour,
    ipchun.Minute
  );

  if (solarTime.getTime() < ipchunDate.getTime()) {
    sajuYear = solarYear - 1;
  }

  const yearSky = getYearSky(sajuYear);
  const yearGround = getYearGround(sajuYear);

  const monthSky = getMonthSky(
    sajuYear,
    solarYear,
    solarMonth,
    solarDay,
    solarHour,
    solarMinute
  );
  const monthGround = getMonthGround(
    solarMonth,
    solarDay,
    solarHour,
    solarMinute,
    solarYear
  );

  const daySky = getDaySky(solarYear, solarMonth, solarDay);
  const dayGround = getDayGround(solarYear, solarMonth, solarDay);

  const timePillar = getTimePillar(daySky, solarHour, solarMinute);

  return {
    year: { sky: yearSky, ground: yearGround },
    month: { sky: monthSky, ground: monthGround },
    day: { sky: daySky, ground: dayGround },
    time: timePillar,
  };
}


// ==================================
// 1. 계산 결과 인터페이스
// ==================================
export interface SibsinMap {
  year: { sky: string, ground: string, jijanggan: string[] };
  month: { sky: string, ground: string, jijanggan: string[] };
  day: { ground: string, jijanggan: string[] };
  time: { sky: string, ground: string, jijanggan: string[] };
}
export interface DaeunData {
  su: number;
  cycles: {
    age: number;
    pillar: Pillar;
  }[];
  direction: '순행' | '역행';
}
export interface StrengthData {
  score: number;
  result: '신강' | '신약' | '중화';
  deukRyeong: boolean;
  deukJi: boolean;
  deukSe: boolean;
}
export interface HapChungData {
  ganHap: string[];
  jiHap: string[];
  jiSamhap: string[];
  jiBanghap: string[];
  jiChung: string[];
  jiHyeong: string[];
  jiPa: string[];
  jiHae: string[];
}
export interface SinsalData {
  list: string[];
}
export interface UnseongData {
  year: string;
  month: string;
  day: string;
  time: string;
}
export interface SajuElements {
  sibsin: SibsinMap;
  daeun: DaeunData;
  strength: StrengthData;
  hapChung: HapChungData;
  sinsal: SinsalData;
  unseong: UnseongData;
}

// ==================================
// 2. 핵심 룩업 데이터 (Data)
// ==================================

// [수정됨] 십신 관계 매트릭스
const SIBSIN_MATRIX: { [mySymbol: string]: { [otherSymbol: string]: string } } = {
  '목': { '목': '비겁', '화': '식상', '토': '재성', '금': '관성', '수': '인성' },
  '화': { '화': '비겁', '토': '식상', '금': '재성', '수': '관성', '목': '인성' },
  '토': { '토': '비겁', '금': '식상', '수': '재성', '목': '관성', '화': '인성' },
  '금': { '금': '비겁', '수': '식상', '목': '재성', '화': '관성', '토': '인성' },
  '수': { '수': '비겁', '목': '식상', '화': '재성', '금': '인성', '토': '관성' }, // "금"과 "토"를 수정
};

// 12운성 룩업 테이블
const UNSEONG_MAP: { [ganName: string]: { [jiName: string]: string } } = {
  "갑": { "해": "장생", "자": "목욕", "축": "관대", "인": "건록", "묘": "제왕", "진": "쇠", "사": "병", "오": "사", "미": "묘", "신": "절", "유": "태", "술": "양" },
  "을": { "오": "장생", "사": "목욕", "진": "관대", "묘": "건록", "인": "제왕", "축": "쇠", "자": "병", "해": "사", "술": "묘", "유": "절", "신": "태", "미": "양" },
  "병": { "인": "장생", "묘": "목욕", "진": "관대", "사": "건록", "오": "제왕", "미": "쇠", "신": "병", "유": "사", "술": "묘", "해": "절", "자": "태", "축": "양" },
  "정": { "유": "장생", "신": "목욕", "미": "관대", "오": "건록", "사": "제왕", "진": "쇠", "묘": "병", "인": "사", "축": "묘", "자": "절", "해": "태", "술": "양" },
  "무": { "인": "장생", "묘": "목욕", "진": "관대", "사": "건록", "오": "제왕", "미": "쇠", "신": "병", "유": "사", "술": "묘", "해": "절", "자": "태", "축": "양" },
  "기": { "유": "장생", "신": "목욕", "미": "관대", "오": "건록", "사": "제왕", "진": "쇠", "묘": "병", "인": "사", "축": "묘", "자": "절", "해": "태", "술": "양" },
  "경": { "사": "장생", "오": "목욕", "미": "관대", "신": "건록", "유": "제왕", "술": "쇠", "해": "병", "자": "사", "축": "묘", "인": "절", "묘": "태", "진": "양" },
  "신": { "자": "장생", "해": "목욕", "술": "관대", "유": "건록", "신": "제왕", "미": "쇠", "오": "병", "사": "사", "진": "묘", "묘": "절", "인": "태", "축": "양" },
  "임": { "신": "장생", "유": "목욕", "술": "관대", "해": "건록", "자": "제왕", "축": "쇠", "인": "병", "묘": "사", "진": "묘", "사": "절", "오": "태", "미": "양" },
  "계": { "묘": "장생", "인": "목욕", "축": "관대", "자": "건록", "해": "제왕", "술": "쇠", "유": "병", "신": "사", "미": "묘", "오": "절", "사": "태", "진": "양" },
};

// ... (합/충/형/파/해 및 신살 데이터는 동일) ...
const GAN_HAP: { [key: string]: string } = { "갑": "기", "을": "경", "병": "신", "정": "임", "무": "계" };
const JI_HAP: { [key: string]: string } = { "자": "축", "인": "해", "묘": "술", "진": "유", "사": "신", "오": "미" };
const JI_SAMHAP: { [key: string]: string[] } = { "자": ["신", "진"], "오": ["인", "술"], "묘": ["해", "미"], "유": ["사", "축"] };
const JI_BANGHAP: { [key: string]: string[] } = { "인": ["묘", "진"], "사": ["오", "미"], "신": ["유", "술"], "해": ["자", "축"] };
const JI_CHUNG: { [key: string]: string } = { "자": "오", "축": "미", "인": "신", "묘": "유", "진": "술", "사": "해" };
const JI_HYEONG_SAM: string[] = ["인", "사", "신", "축", "술", "미"];
const JI_HYEONG_SANG: { [key: string]: string } = { "자": "묘" };
const JI_HYEONG_JA: string[] = ["진", "오", "유", "해"];
const JI_PA: { [key: string]: string } = { "자": "유", "축": "진", "인": "해", "묘": "오", "사": "신", "미": "술" };
const JI_HAE: { [key: string]: string } = { "자": "미", "축": "오", "인": "사", "묘": "진", "신": "해", "유": "술" };
const SINSAL_CHEONEUL: { [key: string]: string[] } = {
  "갑": ["축", "미"], "무": ["축", "미"], "경": ["축", "미"],
  "을": ["자", "신"], "기": ["자", "신"],
  "병": ["해", "유"], "정": ["해", "유"],
  "임": ["사", "묘"], "계": ["사", "묘"],
  "신": ["오", "인"],
};
const SINSAL_YEOKMA: { [key: string]: string } = { "인": "신", "오": "신", "술": "신", "신": "인", "자": "인", "진": "인", "사": "해", "유": "해", "축": "해", "해": "사", "묘": "사", "미": "사" };
const SINSAL_DOHWA: { [key: string]: string } = { "인": "묘", "오": "묘", "술": "묘", "신": "유", "자": "유", "진": "유", "사": "오", "유": "오", "축": "오", "해": "자", "묘": "자", "미": "자" };

// ==================================
// 3. 헬퍼 함수 (Helpers)
// ==================================

function parseJijanggan(ji: Ji): Gan[] {
  return ji.innerAttri.split('')
    .map(indexStr => SKY[parseInt(indexStr)])
    .filter(Boolean);
}

function getSibsin(me: Gan, other: Gan | Ji): string {
  const base = SIBSIN_MATRIX[me.symbol][other.symbol];
  // 'other'가 Gan이든 Ji든 'sign' 속성을 가지고 있음
  const sameSign = me.sign === other.sign;

  switch (base) {
    case '비겁': return sameSign ? '비견' : '겁재';
    case '식상': return sameSign ? '식신' : '상관';
    case '재성': return sameSign ? '편재' : '정재';
    case '관성': return sameSign ? '편관' : '정관';
    case '인성': return sameSign ? '편인' : '정인';
    default: return '알수없음';
  }
}

function get60Gapja(): Pillar[] {
  const cycle: Pillar[] = [];
  for (let i = 0; i < 60; i++) {
    cycle.push({
      sky: SKY[i % 10],
      ground: GROUND[i % 12],
    });
  }
  return cycle;
}

const SIXTY_GAPJA = get60Gapja();

function getGapjaIndex(pillar: Pillar): number {
  return SIXTY_GAPJA.findIndex(
    p => p.sky.name === pillar.sky.name && p.ground.name === pillar.ground.name
  );
}

// ==================================
// 4. 핵심 계산 함수 (Calculators)
// ==================================

function calculateSibsin(fourPillars: FourPillars): SibsinMap {
  const me = fourPillars.day.sky;

  const getPillarSibsin = (pillar: Pillar) => ({
    sky: getSibsin(me, pillar.sky),
    // [수정] 지지의 십신을 계산할 때, 지지(Ji) 객체와 그 sign을 그대로 넘깁니다.
    ground: getSibsin(me, pillar.ground),
    jijanggan: parseJijanggan(pillar.ground).map(gan => getSibsin(me, gan)),
  });

  return {
    year: getPillarSibsin(fourPillars.year),
    month: getPillarSibsin(fourPillars.month),
    day: {
      ground: getSibsin(me, fourPillars.day.ground),
      jijanggan: parseJijanggan(fourPillars.day.ground).map(gan => getSibsin(me, gan)),
    },
    time: getPillarSibsin(fourPillars.time),
  };
}

function calculate12Unseong(fourPillars: FourPillars): UnseongData {
  const me = fourPillars.day.sky;
  const map = UNSEONG_MAP[me.name];

  return {
    year: map[fourPillars.year.ground.name],
    month: map[fourPillars.month.ground.name],
    day: map[fourPillars.day.ground.name],
    time: map[fourPillars.time.ground.name],
  };
}

function calculateStrengthScore(fourPillars: FourPillars): StrengthData {
  const me = fourPillars.day.sky;
  // '나'를 돕는 오행 (인성, 비겁)
  const helpers = [
    SIBSIN_MATRIX[me.symbol][me.symbol] === '비겁' ? Object.keys(SIBSIN_MATRIX).find(key => SIBSIN_MATRIX[key][me.symbol] === '인성') : undefined, // 인성
    me.symbol // 비겁
  ].filter(Boolean);


  let score = 0;
  let deukRyeong = false;
  let deukJi = false;
  let deukSe = false;

  // 1. 득령 (월지) - 40점
  if (helpers.includes(fourPillars.month.ground.symbol)) {
    score += 40;
    deukRyeong = true;
  }

  // 2. 득지 (지지) - 일지 20점, 타지 10점
  if (helpers.includes(fourPillars.day.ground.symbol)) {
    score += 20;
    deukJi = true;
  }
  if (helpers.includes(fourPillars.year.ground.symbol)) {
    score += 10;
    deukJi = true;
  }
  if (helpers.includes(fourPillars.time.ground.symbol)) {
    score += 10;
    deukJi = true;
  }

  // 3. 득세 (천간) - 각 10점
  if (helpers.includes(fourPillars.year.sky.symbol)) {
    score += 10;
    deukSe = true;
  }
  if (helpers.includes(fourPillars.month.sky.symbol)) {
    score += 10;
    deukSe = true;
  }
  if (helpers.includes(fourPillars.time.sky.symbol)) {
    score += 10;
    deukSe = true;
  }

  // 4. 지장간 - 각 3점
  parseJijanggan(fourPillars.year.ground).forEach(g => { if (helpers.includes(g.symbol)) score += 3; });
  parseJijanggan(fourPillars.month.ground).forEach(g => { if (helpers.includes(g.symbol)) score += 3; });
  parseJijanggan(fourPillars.day.ground).forEach(g => { if (helpers.includes(g.symbol)) score += 3; });
  parseJijanggan(fourPillars.time.ground).forEach(g => { if (helpers.includes(g.symbol)) score += 3; });

  let result: '신강' | '신약' | '중화' = '중화';
  if (score > 55) result = '신강';
  else if (score < 45) result = '신약';

  return {
    score: Math.min(score, 100),
    result,
    deukRyeong,
    deukJi,
    deukSe,
  };
}

function calculateHapChung(fourPillars: FourPillars): HapChungData {
  const gans = [fourPillars.year.sky.name, fourPillars.month.sky.name, fourPillars.day.sky.name, fourPillars.time.sky.name];
  const jis = [fourPillars.year.ground.name, fourPillars.month.ground.name, fourPillars.day.ground.name, fourPillars.time.ground.name];
  const jiSet = new Set(jis);

  const results: HapChungData = {
    ganHap: [], jiHap: [], jiSamhap: [], jiBanghap: [], jiChung: [], jiHyeong: [], jiPa: [], jiHae: []
  };

  // 1. 1:1 비교
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (GAN_HAP[gans[i]] === gans[j] || GAN_HAP[gans[j]] === gans[i]) {
        results.ganHap.push(`${gans[i]}-${gans[j]}`);
      }
      if (JI_HAP[jis[i]] === jis[j] || JI_HAP[jis[j]] === jis[i]) {
        results.jiHap.push(`${jis[i]}-${jis[j]}`);
      }
      if (JI_CHUNG[jis[i]] === jis[j] || JI_CHUNG[jis[j]] === jis[i]) {
        results.jiChung.push(`${jis[i]}-${jis[j]}`);
      }
      if (JI_PA[jis[i]] === jis[j] || JI_PA[jis[j]] === jis[i]) {
        results.jiPa.push(`${jis[i]}-${jis[j]}`);
      }
      if (JI_HAE[jis[i]] === jis[j] || JI_HAE[jis[j]] === jis[i]) {
        results.jiHae.push(`${jis[i]}-${jis[j]}`);
      }
      if (JI_HYEONG_SANG[jis[i]] === jis[j] || JI_HYEONG_SANG[jis[j]] === jis[i]) {
        results.jiHyeong.push(`(상형) ${jis[i]}-${jis[j]}`);
      }
    }
    // 지지 자형
    if (JI_HYEONG_JA.includes(jis[i]) && jis.filter(ji => ji === jis[i]).length > 1) {
      results.jiHyeong.push(`(자형) ${jis[i]}`);
    }
  }

  // 2. 삼형 (인사신, 축술미)
  if (jiSet.has("인") && jiSet.has("사") && jiSet.has("신")) results.jiHyeong.push("(삼형) 인사신");
  if (jiSet.has("축") && jiSet.has("술") && jiSet.has("미")) results.jiHyeong.push("(삼형) 축술미");

  // 3. 삼합, 방합
  Object.keys(JI_SAMHAP).forEach(wangji => {
    const [saengji, goji] = JI_SAMHAP[wangji];
    if (jiSet.has(wangji) && jiSet.has(saengji) && jiSet.has(goji)) results.jiSamhap.push(`(삼합) ${saengji}-${wangji}-${goji}`);
    else if (jiSet.has(wangji) && jiSet.has(saengji)) results.jiSamhap.push(`(반합) ${saengji}-${wangji}`);
    else if (jiSet.has(wangji) && jiSet.has(goji)) results.jiSamhap.push(`(반합) ${wangji}-${goji}`);
  });

  Object.keys(JI_BANGHAP).forEach(saengji => {
    const [wangji, goji] = JI_BANGHAP[saengji];
    if (jiSet.has(saengji) && jiSet.has(wangji) && jiSet.has(goji)) {
      results.jiBanghap.push(`(방합) ${saengji}-${wangji}-${goji}`);
    }
  });

  // 중복 제거
  Object.keys(results).forEach(key => {
    results[key as keyof HapChungData] = [...new Set(results[key as keyof HapChungData])];
  });

  return results;
}

function calculateSinsal(fourPillars: FourPillars): SinsalData {
  const dayGan = fourPillars.day.sky.name;
  const dayJi = fourPillars.day.ground.name;
  const yearJi = fourPillars.year.ground.name;
  const allJis = [
    fourPillars.year.ground.name,
    fourPillars.month.ground.name,
    fourPillars.day.ground.name,
    fourPillars.time.ground.name
  ];
  const list: string[] = [];

  // 1. 천을귀인
  const cheoneul = SINSAL_CHEONEUL[dayGan] || [];
  allJis.forEach(ji => {
    if (cheoneul.includes(ji)) list.push(`천을귀인 (${ji})`);
  });

  // 2. 역마
  const yeokmaKey = SINSAL_YEOKMA[yearJi];
  const yeokmaKey_day = SINSAL_YEOKMA[dayJi];
  allJis.forEach(ji => {
    if (ji === yeokmaKey) list.push(`역마 (년지 ${yearJi} 기준 ${ji})`);
    if (ji === yeokmaKey_day && yeokmaKey !== yeokmaKey_day) list.push(`역마 (일지 ${dayJi} 기준 ${ji})`);
  });

  // 3. 도화
  const dohwaKey = SINSAL_DOHWA[yearJi];
  const dohwaKey_day = SINSAL_DOHWA[dayJi];
  allJis.forEach(ji => {
    if (ji === dohwaKey) list.push(`도화 (년지 ${yearJi} 기준 ${ji})`);
    if (ji === dohwaKey_day && dohwaKey !== dohwaKey_day) list.push(`도화 (일지 ${dayJi} 기준 ${ji})`);
  });

  return { list: [...new Set(list)] };
}

function calculateDaeun(
  fourPillars: FourPillars,
  gender: '남' | '여',
  daeunSu: number
): DaeunData {
  const yearGan = fourPillars.year.sky;
  const monthPillar = fourPillars.month;

  const isSoon = (gender === '남' && yearGan.sign === '양') || (gender === '여' && yearGan.sign === '음');
  const direction = isSoon ? '순행' : '역행';

  const cycles: DaeunData['cycles'] = [];
  let currentIndex = getGapjaIndex(monthPillar);
  const step = isSoon ? 1 : -1;

  for (let i = 0; i < 10; i++) {
    currentIndex = (currentIndex + step + 60) % 60;
    cycles.push({
      age: daeunSu + (i * 10),
      pillar: SIXTY_GAPJA[currentIndex],
    });
  }

  return {
    su: daeunSu,
    cycles,
    direction,
  };
}


// ==================================
// 5. 통합 실행 함수 (Main Executor)
// ==================================

export function calculateAllSajuElements(
  fourPillars: FourPillars,
  gender: '남' | '여',
  daeunSu: number
): SajuElements {
  return {
    sibsin: calculateSibsin(fourPillars),
    unseong: calculate12Unseong(fourPillars),
    strength: calculateStrengthScore(fourPillars),
    hapChung: calculateHapChung(fourPillars),
    sinsal: calculateSinsal(fourPillars),
    daeun: calculateDaeun(fourPillars, gender, daeunSu),
  };
}


export function calculateDaeunSu(
  birthDate: Date,
  hour: number,
  minute: number,
  gender: '남' | '여'
): number {
  // 1. 균시차 보정
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  const standardTime = new Date(year, month, day, hour, minute);
  const solarTime = new Date(standardTime.getTime() - (30 * 60000));
  const solarTimeMs = solarTime.getTime();

  const solarYear = solarTime.getFullYear();
  const solarMonth = solarTime.getMonth();
  const solarDay = solarTime.getDate();
  const solarHour = solarTime.getHours();
  const solarMinute = solarTime.getMinutes();

  // 2. 사주 년도(sajuYear) 계산 (입춘 기준)
  let sajuYear = solarYear;
  const ipchun = getSolarTerm(solarYear, 1); // 1 = 2월 (입춘)
  const ipchunDate = new Date(
    ipchun.Year, ipchun.Month, ipchun.Day, ipchun.Hour, ipchun.Minute
  );

  if (solarTimeMs < ipchunDate.getTime()) {
    sajuYear = solarYear - 1;
  }

  // 3. 대운 방향 결정
  const sajuYearGanSign = getYearSky(sajuYear).sign;
  const isSoon = (gender === '남' && sajuYearGanSign === '양') || (gender === '여' && sajuYearGanSign === '음');

  // 4. 현재 월의 시작/종료 절입시각 찾기

  // 4a. 현재 월의 절입시각 (예: 8월 7일 입추)
  const currentMonthTerm = getSolarTerm(solarYear, solarMonth);
  const currentMonthTermTime = new Date(
    currentMonthTerm.Year, currentMonthTerm.Month, currentMonthTerm.Day, currentMonthTerm.Hour, currentMonthTerm.Minute
  ).getTime();

  let sajuStartTermTime: number;
  let sajuEndTermTime: number;

  if (solarTimeMs < currentMonthTermTime) {
    // [현재 월의 절기(입추) 이전] (예: 8월 2일)
    // 사주 월은 이전 월(7월)임.
    sajuEndTermTime = currentMonthTermTime; // 사주월의 종료 = 8월 7일 입추

    const prevMonth = (solarMonth - 1 + 12) % 12;
    const prevYear = (prevMonth === 11) ? solarYear - 1 : solarYear;
    const prevMonthTerm = getSolarTerm(prevYear, prevMonth); // 7월 7일 소서
    sajuStartTermTime = new Date(
      prevMonthTerm.Year, prevMonthTerm.Month, prevMonthTerm.Day, prevMonthTerm.Hour, prevMonthTerm.Minute
    ).getTime();

  } else {
    // [현재 월의 절기(입추) 이후] (예: 8월 10일)
    // 사주 월은 현재 월(8월)임.
    sajuStartTermTime = currentMonthTermTime; // 사주월의 시작 = 8월 7일 입추

    const nextMonth = (solarMonth + 1) % 12;
    const nextYear = (nextMonth === 0) ? solarYear + 1 : solarYear;
    const nextMonthTerm = getSolarTerm(nextYear, nextMonth); // 9월 7일 백로
    sajuEndTermTime = new Date(
      nextMonthTerm.Year, nextMonthTerm.Month, nextMonthTerm.Day, nextMonthTerm.Hour, nextMonthTerm.Minute
    ).getTime();
  }

  // 5. 시간 차이 계산
  let diffMillis: number;
  if (isSoon) {
    // 순행: 다음 절기까지 남은 시간
    diffMillis = Math.abs(sajuEndTermTime - solarTimeMs);
  } else {
    // 역행: 이전 절기부터 지난 시간
    diffMillis = Math.abs(solarTimeMs - sajuStartTermTime);
  }

  // 6. 대운수 계산 (3일 = 1년)
  const diffDays = diffMillis / (1000 * 60 * 60 * 24);
  let daeunSu = Math.round(diffDays / 3);

  if (daeunSu < 1) daeunSu = 1;
  if (daeunSu > 10) daeunSu = 10;

  return daeunSu;
}


function formatHapChungForPrompt(arr: string[]): string {
  return arr.length > 0 ? arr.join(", ") : "없음";
}

function formatJijangganForPrompt(arr: string[]): string {
  return arr.length > 0 ? `(${arr.join(", ")})` : "";
}

export function generateSajuAnalysisPrompt(
  birthDate: Date,
  hour: number,
  minute: number,
  gender: '남' | '여'
): string {

  // 1. 모든 정량적 데이터 계산
  const pillars = calculateFourPillars(birthDate, hour, minute);
  const daeunSu = calculateDaeunSu(birthDate, hour, minute, gender);
  const elements = calculateAllSajuElements(pillars, gender, daeunSu);

  const me = pillars.day.sky; // 일간 (나)

  // 2. 프롬프트 문자열 구성 시작 (LLM 페르소나 및 데이터 주입)
  let prompt = `
- 현재 시간: ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 ${new Date().getDate()}일
- 태어난 시간: ${birthDate.getFullYear()}년 ${birthDate.getMonth() + 1}월 ${birthDate.getDate()}일
- 일간(日干): ${me.name} (${me.symbol}, ${me.sign})

- 사주 원국 (四柱)
| 구분 | 년주(年) | 월주(月) | 일주(日) | 시주(時) |
|---|---|---|---|---|
| 천간 | ${pillars.year.sky.name} (${elements.sibsin.year.sky}) | ${pillars.month.sky.name} (${elements.sibsin.month.sky}) | ${pillars.day.sky.name} (나) | ${pillars.time.sky.name} (${elements.sibsin.time.sky}) |
| 지지 | ${pillars.year.ground.name} (${elements.sibsin.year.ground}) | ${pillars.month.ground.name} (${elements.sibsin.month.ground}) | ${pillars.day.ground.name} (${elements.sibsin.day.ground}) | ${pillars.time.ground.name} (${elements.sibsin.time.ground}) |
| 지장간 십신 | ${formatJijangganForPrompt(elements.sibsin.year.jijanggan)} | ${formatJijangganForPrompt(elements.sibsin.month.jijanggan)} | ${formatJijangganForPrompt(elements.sibsin.day.jijanggan)} | ${formatJijangganForPrompt(elements.sibsin.time.jijanggan)} |
| 12운성(봉) | ${elements.unseong.year} | ${elements.unseong.month} | ${elements.unseong.day} | ${elements.unseong.time} |

- 핵심 분석
  신강/신약: ${elements.strength.result} (점수: ${elements.strength.score})
  득령(月): ${elements.strength.deukRyeong ? 'O' : 'X'}
  득지(地): ${elements.strength.deukJi ? 'O' : 'X'}
  득세(勢): ${elements.strength.deukSe ? 'O' : 'X'}

- 합/충/형/파/해
  천간합: ${formatHapChungForPrompt(elements.hapChung.ganHap)}
  지지 육합: ${formatHapChungForPrompt(elements.hapChung.jiHap)}
  지지 삼합: ${formatHapChungForPrompt(elements.hapChung.jiSamhap)}
  지지 방합: ${formatHapChungForPrompt(elements.hapChung.jiBanghap)}
  지지 충: ${formatHapChungForPrompt(elements.hapChung.jiChung)}
  지지 형: ${formatHapChungForPrompt(elements.hapChung.jiHyeong)}
  지지 파/해: ${formatHapChungForPrompt([...elements.hapChung.jiPa, ...elements.hapChung.jiHae])}
  신살: ${formatHapChungForPrompt(elements.sinsal.list)}

- 10년 대운 (大運)
  대운수: ${elements.daeun.su}
  방향: ${elements.daeun.direction}
  대운 주기: ${elements.daeun.cycles.length}
`;

  // 3. 대운 주기 (동적 생성)
  // (getSibsin과 UNSEONG_MAP은 saju.ts의 상단에 이미 정의되어 있으므로 접근 가능)
  for (const cycle of elements.daeun.cycles) {
    const daeunSkySibsin = getSibsin(me, cycle.pillar.sky);
    const daeunGroundSibsin = getSibsin(me, cycle.pillar.ground);
    const daeunUnseong = UNSEONG_MAP[me.name]?.[cycle.pillar.ground.name] || '-';

    prompt += `  ${cycle.age}세 (${cycle.pillar.sky.name}${cycle.pillar.ground.name}): 천간(${daeunSkySibsin}), 지지(${daeunGroundSibsin}), 12운성(${daeunUnseong})\n`;
  }

  return prompt;
}