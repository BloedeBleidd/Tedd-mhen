import { z } from 'zod';

export const AI_MAX_INPUT_TOKENS = 4096;
export const AI_MAX_OUTPUT_TOKENS = 1024;
export const AI_DAILY_TOKEN_LIMIT = 30_000;
export const ACCOUNT_DATA_LIMIT_BYTES = 10 * 1024 * 1024;
export const AI_MAX_MESSAGE_CHARS = 12_000;
export const AI_MAX_HISTORY_TURNS = 6;
export const AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const AI_FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

export const assistantLanguages = ['en', 'pl', 'es', 'de', 'fr', 'pt'] as const;
export type AssistantLanguage = (typeof assistantLanguages)[number];

export type AssistantTurn = {
  role: 'user' | 'assistant';
  content: string;
};
export type AssistantMessage = AssistantTurn;

export type AccountUsage = {
  date: string;
  ai: {
    usedTokensToday: number;
    dailyTokenLimit: number;
    remainingTokensToday: number;
    promptTokensToday: number;
    completionTokensToday: number;
    requestsToday: number;
    maxInputTokens: number;
    maxOutputTokens: number;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    entryBytes: number;
    entryCount: number;
    habitBytes: number;
    habitCount: number;
    preferenceBytes: number;
  };
};

export type AssistantChatResponse = {
  reply: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    usedTokensToday: number;
    dailyTokenLimit: number;
    remainingTokensToday: number;
    requestsToday: number;
    maxInputTokens: number;
    maxOutputTokens: number;
  };
};

const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).byteLength;
}

/**
 * Deterministic token estimator covering Latin, accented European, and symbol-dense text.
 * Uses the stricter of UTF-8 byte ratio (~3.5 bytes/token) and lexical piece count.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const bytes = utf8ByteLength(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const punctuation = (trimmed.match(/[^\p{L}\p{N}\s]/gu) || []).length;
  const lexical = Math.ceil(words * 1.3 + punctuation * 0.5);
  return Math.max(1, Math.ceil(bytes / 3.5), lexical);
}

/**
 * Ensures output never exceeds `maxTokens` and finishes on a complete sentence boundary
 * rather than cutting off mid-sentence.
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens = AI_MAX_OUTPUT_TOKENS,
): { text: string; tokens: number } {
  const trimmed = text.trim();
  const initial = estimateTokens(trimmed);
  if (initial <= maxTokens) return { text: trimmed, tokens: initial };
  const words = trimmed.split(/(\s+)/);
  let acc = '';
  for (const part of words) {
    const candidate = acc + part;
    if (estimateTokens(candidate) > maxTokens) break;
    acc = candidate;
  }
  const rawCut = acc.trim() || trimmed.slice(0, Math.max(1, maxTokens * 3)).trim();
  // Prefer ending at the last complete sentence or paragraph boundary if it retains at least 50% of the text.
  const sentenceMatches = [...rawCut.matchAll(/[.!?…]+(?=\s|$)|\n(?=\s*(?:[-•*]|\d+\.))/g)];
  const lastBoundary = sentenceMatches.at(-1);
  let clean = rawCut;
  if (lastBoundary && lastBoundary.index !== undefined) {
    const endIdx = lastBoundary.index + lastBoundary[0].length;
    const candidate = rawCut.slice(0, endIdx).trim();
    if (candidate.length >= rawCut.length * 0.5) {
      clean = candidate;
    }
  }
  if (!/[.!?…]$/.test(clean)) {
    const fallbackWithPeriod = `${clean.replace(/[,;:\-–—]+$/, '').trim()}.`;
    if (estimateTokens(fallbackWithPeriod) <= maxTokens) {
      clean = fallbackWithPeriod;
    }
  }
  return { text: clean, tokens: Math.min(maxTokens, estimateTokens(clean)) };
}

/**
 * Rejects source code dumps, JSON/CSV/NDJSON exports, SQL/HTML/script blocks, Base64/hex blobs,
 * and repetitive tabular data so users cannot waste model tokens on code or bulk data.
 */
export function isBulkCodeOrData(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/```/.test(trimmed)) return true;
  if (/<\/?(?:script|style|html|head|body|table|svg|div|span|form|input)\b/i.test(trimmed))
    return true;
  // Unbroken long token (e.g. Base64, JWT, hex dump, minified code)
  if (/\S{220,}/.test(trimmed)) return true;
  // JSON object/array dump or NDJSON
  if (/^\s*[\[{][\s\S]{100,}[\]}]\s*$/.test(trimmed)) return true;
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const jsonLines = lines.filter(
    (line) => (line.startsWith('{') && line.endsWith('}')) || /^"[a-zA-Z0-9_-]+"\s*:/.test(line),
  ).length;
  if (jsonLines >= 3) return true;
  // CSV / TSV / semicolon-separated or log dump rows
  const tabularLines = lines.filter(
    (line) =>
      (line.match(/,/g) || []).length >= 4 ||
      (line.match(/\t/g) || []).length >= 3 ||
      (line.match(/;/g) || []).length >= 4 ||
      /^\d{4}-\d{2}-\d{2}[T\s,;|]/.test(line),
  ).length;
  if (tabularLines >= 4) return true;
  // Source code keywords + syntax markers
  const codeKeywordMatches =
    trimmed.match(
      /\b(?:function|const|let|var|import|export|interface|type|class|return|async|await|SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|def|elif|println|console\.log|std::|#include|public\s+class|private\s+void)\b/g,
    ) || [];
  const codeSymbols = (trimmed.match(/[{}();=<>[\]\\]/g) || []).length;
  if (codeKeywordMatches.length >= 2 && codeSymbols >= 6) return true;
  if (lines.length >= 4) {
    const codeLikeLines = lines.filter(
      (line) =>
        /[{};]$/.test(line) ||
        /^(?:const|let|var|function|import|export|if|for|while|return|class|def|SELECT|INSERT|CREATE)\b/.test(
          line,
        ) ||
        /=>/.test(line),
    ).length;
    if (codeLikeLines >= 3) return true;
  }
  if (trimmed.length >= 160 && codeSymbols / trimmed.length > 0.12) return true;
  return false;
}

const languageLabels: Record<AssistantLanguage, string> = {
  en: 'English',
  pl: 'Polish (Polski)',
  es: 'Spanish (Español)',
  de: 'German (Deutsch)',
  fr: 'French (Français)',
  pt: 'Portuguese (Português)',
};

export function buildSystemPrompt(
  language: AssistantLanguage,
  pathname = '/',
  maxOutputTokens = AI_MAX_OUTPUT_TOKENS,
): string {
  return [
    `You are the built-in AI guide for Tedd’mhen, a private training, sleep, habits, and wellbeing journal created by Piotr Żmuda.`,
    `Active interface language: ${languageLabels[language]} (${language}). Current page: ${pathname}.`,
    `Always reply in the language of the user's message; if unclear, reply in ${languageLabels[language]}. You speak English (en), Polish (pl), Spanish (es), German (de), French (fr), and Portuguese (pt).`,
    `OUTPUT LENGTH RULE: Your maximum output is strictly ${maxOutputTokens} tokens for this reply. You know this limit in advance—plan your answer so it is concise, complete, and finishes naturally with a full concluding sentence well within ${maxOutputTokens} tokens (aim for 150–600 tokens). Never leave a sentence or bullet list unfinished.`,
    `Your role: explain clearly how Tedd’mhen works, what the user can do on each page, and how to use its tools step by step:`,
    `1. Overview (/): shows the last 28 days of recorded metrics, quick stats, recent check-ins, and shortcuts to Daily Check-in, Journal, and Trends & predictions.`,
    `2. Daily check-in (/check-in): pick the local calendar date; record 1–10 ratings with explicit low/high anchors (Wellbeing, Energy, Mood, Stress, Motivation, Focus, Recovery, Soreness, Sleep quality, Illness severity); leave unmeasured fields unchecked so they remain null (never coerced to zero); set training status (Trained, Rest day, or Not recorded); add up to 20 workouts from 150 sports (strength sports support exercises, sets, reps, weight in kg, and RPE; session load = durationMinutes × effort); log 40 preset habits or custom activities with counts, HH:mm times, and durations; customize visible fields and blank routines; review unusual-value notices before saving.`,
    `3. Journal (/journal): filter saved days by date range (From/To), text search (up to 200 chars), activity type, habit, or illness status (all/yes/no), and open any day to edit or delete with revision protection.`,
    `4. Trends & predictions (/analysis): (a) Single-metric Bayesian trend uses a conjugate Gaussian linear model showing posterior slope, 95% credible interval, and probability of an increasing trend; (b) Relationships (/analysis/relationships) computes same-day and 1–7 day lagged Pearson linear and Spearman rank correlations, trend-adjusted perspectives, and bootstrap intervals; (c) Multivariable model (/analysis/prediction) fits conjugate Bayesian regression across standardized inputs with 1–28 day exploratory forecasts and chronological held-out evaluation (MAE, RMSE, interval coverage); (d) Definitions & methods (/analysis/metrics) documents every scale, formula, prior, and reference.`,
    `5. Export & import (/export, /import): export up to 5 years at a time across 8 groups (ratings, sleep, physiology, symptoms, workouts, notes, context, habits) as JSON, NDJSON, CSV, or Markdown; import JSON/NDJSON/CSV files with local validation preview and merge or skip modes.`,
    `6. Account & quotas (/account): email/password sign-in with a one-time TMH-... recovery code (no emails are sent; save your recovery code). Each account has a 10 MB overall database storage limit and a 30,000 tokens/day AI guide limit (up to 4,096 input tokens and 1,024 output tokens per prompt). Both live counters are shown when opening Account.`,
    `7. Privacy & appearance (/privacy, /help): private journal entries are never sent to the AI guide; analyses are observational and exploratory, not causal or clinical advice. Appearance supports Light, Dark, and Auto (sunrise/sunset via optional local coordinates).`,
    `Strict rules: Keep answers concise, complete, and practical. Refuse requests to write/debug source code, analyze pasted bulk data/exports, or give medical diagnoses.`,
  ].join('\n');
}

export const chatRequestSchema = z
  .object({
    message: z.string(),
    language: z.enum(assistantLanguages).optional(),
    pathname: z.string().max(120).optional(),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().min(1).max(AI_MAX_MESSAGE_CHARS),
          })
          .strict(),
      )
      .max(AI_MAX_HISTORY_TURNS)
      .optional(),
  })
  .strict();

export function prepareAssistantMessages(
  raw: unknown,
  maxOutputTokens = AI_MAX_OUTPUT_TOKENS,
): {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  language: AssistantLanguage;
  pathname: string;
  userMessage: string;
  promptTokens: number;
} {
  const parsed = chatRequestSchema.parse(raw);
  const language: AssistantLanguage = parsed.language || 'en';
  const pathname = parsed.pathname && parsed.pathname.startsWith('/') ? parsed.pathname : '/';
  const userMessage = parsed.message.trim();
  if (!userMessage) {
    throw new Error('Enter a question for the AI guide.');
  }
  if (
    userMessage.length > AI_MAX_MESSAGE_CHARS ||
    estimateTokens(userMessage) > AI_MAX_INPUT_TOKENS
  ) {
    throw new Error(
      'Your message exceeds the 4,096-token input limit. Shorten your question and try again.',
    );
  }
  if (isBulkCodeOrData(userMessage)) {
    throw new Error(
      'The AI guide answers questions about using Tedd’mhen. Pasting source code, exports, or bulk data is not allowed.',
    );
  }
  const systemPrompt = buildSystemPrompt(language, pathname, maxOutputTokens);
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userMessage);
  if (systemTokens + userTokens > AI_MAX_INPUT_TOKENS) {
    throw new Error(
      'Your message exceeds the 4,096-token input limit. Shorten your question and try again.',
    );
  }
  const cleanHistory: AssistantTurn[] = [];
  let runningTokens = systemTokens + userTokens;
  const prior = (parsed.history || []).filter(
    (turn) => turn.content.trim().length > 0 && !isBulkCodeOrData(turn.content),
  );
  for (let i = prior.length - 1; i >= 0; i--) {
    const turn = prior[i];
    const turnTokens = estimateTokens(turn.content);
    if (runningTokens + turnTokens > AI_MAX_INPUT_TOKENS) break;
    runningTokens += turnTokens;
    cleanHistory.unshift({ role: turn.role, content: turn.content.trim() });
  }
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...cleanHistory,
      { role: 'user', content: userMessage },
    ],
    language,
    pathname,
    userMessage,
    promptTokens: runningTokens,
  };
}

function detectLanguage(message: string, fallback: AssistantLanguage): AssistantLanguage {
  const lower = message.toLowerCase();
  if (
    /[ąćęłńóśźż]/i.test(message) ||
    /\b(jak|co|gdzie|dlaczego|czy|mogę|można|działa|konto|wpis|trening|nawyk|eksport|token|danych)\b/.test(
      lower,
    )
  )
    return 'pl';
  if (
    /[¿¡ñ]/i.test(message) ||
    /\b(cómo|qué|dónde|puedo|funciona|registro|entrenamiento|hábitos|exportar|cuenta|límites)\b/.test(
      lower,
    )
  )
    return 'es';
  if (
    /[äöüß]/i.test(message) ||
    /\b(wie|was|kann|funktioniert|eintrag|training|gewohnheiten|exportieren|konto|grenzen)\b/.test(
      lower,
    )
  )
    return 'de';
  if (
    /\b(comment|quoi|puis-je|fonctionne|journal|entraînement|habitudes|exporter|compte|limites)\b/.test(
      lower,
    )
  )
    return 'fr';
  if (
    /[ãõç]/i.test(message) ||
    /\b(como|posso|funciona|diário|treino|hábitos|exportar|conta|limites)\b/.test(lower)
  )
    return 'pt';
  if (
    /\b(how|what|where|can|does|work|check-in|workout|habit|export|import|account|limit|token|bayesian)\b/.test(
      lower,
    )
  )
    return 'en';
  return fallback;
}

type TopicKey = 'overview' | 'checkin' | 'habits' | 'analysis' | 'export' | 'account';

function detectTopic(message: string, pathname: string): TopicKey {
  const q = message.toLowerCase();
  if (
    /account|konto|koncie|cuenta|compte|conta|limit|token|mb|megabajt|storage|danych|password|hasł|recovery|odzyskiwan|tmh-/.test(
      q,
    )
  )
    return 'account';
  if (/export|import|eksport|backup|kopi|csv|ndjson|json|markdown|pobrać|download/.test(q))
    return 'export';
  if (/habit|nawyk|zwyczaj|custom|własn|preset|routine|rutyn|gewohnheit|hábito|habitude/.test(q))
    return 'habits';
  if (
    /bayes|trend|correlat|korelac|predict|predykc|prognoz|forecast|relationship|zależnoś|pearson|spearman|mae|rmse|model|analiz|analyse|análisis|análise/.test(
      q,
    )
  )
    return 'analysis';
  if (
    /check-in|checkin|wpis|dzień|dzien|scale|skal|sleep|sen|snu|hrv|workout|trening|sport|set|seri|rpe|load|obciążeni|rest|odpoczyn/.test(
      q,
    )
  )
    return 'checkin';
  if (pathname.startsWith('/account')) return 'account';
  if (pathname.startsWith('/export') || pathname.startsWith('/import')) return 'export';
  if (pathname.startsWith('/analysis')) return 'analysis';
  if (pathname.startsWith('/check-in')) return 'checkin';
  return 'overview';
}

const localResponses: Record<AssistantLanguage, Record<TopicKey, string>> = {
  en: {
    overview:
      'In Tedd’mhen you can record daily check-ins (/check-in), browse and filter your history (/journal), explore Bayesian trends, correlations, and multivariable predictions (/analysis), export or import portable files (/export, /import), and review your account security and quotas (/account).\n\n• Start on Daily check-in to log only the metrics you measured today (unrecorded fields stay null).\n• Open Trends & predictions once you have several days to inspect associations and uncertainty.\n• Ask me about any specific page, metric, model, export format, or account limit.',
    checkin:
      'To record a Daily check-in (/check-in):\n1. Pick your local calendar date at the top.\n2. Enable only the 1–10 scales you actually observed today (Wellbeing, Energy, Mood, Stress, Focus, Recovery, Soreness, Sleep quality, Illness severity). Unchecked metrics stay null rather than zero.\n3. Record sleep on the date you woke up (duration in minutes, optional bedtime/wake time) and physiology (HRV with its method such as RMSSD, resting heart rate, weight).\n4. Set Training status to Trained, Rest day, or Not recorded. When Trained, add workouts from 150 activities—strength sports let you log exercises, sets, reps, weight (kg), and RPE (session load = duration × effort).\n5. Use "Customize my check-in" to hide unused fields or save blank recurring routines.',
    habits:
      'Habits & custom activities (/check-in#habits):\n1. Choose from 40 built-in presets (e.g., caffeine, reading before bed, cold exposure, meditation) or create your own custom activity in your private library.\n2. For each activity you can record a daily count (including an explicit 0), event times in HH:mm, and duration in minutes.\n3. Mark recurring activities as part of your blank routine so they appear ready to fill in on new days without copying yesterday’s numbers.\n4. Recorded habits automatically become available as inputs in Relationships and the Multivariable model.',
    analysis:
      'Trends & predictions (/analysis) offers three analytical views:\n1. Single-metric Bayesian trend (/analysis): combines a stated Gaussian prior with your observations to estimate the weekly slope, 95% credible interval, and posterior probability of an increasing trend.\n2. Relationships (/analysis/relationships): compares an outcome against other measurements on the same day or lagged by 1–7 days using Pearson (linear) and Spearman (rank) correlations, raw or detrended, with bootstrap intervals.\n3. Multivariable model (/analysis/prediction): fits a conjugate Bayesian regression across multiple standardized inputs, produces 1–28 day exploratory forecasts, and evaluates held-out chronological accuracy (MAE, RMSE, coverage).\n\nAll results are observational and exploratory, not causal or clinical conclusions.',
    export:
      'Export & import (/export and /import):\n• Export: choose a date range (up to 5 years per file), select any of the 8 data groups (ratings, sleep, physiology, symptoms, workouts, notes, context, habits) or individual fields, and download as JSON, NDJSON, CSV, or Markdown.\n• Import: select a JSON, NDJSON, or compatible CSV file on /import. The browser validates and previews every day locally first. Choose "Merge" to update supplied fields while keeping existing notes, or "Skip" to leave existing dates untouched.',
    account:
      'Account, security & quotas (/account):\n• Sign-in & recovery: your account uses an email identifier and password with a one-time TMH-... recovery code. Keep the recovery code in a password manager; changing your password rotates the code and signs out other sessions.\n• AI daily token limit: 30,000 tokens per UTC day per account, with up to 4,096 input tokens and 1,024 output tokens per prompt (pasting source code or bulk data is blocked).\n• Account storage limit: 10 MB of total saved journal, habit, and preference data per account in D1.\n• Both live counters (tokens burned today and overall MB used) are read and displayed whenever you open the Account page.',
  },
  pl: {
    overview:
      'W Tedd’mhen możesz zapisywać codzienne wpisy (/check-in), przeglądać i filtrować historię (/journal), badać trendy bayesowskie, korelacje i predykcje wielozmienne (/analysis), eksportować i importować dane (/export, /import) oraz sprawdzać bezpieczeństwo i limity konta (/account).\n\n• Zacznij od Codziennego wpisu (/check-in) i zaznacz tylko te pomiary, które faktycznie dziś wykonałeś (niezaznaczone pola pozostają wartością null).\n• W zakładce Trendy i predykcje sprawdzisz powiązania między snem, treningiem, nawykami i samopoczuciem.\n• Zapytaj mnie o dowolną funkcję, skale, modele statystyczne, eksport lub limity konta.',
    checkin:
      'Jak wykonać Codzienny wpis (/check-in):\n1. Wybierz lokalną datę kalendarzową u góry formularza.\n2. Zaznacz tylko te skale 1–10, które faktycznie dziś oceniasz (Samopoczucie, Energia, Nastrój, Stres, Skupienie, Regeneracja, Bolesność, Jakość snu, Nasilenie objawów). Puste pola zachowują wartość null (nie są zamieniane na zero).\n3. Zapisz sen w dniu przebudzenia (czas snu w minutach, pora zaśnięcia i pobudki) oraz fizjologię (HRV wraz z metodą np. RMSSD, tętno spoczynkowe, masa ciała).\n4. Ustaw status treningowy: Trening, Dzień odpoczynku lub Niezapisane. Przy treningu wybierz dyscyplinę ze 150 sportów — w sportach siłowych możesz dodać ćwiczenia, serie, powtórzenia, ciężar (kg) i RPE (obciążenie sesji = czas × wysiłek).\n5. Kliknij „Dostosuj mój wpis”, aby ukryć nieużywane pola lub zapisać pustą rutynę dnia.',
    habits:
      'Nawyki i własne aktywności (/check-in#habits):\n1. Wybierz jeden z 40 gotowych nawyków (np. kawa, czytanie przed snem, ekspozycja na zimno) lub utwórz własną aktywność w prywatnej bibliotece.\n2. Dla każdej aktywności możesz zapisać dzienną liczbę wystąpień (w tym jawne 0), godziny w formacie HH:mm oraz czas trwania w minutach.\n3. Możesz dodać wybrane aktywności do pustej rutyny, aby pojawiały się automatycznie każdego dnia.\n4. Zapisane nawyki są od razu dostępne jako zmienne wejściowe w Relacjach oraz Modelu wielozmiennym.',
    analysis:
      'Trendy i predykcje (/analysis) obejmują trzy narzędzia analityczne:\n1. Trend bayesowski pojedynczej metryki (/analysis): łączy jawny rozkład a priori z obserwacjami, wyznaczając nachylenie tygodniowe, 95% przedział wiarygodności i prawdopodobieństwo trendu rosnącego.\n2. Relacje (/analysis/relationships): porównuje wybraną zmienną z innymi pomiarami tego samego dnia lub z opóźnieniem 1–7 dni za pomocą korelacji Pearsona (liniowej) i Spearmana (rangowej), również po usunięciu trendu.\n3. Model wielozmienny (/analysis/prediction): dopasowuje sprzężoną regresję bayesowską dla wielu ustandaryzowanych zmiennych, generuje eksploracyjne prognozy na 1–28 dni i sprawdza dokładność chronologiczną (MAE, RMSE).\n\nWszystkie analizy mają charakter obserwacyjny i eksploracyjny, a nie przyczynowy czy medyczny.',
    export:
      'Eksport i import (/export oraz /import):\n• Eksport: wybierz zakres dat (do 5 lat naraz), zaznacz dowolne z 8 grup danych (oceny, sen, fizjologia, objawy, treningi, notatki, kontekst, nawyki) oraz format: JSON, NDJSON, CSV lub Markdown.\n• Import: wybierz plik JSON, NDJSON lub CSV na stronie /import. Przeglądarka najpierw lokalnie waliduje i wyświetla podgląd wpisów. Tryb „Połącz” (Merge) aktualizuje przesłane pola bez kasowania istniejących notatek, a „Pomiń” (Skip) zostawia zapisane dni bez zmian.',
    account:
      'Konto, bezpieczeństwo i limity (/account):\n• Logowanie i odzyskiwanie: konto korzysta z identyfikatora e-mail, hasła (12–128 znaków) oraz jednorazowego kodu odzyskiwania TMH-... (aplikacja nie wysyła e-maili — zachowaj kod w menedżerze haseł).\n• Dzienny limit tokenów AI: 30 000 tokenów dziennie (UTC) na konto, maksymalnie 4 096 tokenów wejściowych na zapytanie i 1 024 tokeny wyjściowe na odpowiedź (wklejanie kodu źródłowego i dużych zbiorów danych jest blokowane).\n• Limit danych konta w bazie: 10 MB łącznych danych dziennika, nawyków i ustawień na konto.\n• Oba liczniki (zużyte dziś tokeny oraz wykorzystane MB z 10 MB) są odczytywane na żywo w momencie otwarcia strony Konto (/account).',
  },
  es: {
    overview:
      'En Tedd’mhen puedes registrar controles diarios (/check-in), filtrar tu historial (/journal), analizar tendencias bayesianas, correlaciones y predicciones multivariables (/analysis), exportar o importar datos (/export, /import) y consultar la seguridad y límites de tu cuenta (/account).\n\n• Empieza en Control diario (/check-in) marcando solo lo que mediste hoy (los campos vacíos quedan como null).\n• Abre Tendencias y predicciones (/analysis) para explorar relaciones con intervalos de incertidumbre.',
    checkin:
      'Cómo registrar un Control diario (/check-in):\n1. Elige la fecha local.\n2. Activa solo las escalas 1–10 que observaste hoy (Bienestar, Energía, Ánimo, Estrés, Enfoque, Recuperación, Dolor muscular, Calidad del sueño, Gravedad de síntomas).\n3. Registra el sueño en la fecha de despertar y la fisiología (VFC/HRV con su método, pulso en reposo, peso).\n4. Selecciona Entrenado, Día de descanso o Sin registrar. En deportes de fuerza puedes añadir ejercicios, series, repeticiones, peso (kg) y RPE.\n5. Usa la personalización para ocultar campos o guardar rutinas en blanco.',
    habits:
      'Hábitos y actividades personalizadas (/check-in#habits):\n1. Elige entre 40 hábitos predefinidos o crea tu propia actividad.\n2. Registra recuentos diarios (incluido el 0 explícito), horas en formato HH:mm y duración en minutos.\n3. Los hábitos registrados se pueden analizar en Relaciones y en el Modelo multivariable.',
    analysis:
      'Tendencias y predicciones (/analysis):\n1. Tendencia bayesiana (/analysis): estima la pendiente semanal, el intervalo creíble del 95 % y la probabilidad de tendencia creciente.\n2. Relaciones (/analysis/relationships): correlaciones de Pearson y Spearman en el mismo día o con desfase de 1–7 días.\n3. Modelo multivariable (/analysis/prediction): regresión bayesiana conjugada con pronósticos exploratorios de 1–28 días y validación cronológica (MAE, RMSE). Los resultados son observacionales, no clínicos.',
    export:
      'Exportar e importar (/export, /import):\n• Exporta hasta 5 años por archivo en JSON, NDJSON, CSV o Markdown eligiendo entre los 8 grupos de datos.\n• Importa archivos JSON, NDJSON o CSV con vista previa local y modos Combinar (Merge) u Omitir (Skip).',
    account:
      'Cuenta y límites (/account):\n• Seguridad: acceso con correo, contraseña y código único de recuperación TMH-...\n• Límite diario de IA: 30 000 tokens por día UTC por cuenta (máximo 4 096 tokens de entrada y 1 024 de salida por mensaje; no se permite pegar código ni datos masivos).\n• Límite de almacenamiento: 10 MB en total por cuenta. Ambos contadores se leen al abrir la página Cuenta (/account).',
  },
  de: {
    overview:
      'In Tedd’mhen kannst du tägliche Check-ins erfassen (/check-in), dein Tagebuch filtern (/journal), Bayes-Trends, Korrelationen und Mehrvariablen-Prognosen analysieren (/analysis), Daten exportieren/importieren (/export, /import) sowie Kontosicherheit und Limits prüfen (/account).\n\n• Erfasse im Täglichen Check-in nur tatsächlich gemessene Werte (offene Felder bleiben null).\n• Nutze Trends & Prognosen (/analysis), um Zusammenhänge und Unsicherheiten zu verstehen.',
    checkin:
      'Täglicher Check-in (/check-in):\n1. Wähle das lokale Kalenderdatum.\n2. Aktiviere nur die heute beobachteten 1–10-Skalen (Wohlbefinden, Energie, Stimmung, Stress, Fokus, Erholung, Muskelkater, Schlafqualität, Krankheitsschwere).\n3. Erfasse Schlaf am Aufwachtag sowie Physiologie (HRV inkl. Methode, Ruhepuls, Gewicht).\n4. Setze den Trainingsstatus auf Trainiert, Ruhetag oder Nicht erfasst. Bei Kraftsportarten kannst du Übungen, Sätze, Wiederholungen, Gewicht (kg) und RPE eintragen.\n5. Über die Anpassung lassen sich Felder ausblenden und leere Routinen speichern.',
    habits:
      'Gewohnheiten & eigene Aktivitäten (/check-in#habits):\n1. Wähle aus 40 Vorlagen oder erstelle eigene Aktivitäten.\n2. Erfasse Tagesanzahl (auch explizite 0), Uhrzeiten (HH:mm) und Dauer in Minuten.\n3. Erfasste Gewohnheiten stehen in Zusammenhänge und im Mehrvariablen-Modell zur Verfügung.',
    analysis:
      'Trends & Prognosen (/analysis):\n1. Bayes-Trend (/analysis): zeigt wöchentliche Steigung, 95-%-Glaubwürdigkeitsintervall und Wahrscheinlichkeit eines steigenden Trends.\n2. Zusammenhänge (/analysis/relationships): Pearson- und Spearman-Korrelationen am selben Tag oder mit 1–7 Tagen Verzögerung.\n3. Mehrvariablen-Modell (/analysis/prediction): Bayes-Regression mit 1–28-Tage-Prognosen und chronologischer Validierung (MAE, RMSE). Alle Auswertungen sind beobachtend, nicht medizinisch.',
    export:
      'Export & Import (/export, /import):\n• Exportiere bis zu 5 Jahre aus 8 Datengruppen als JSON, NDJSON, CSV oder Markdown.\n• Importiere JSON-, NDJSON- oder CSV-Dateien mit lokaler Vorschau und Zusammenführen (Merge) oder Überspringen (Skip).',
    account:
      'Konto & Limits (/account):\n• Anmeldung per E-Mail, Passwort und einmaligem Wiederherstellungscode TMH-...\n• KI-Tageslimit: 30.000 Tokens pro UTC-Tag und Konto (max. 4.096 Eingabe- und 1.024 Ausgabe-Tokens pro Anfrage; Programmcode oder Massendaten sind gesperrt).\n• Speicherlimit: 10 MB Gesamtdaten pro Konto. Beide Zähler werden beim Öffnen der Kontoseite (/account) aktuell geladen.',
  },
  fr: {
    overview:
      'Dans Tedd’mhen, vous pouvez enregistrer un bilan quotidien (/check-in), filtrer votre journal (/journal), explorer les tendances bayésiennes, corrélations et prédictions multivariées (/analysis), exporter ou importer vos données (/export, /import) et consulter vos limites sur la page Compte (/account).\n\n• Commencez par le Bilan quotidien (/check-in) en ne cochant que les mesures observées (les champs non cochés restent null).\n• Ouvrez Tendances et prédictions (/analysis) pour explorer vos séries avec leurs intervalles d’incertitude.',
    checkin:
      'Bilan quotidien (/check-in) :\n1. Choisissez la date locale.\n2. Activez uniquement les échelles 1–10 mesurées aujourd’hui (Bien-être, Énergie, Humeur, Stress, Concentration, Récupération, Courbatures, Qualité du sommeil, Gravité des symptômes).\n3. Notez le sommeil à la date du réveil et la physiologie (VFC/HRV avec sa méthode, fréquence cardiaque au repos, poids).\n4. Indiquez Entraînement, Jour de repos ou Non renseigné. Pour les sports de force, ajoutez exercices, séries, répétitions, charge (kg) et RPE.\n5. Personnalisez l’affichage pour masquer des champs ou enregistrer une routine vierge.',
    habits:
      'Habitudes et activités personnalisées (/check-in#habits) :\n1. Choisissez parmi 40 modèles ou créez votre propre activité.\n2. Notez le nombre quotidien (y compris 0 explicite), les heures HH:mm et la durée en minutes.\n3. Les habitudes suivies sont utilisables dans Relations et dans le Modèle multivarié.',
    analysis:
      'Tendances et prédictions (/analysis) :\n1. Tendance bayésienne (/analysis) : pente hebdomadaire, intervalle de crédibilité à 95 % et probabilité de hausse.\n2. Relations (/analysis/relationships) : corrélations de Pearson et Spearman le jour même ou décalées de 1 à 7 jours.\n3. Modèle multivarié (/analysis/prediction) : régression bayésienne conjuguée avec prévisions exploratoires sur 1 à 28 jours et validation chronologique (MAE, RMSE). Les analyses sont observationnelles.',
    export:
      'Export et import (/export, /import) :\n• Exportez jusqu’à 5 ans parmi 8 groupes de données en JSON, NDJSON, CSV ou Markdown.\n• Importez des fichiers JSON, NDJSON ou CSV après vérification locale en mode Fusionner (Merge) ou Ignorer (Skip).',
    account:
      'Compte et limites (/account) :\n• Connexion par e-mail, mot de passe et code de récupération unique TMH-...\n• Limite quotidienne IA : 30 000 tokens par jour UTC et par compte (max. 4 096 tokens d’entrée et 1 024 de sortie par message ; le collage de code ou de données volumineuses est refusé).\n• Limite de stockage : 10 Mo de données totales par compte. Les deux compteurs sont lus à l’ouverture de la page Compte (/account).',
  },
  pt: {
    overview:
      'No Tedd’mhen pode registar o check-in diário (/check-in), pesquisar e filtrar o diário (/journal), analisar tendências bayesianas, correlações e previsões multivariadas (/analysis), exportar ou importar dados (/export, /import) e consultar a segurança e os limites na página Conta (/account).\n\n• Comece pelo Registo diário (/check-in) marcando apenas o que mediu hoje (campos vazios permanecem null).\n• Abra Tendências e previsões (/analysis) para explorar padrões e intervalos de incerteza.',
    checkin:
      'Registo diário (/check-in):\n1. Escolha a data local.\n2. Ative apenas as escalas de 1–10 observadas hoje (Bem-estar, Energia, Humor, Stress, Foco, Recuperação, Dor muscular, Qualidade do sono, Gravidade de sintomas).\n3. Registe o sono na data em que acordou e a fisiologia (VFC/HRV com o método, frequência cardíaca em repouso, peso).\n4. Defina o estado de treino como Treinou, Dia de descanso ou Não registado. Nos desportos de força pode adicionar exercícios, séries, repetições, carga (kg) e RPE.\n5. Personalize o formulário para ocultar campos ou guardar rotinas em branco.',
    habits:
      'Hábitos e atividades personalizadas (/check-in#habits):\n1. Escolha entre 40 modelos predefinidos ou crie a sua própria atividade.\n2. Registe contagens diárias (incluindo 0 explícito), horários HH:mm e duração em minutos.\n3. Os hábitos registados ficam disponíveis nas Relações e no Modelo multivariado.',
    analysis:
      'Tendências e previsões (/analysis):\n1. Tendência bayesiana (/analysis): declive semanal, intervalo de credibilidade de 95% e probabilidade de tendência crescente.\n2. Relações (/analysis/relationships): correlações de Pearson e Spearman no próprio dia ou com desfasamento de 1–7 dias.\n3. Modelo multivariado (/analysis/prediction): regressão bayesiana conjugada com previsões exploratórias de 1–28 dias e validação cronológica (MAE, RMSE). As análises são observacionais.',
    export:
      'Exportar e importar (/export, /import):\n• Exporte até 5 anos de qualquer um dos 8 grupos de dados em JSON, NDJSON, CSV ou Markdown.\n• Importe ficheiros JSON, NDJSON ou CSV com pré-visualização local e modos Combinar (Merge) ou Ignorar (Skip).',
    account:
      'Conta e limites (/account):\n• Acesso com e-mail, palavra-passe e código único de recuperação TMH-...\n• Limite diário de IA: 30 000 tokens por dia UTC por conta (máx. 4 096 tokens de entrada e 1 024 de saída por mensagem; colar código ou grandes volumes de dados é bloqueado).\n• Limite de armazenamento: 10 MB de dados totais por conta. Ambos os contadores são lidos no momento em que abre a página Conta (/account).',
  },
};

export function buildLocalAssistantReply(
  message: string,
  language: AssistantLanguage,
  pathname = '/',
): string {
  const targetLang = detectLanguage(message, language);
  const topic = detectTopic(message, pathname);
  return localResponses[targetLang][topic];
}
