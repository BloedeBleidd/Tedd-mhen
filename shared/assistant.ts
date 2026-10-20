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
    `You are the built-in AI product guide for Tedd’mhen, a private training, sleep, habits, and wellbeing journal.`,
    `Active interface language: ${languageLabels[language]} (${language}). Current screen: ${pathname}.`,
    `Always reply in the language of the user's message; if unclear, reply in ${languageLabels[language]}. You speak English (en), Polish (pl), Spanish (es), German (de), French (fr), and Portuguese (pt).`,
    `TONE & STYLE: Speak like a warm, polished, customer-facing SaaS product assistant. Never sound like developer documentation or internal release notes. Refer to screens and features by their human names in the user's language (e.g., Daily check-in / Codzienny wpis, Journal / Dziennik, Trends & predictions / Trendy i predykcje, Account / Konto) rather than raw URL paths or database terms (avoid saying "null", "D1", or "route").`,
    `OUTPUT LENGTH RULE: Your maximum output is strictly ${maxOutputTokens} tokens for this reply. You know this limit in advance—plan your answer so it is concise, complete, and finishes naturally with a full concluding sentence well within ${maxOutputTokens} tokens (aim for 150–600 tokens). Never leave a sentence or bullet list unfinished.`,
    `Product guide knowledge:`,
    `1. Overview: shows the last 28 days of recorded metrics, quick stats, recent check-ins, and shortcuts to Daily Check-in, Journal, and Trends & predictions.`,
    `2. Daily check-in: pick the calendar date; record 1–10 ratings with clear low/high descriptions (Wellbeing, Energy, Mood, Stress, Motivation, Focus, Recovery, Soreness, Sleep quality, Illness severity)—only check the metrics you actually observed today and leave unmeasured ones unchecked so they are not treated as zero; set training status (Trained, Rest day, or Not recorded); add up to 20 workouts across 150 sports (strength sports support exercises, sets, reps, weight in kg, and RPE; session load = duration × effort); log 40 preset habits or your own custom activities with counts, times, and durations; use "Customize my check-in" to hide unused fields or save a recurring daily routine.`,
    `3. Journal: filter saved days by date range, text search, activity type, habit, or illness status, and open any day to review, edit, or delete it.`,
    `4. Trends & predictions: (a) Single-metric trend estimates your weekly direction, 95% credible interval, and probability of an upward trend; (b) Relationships compares an outcome against other measurements on the same day or 1–7 days later using linear (Pearson) and rank (Spearman) correlations; (c) Multivariable model combines multiple habits, sleep, and training inputs to generate 1–28 day exploratory forecasts and accuracy metrics (MAE, RMSE); (d) Definitions & methods explains every scale and calculation.`,
    `5. Export & import: export up to 5 years at a time across 8 data groups (ratings, sleep, physiology, symptoms, workouts, notes, context, habits) as JSON, NDJSON, CSV, or Markdown; import JSON/NDJSON/CSV files with a preview and merge or skip modes.`,
    `6. Account & limits: sign in with email and password and store your one-time TMH-... recovery code in a password manager (no emails are sent). Each account includes 30,000 AI guide tokens per UTC day (up to 4,096 input tokens and 1,024 output tokens per message) and 10 MB of journal storage space, visible in Account.`,
    `7. Privacy & appearance: your private journal entries are never sent to the AI guide; analyses are observational and exploratory, not medical advice. Appearance supports Light, Dark, and Auto (sunrise/sunset).`,
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
      'Welcome to Tedd’mhen! Here is how to get started:\n\n• Daily check-in: log your sleep, wellbeing ratings, workouts, and daily habits in a couple of minutes.\n• Journal: browse, search, and filter your past days.\n• Trends & predictions: discover how your sleep, training load, and habits relate to your recovery and mood over time.\n• Export & import: download portable backups of your journal whenever you want.',
    checkin:
      'How to log a Daily check-in:\n1. Pick the calendar date at the top of the page.\n2. Rate only the 1–10 scales you observed today (such as Wellbeing, Energy, Mood, Stress, Focus, Recovery, Soreness, or Sleep quality). Leave any unmeasured scale unchecked so it is simply skipped rather than counted as zero.\n3. Enter your sleep on the morning you woke up, plus optional physiology metrics like HRV, resting heart rate, or weight.\n4. Set your training status to Trained, Rest day, or Not recorded. When you trained, choose from 150 sports—for strength workouts you can log exercises, sets, reps, weight, and RPE.\n5. Click "Customize my check-in" to hide fields you do not use or set up a daily routine.',
    habits:
      'Tracking habits and routines:\n1. In the Habits section of Daily check-in, choose from 40 built-in habits (such as caffeine, reading before bed, meditation, or cold exposure) or add your own custom activity.\n2. For each habit, you can log how many times you did it (including 0 when you intentionally skipped it), the time of day, and duration.\n3. Add your regular habits to your daily routine so they appear ready to fill in each morning.\n4. Once logged over several days, your habits can be compared directly with sleep and recovery in Trends & predictions.',
    analysis:
      'Exploring what affects your sleep, recovery, and wellbeing:\n1. Trends: see whether a metric is trending upward or downward over time, along with its uncertainty range.\n2. Relationships: compare any metric against your habits, sleep, or training load on the same day or 1–7 days later to spot delayed effects (for example, how late workouts or caffeine relate to next-day recovery).\n3. Multivariable forecast: combine multiple habits and sleep metrics to explore 1–28 day projections.\n\nAll charts and models are observational tools to help you reflect on your personal patterns, not medical advice.',
    export:
      'Backing up, exporting, and importing your journal:\n• Export: open Export to download up to 5 years of entries at a time. You can include all data or pick specific groups (ratings, sleep, physiology, workouts, habits, notes) in JSON, NDJSON, CSV, or Markdown format.\n• Import: open Import to restore or add entries from a JSON, NDJSON, or CSV file. You will see a full preview before saving and can choose whether to merge with existing days or skip dates you already logged.',
    account:
      'Managing your account and limits:\n• Security & recovery: your account uses your email, password, and a one-time TMH-... recovery code. Because Tedd’mhen does not send recovery emails, keep your recovery code in a password manager.\n• Fair-use allowance: your account includes 30,000 AI guide tokens per day (up to 4,096 input and 1,024 output tokens per message) and 10 MB of journal storage space, which you can check anytime on the Account page.',
  },
  pl: {
    overview:
      'Witaj w Tedd’mhen! Oto jak najlepiej korzystać z aplikacji:\n\n• Codzienny wpis: w kilka chwil zapiszesz sen, samopoczucie, treningi oraz codzienne nawyki.\n• Dziennik: wygodnie przeszukasz i przefiltrujesz swoją historię.\n• Trendy i predykcje: sprawdzisz, jak sen, obciążenie treningowe i nawyki łączą się z Twoją regeneracją i energią.\n• Eksport i import: w każdej chwili pobierzesz pełną kopię zapasową swoich danych.',
    checkin:
      'Jak wypełnić Codzienny wpis:\n1. Wybierz datę z kalendarza u góry ekranu.\n2. Zaznacz tylko te skale 1–10, które chcesz dziś ocenić (np. Samopoczucie, Energia, Nastrój, Stres, Skupienie, Regeneracja, Bolesność, Jakość snu). Pól, których danego dnia nie mierzysz, po prostu nie zaznaczaj — zostaną pominięte w statystykach zamiast zaniżać średnią.\n3. Zapisz sen w dniu przebudzenia oraz opcjonalne pomiary fizjologiczne (HRV, tętno spoczynkowe, masa ciała).\n4. Wybierz status treningowy: Trening, Dzień odpoczynku lub Niezapisane. Przy treningu masz do wyboru 150 dyscyplin, a w sportach siłowych możesz dodać ćwiczenia, serie, powtórzenia, ciężar i RPE.\n5. Kliknij „Dostosuj mój wpis”, aby ukryć nieużywane sekcje lub ustawić stałą rutynę dnia.',
    habits:
      'Jak śledzić własne nawyki i dopasować rutynę dnia:\n1. W sekcji Nawyków podczas codziennego wpisu możesz wybrać spośród 40 gotowych propozycji (np. kawa, czytanie przed snem, ekspozycja na zimno, medytacja) lub dodać własną aktywność.\n2. Dla każdego nawyku możesz zapisać liczbę powtórzeń (również 0, gdy celowo czegoś unikasz), godzinę oraz czas trwania.\n3. Dodaj powtarzalne nawyki do swojej rutyny dnia, aby każdego ranka czekały gotowe do uzupełnienia.\n4. Zapisywane nawyki możesz później zestawić ze snem i samopoczuciem w zakładce Trendy i predykcje.',
    analysis:
      'Jak sprawdzić, co wpływa na Twój sen, regenerację i samopoczucie:\n1. Trendy: sprawdź w zakładce Trendy i predykcje, czy wybrany wskaźnik rośnie lub spada w kolejnych tygodniach.\n2. Zależności: porównaj samopoczucie lub jakość snu z treningami i nawykami z tego samego dnia albo z opóźnieniem 1–7 dni — dzięki temu zobaczysz np. jak ciężki trening czy późny posiłek wpływa na regenerację kolejnego dnia.\n3. Prognozy wielowymiarowe: połącz kilka czynników naraz, aby zobaczyć orientacyjną prognozę na kolejne 1–28 dni.\n\nWszystkie wykresy służą do odkrywania własnych wzorców i nie zastępują porady lekarskiej.',
    export:
      'Jak pobrać kopię zapasową lub zaimportować dane:\n• Eksport: w zakładce Eksport wybierz zakres dat (do 5 lat naraz), zaznacz interesujące Cię sekcje (oceny, sen, fizjologia, treningi, nawyki, notatki) i pobierz plik w formacie JSON, NDJSON, CSV lub Markdown.\n• Import: w zakładce Import wczytaj plik JSON, NDJSON lub CSV. Przed zapisaniem zobaczysz podgląd zmian i zdecydujesz, czy połączyć dane z istniejącymi wpisami, czy pominąć uzupełnione już dni.',
    account:
      'Konto, bezpieczeństwo i pakiet zasobów:\n• Bezpieczeństwo: logujesz się za pomocą e-maila i hasła, a jednorazowy kod odzyskiwania TMH-... pozwala odzyskać dostęp bez wysyłania wiadomości e-mail (warto zapisać go w menedżerze haseł).\n• Pakiet zasobów: do konta przypisane jest 30 000 tokenów przewodnika AI dziennie oraz 10 MB przestrzeni na dane dziennika. Bieżące wykorzystanie sprawdzisz w każdej chwili w zakładce Konto.',
  },
  es: {
    overview:
      '¡Bienvenido a Tedd’mhen! Así puedes aprovechar la aplicación:\n\n• Control diario: registra tu sueño, bienestar, entrenamientos y hábitos en pocos minutos.\n• Diario: busca y filtra tu historial por fechas, deportes o hábitos.\n• Tendencias y predicciones: descubre cómo influyen tus hábitos y entrenamientos en tu descanso y recuperación.\n• Exportar e importar: descarga copias de seguridad completas cuando quieras.',
    checkin:
      'Cómo registrar tu Control diario:\n1. Elige la fecha en la parte superior.\n2. Activa solo las escalas del 1 al 10 que quieras valorar hoy (Bienestar, Energía, Ánimo, Estrés, Enfoque, Recuperación, Dolor muscular, Calidad del sueño). Deja sin marcar lo que no hayas medido.\n3. Anota el sueño en el día en que despertaste y tus datos fisiológicos opcionales (VFC/HRV, pulso en reposo, peso).\n4. Indica si entrenaste, descansaste o prefieres dejarlo sin registrar. Puedes elegir entre 150 deportes y detallar series, peso y RPE en ejercicios de fuerza.\n5. Usa las opciones de personalización para ocultar campos o fijar tu rutina habitual.',
    habits:
      'Cómo seguir tus hábitos y personalizar tu rutina:\n1. Elige entre 40 hábitos predefinidos o crea tus propias actividades personalizadas.\n2. Registra cuántas veces realizaste cada hábito (incluido 0), la hora y la duración.\n3. Guarda tus hábitos frecuentes en tu rutina diaria para tenerlos listos cada mañana.\n4. Analiza cómo se relacionan tus hábitos con tu sueño y energía en Tendencias y predicciones.',
    analysis:
      'Cómo ver qué influye en tu sueño, recuperación y bienestar:\n1. Tendencias: observa la evolución semanal de cualquier indicador junto con su margen de incertidumbre.\n2. Relaciones: compara tu bienestar o descanso con tus entrenamientos y hábitos del mismo día o de 1 a 7 días antes.\n3. Pronóstico multivariable: combina varios factores para explorar proyecciones de 1 a 28 días.\n\nLos análisis son orientativos para conocer tus propios patrones y no sustituyen el consejo médico.',
    export:
      'Cómo hacer una copia de seguridad o importar tus datos:\n• Exportar: elige un rango de hasta 5 años, selecciona los grupos de datos que quieras conservar y descárgalos en JSON, NDJSON, CSV o Markdown.\n• Importar: carga un archivo JSON, NDJSON o CSV con vista previa antes de guardar y elige si deseas combinar los datos o conservar intactos los días ya existentes.',
    account:
      'Cuenta, seguridad y recursos:\n• Seguridad: accedes con tu correo y contraseña, y dispones de un código único de recuperación TMH-... que conviene guardar en tu gestor de contraseñas.\n• Recursos de la cuenta: dispones de 30 000 tokens diarios para la guía de IA y 10 MB de espacio para tu diario, visibles en la página Cuenta.',
  },
  de: {
    overview:
      'Willkommen bei Tedd’mhen! So nutzt du die App optimal:\n\n• Täglicher Check-in: Erfasse Schlaf, Wohlbefinden, Training und Gewohnheiten in wenigen Minuten.\n• Tagebuch: Durchsuche und filtere deine bisherigen Einträge.\n• Trends & Prognosen: Erkenne, wie Schlaf, Trainingsbelastung und Gewohnheiten mit deiner Erholung zusammenhängen.\n• Export & Import: Erstelle jederzeit ein vollständiges Backup deiner Daten.',
    checkin:
      'So erfasst du deinen täglichen Check-in:\n1. Wähle oben das gewünschte Datum.\n2. Aktiviere nur die 1–10-Skalen, die du heute bewerten möchtest (z. B. Wohlbefinden, Energie, Stimmung, Stress, Fokus, Erholung, Muskelkater, Schlafqualität). Nicht gemessene Felder lässt du einfach deaktiviert.\n3. Trage deinen Schlaf am Aufwachtag sowie optionale Werte wie HRV, Ruhepuls oder Gewicht ein.\n4. Wähle deinen Trainingsstatus (Trainiert, Ruhetag oder Nicht erfasst). Bei 150 Sportarten kannst du im Krafttraining auch Übungen, Sätze, Gewicht und RPE festhalten.\n5. Passe das Formular an, um ungenutzte Felder auszublenden oder eine tägliche Routine festzulegen.',
    habits:
      'Eigene Gewohnheiten verfolgen und deine Routine anpassen:\n1. Wähle aus 40 Vorlagen oder lege eigene Aktivitäten an.\n2. Erfasse Häufigkeit (auch 0 beim bewussten Auslassen), Uhrzeit und Dauer.\n3. Füge regelmäßige Gewohnheiten zu deiner Routine hinzu, damit sie jeden Tag bereitstehen.\n4. In Trends & Prognosen siehst du anschließend, wie deine Gewohnheiten mit Schlaf und Erholung zusammenhängen.',
    analysis:
      'Erkennen, was Schlaf, Erholung und Wohlbefinden beeinflusst:\n1. Trends: Prüfe, wie sich ein Wert über die Wochen entwickelt.\n2. Zusammenhänge: Vergleiche Wohlbefinden oder Schlaf mit Training und Gewohnheiten vom selben Tag oder mit 1–7 Tagen Verzögerung.\n3. Mehrvariablen-Prognose: Kombiniere mehrere Einflussfaktoren für eine 1–28-Tage-Vorschau.\n\nAlle Auswertungen dienen der persönlichen Orientierung und ersetzen keine medizinische Beratung.',
    export:
      'Backup erstellen oder Tagebuchdaten importieren:\n• Export: Lade bis zu 5 Jahre als JSON, NDJSON, CSV oder Markdown herunter — komplett oder nach Kategorien gefiltert.\n• Import: Prüfe JSON-, NDJSON- oder CSV-Dateien in der Vorschau und führe sie mit bestehenden Einträgen zusammen oder überspringe vorhandene Tage.',
    account:
      'Konto, Sicherheit und Kontingente:\n• Sicherheit: Du meldest dich mit E-Mail und Passwort an und erhältst einen einmaligen Wiederherstellungscode (TMH-...), den du im Passwort-Manager sichern solltest.\n• Kontingente: Dein Konto umfasst täglich 30.000 KI-Leitfaden-Tokens sowie 10 MB Speicherplatz für dein Tagebuch, einsehbar auf der Kontoseite.',
  },
  fr: {
    overview:
      'Bienvenue sur Tedd’mhen ! Voici comment profiter pleinement de l’application :\n\n• Bilan quotidien : notez votre sommeil, votre bien-être, vos séances et vos habitudes en quelques minutes.\n• Journal : recherchez et filtrez facilement vos journées passées.\n• Tendances et prédictions : observez comment le sommeil, l’entraînement et vos habitudes influencent votre récupération.\n• Export et import : téléchargez une sauvegarde complète à tout moment.',
    checkin:
      'Comment enregistrer votre bilan quotidien :\n1. Choisissez la date en haut de la page.\n2. Cochez uniquement les échelles de 1 à 10 que vous souhaitez évaluer aujourd’hui (Bien-être, Énergie, Humeur, Stress, Concentration, Récupération, Courbatures, Qualité du sommeil).\n3. Renseignez votre sommeil le jour du réveil ainsi que vos mesures physiologiques facultatives (VFC/HRV, fréquence cardiaque au repos, poids).\n4. Indiquez Entraînement, Jour de repos ou Non renseigné. Parmi 150 sports, les activités de force permettent d’ajouter exercices, séries, répétitions, charge et RPE.\n5. Personnalisez le formulaire pour masquer les champs inutilisés ou préparer votre routine quotidienne.',
    habits:
      'Suivre vos habitudes et personnaliser votre routine :\n1. Choisissez parmi 40 habitudes prédéfinies ou créez vos propres activités.\n2. Notez le nombre d’occurrences (y compris 0), l’heure et la durée.\n3. Ajoutez vos habitudes régulières à votre routine pour les retrouver prêtes chaque matin.\n4. Comparez ensuite vos habitudes avec votre sommeil et votre forme dans Tendances et prédictions.',
    analysis:
      'Comprendre ce qui influence votre sommeil, votre récupération et votre bien-être :\n1. Tendances : visualisez l’évolution hebdomadaire d’un indicateur et sa marge d’incertitude.\n2. Relations : comparez votre forme ou votre sommeil avec vos séances et habitudes du jour même ou des 1 à 7 jours précédents.\n3. Prévisions multivariées : combinez plusieurs facteurs pour explorer des projections sur 1 à 28 jours.\n\nCes outils vous aident à explorer vos propres rythmes et ne remplacent pas un avis médical.',
    export:
      'Sauvegarder, exporter ou importer votre journal :\n• Export : téléchargez jusqu’à 5 ans de données en JSON, NDJSON, CSV ou Markdown en choisissant les catégories souhaitées.\n• Import : prévisualisez vos fichiers JSON, NDJSON ou CSV avant de les fusionner avec vos entrées ou d’ignorer les dates déjà présentes.',
    account:
      'Compte, sécurité et forfaits :\n• Sécurité : connectez-vous avec votre e-mail et votre mot de passe, et conservez votre code de récupération unique TMH-... dans un gestionnaire de mots de passe.\n• Forfaits du compte : vous disposez de 30 000 jetons quotidiens pour le guide IA et de 10 Mo d’espace pour votre journal, consultables sur la page Compte.',
  },
  pt: {
    overview:
      'Bem-vindo ao Tedd’mhen! Veja como tirar o máximo partido da aplicação:\n\n• Registo diário: registe o sono, bem-estar, treinos e hábitos em poucos minutos.\n• Diário: pesquise e filtre o seu histórico por datas, desportos ou hábitos.\n• Tendências e previsões: descubra como o sono, a carga de treino e os hábitos influenciam a sua recuperação.\n• Exportar e importar: descarregue cópias de segurança completas sempre que quiser.',
    checkin:
      'Como fazer o seu Registo diário:\n1. Escolha a data no topo da página.\n2. Ative apenas as escalas de 1 a 10 que pretende avaliar hoje (Bem-estar, Energia, Humor, Stress, Foco, Recuperação, Dor muscular, Qualidade do sono).\n3. Registe o sono no dia em que acordou e as medições fisiológicas opcionais (VFC/HRV, frequência cardíaca em repouso, peso).\n4. Defina o estado de treino como Treinou, Dia de descanso ou Não registado. Entre 150 desportos, os treinos de força permitem detalhar exercícios, séries, repetições, carga e RPE.\n5. Personalize o formulário para ocultar campos que não utiliza ou guardar a sua rotina diária.',
    habits:
      'Como acompanhar hábitos personalizados e ajustar a sua rotina:\n1. Escolha entre 40 hábitos predefinidos ou crie a sua própria atividade.\n2. Registe a frequência diária (incluindo 0), o horário e a duração.\n3. Adicione os hábitos frequentes à sua rotina para estarem prontos a preencher todas as manhãs.\n4. Analise o impacto dos seus hábitos no sono e no bem-estar em Tendências e previsões.',
    analysis:
      'Como ver o que influencia o seu sono, recuperação e bem-estar:\n1. Tendências: acompanhe a evolução semanal de qualquer indicador com o respetivo intervalo de incerteza.\n2. Relações: compare o seu bem-estar ou sono com treinos e hábitos do próprio dia ou de 1 a 7 dias antes.\n3. Previsão multivariada: combine vários fatores para explorar projeções de 1 a 28 dias.\n\nTodas as análises servem para explorar os seus próprios padrões e não substituem aconselhamento médico.',
    export:
      'Como fazer uma cópia de segurança ou importar os seus dados:\n• Exportar: descarregue até 5 anos de registos em JSON, NDJSON, CSV ou Markdown, escolhendo as categorias pretendidas.\n• Importar: pré-visualize ficheiros JSON, NDJSON ou CSV antes de guardar e escolha entre combinar com os dias existentes ou ignorar datas já preenchidas.',
    account:
      'Conta, segurança e limites:\n• Segurança: inicie sessão com e-mail e palavra-passe e guarde o seu código único de recuperação TMH-... num gestor de palavras-passe.\n• Limites da conta: dispõe de 30 000 tokens diários no guia de IA e 10 MB de espaço para o seu diário, visíveis na página Conta.',
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
