import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquareText, Send, Sparkles, Trash2, X } from 'lucide-react';
import { locale, t as tr } from '../i18n';
import { useApi } from '../lib/api';
import { useLanguage } from '../lib/language-context';
import {
  AI_DAILY_TOKEN_LIMIT,
  AI_MAX_INPUT_TOKENS,
  estimateTokens,
  isBulkCodeOrData,
  type AccountUsage,
  type AssistantChatResponse,
  type AssistantMessage,
} from '../../shared/assistant';
import { ErrorBox } from './ui';

type StreamEvent =
  | { type: 'delta'; delta: string }
  | ({ type: 'done' } & AssistantChatResponse)
  | { type: 'error'; error: string };

export function AiAssistant() {
  useTranslation();
  const { language } = useLanguage();
  const { request, response, demo } = useApi();
  const location = useLocation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [streamingReply, setStreamingReply] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [usedToday, setUsedToday] = useState<number>(0);

  const fmt = (value: number) => value.toLocaleString(locale());
  const draftTokens = estimateTokens(draft);
  const overInputLimit = draftTokens > AI_MAX_INPUT_TOKENS;
  const pathname = demo
    ? location.pathname.replace(/^\/demo(?=\/|$)/, '') || '/'
    : location.pathname;

  async function refreshQuota() {
    try {
      const usage = await request<AccountUsage>('/api/account/usage');
      setUsedToday(usage.ai.usedTokensToday);
    } catch {
      // Ignore background quota read failures in the floating widget.
    }
  }

  function openDialog() {
    setError('');
    dialogRef.current?.showModal();
    void refreshQuota();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    const handleOpen = () => openDialog();
    window.addEventListener('teddmhen:open-assistant', handleOpen);
    return () => window.removeEventListener('teddmhen:open-assistant', handleOpen);
  });

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, streamingReply, busy]);

  async function sendQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError('');
    if (estimateTokens(trimmed) > AI_MAX_INPUT_TOKENS) {
      setError(
        'Your message exceeds the 4,096-token input limit. Shorten your question and try again.',
      );
      return;
    }
    if (isBulkCodeOrData(trimmed)) {
      setError(
        'The AI guide answers questions about using Tedd’mhen. Pasting source code, exports, or bulk data is not allowed.',
      );
      return;
    }
    const priorHistory = messages.slice(-6);
    const nextMessages: AssistantMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setStreamingReply('');
    setDraft('');
    setBusy(true);
    try {
      const payload = JSON.stringify({
        message: trimmed,
        language,
        pathname,
        history: priorHistory,
      });

      if (demo) {
        const chatResponse = await request<AssistantChatResponse>('/api/chat', {
          method: 'POST',
          body: payload,
        });
        let partial = '';
        for (const piece of chatResponse.reply.match(/.{1,12}/gs) || [chatResponse.reply]) {
          partial += piece;
          flushSync(() => setStreamingReply(partial));
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
        setStreamingReply('');
        setMessages([...nextMessages, { role: 'assistant', content: chatResponse.reply }]);
        setUsedToday(chatResponse.usage.usedTokensToday);
        window.dispatchEvent(new CustomEvent('teddmhen:usage-updated'));
        return;
      }

      const streamRes = await response('/api/chat', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        body: payload,
      });

      if (
        !streamRes.body ||
        !streamRes.headers.get('content-type')?.includes('text/event-stream')
      ) {
        const jsonRes = (await streamRes.json()) as AssistantChatResponse;
        setMessages([...nextMessages, { role: 'assistant', content: jsonRes.reply }]);
        setUsedToday(jsonRes.usage.usedTokensToday);
        window.dispatchEvent(new CustomEvent('teddmhen:usage-updated'));
        return;
      }

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let finalReply = '';
      let finalUsedToday: number | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;
          const event = JSON.parse(dataStr) as StreamEvent;
          if (event.type === 'delta' && event.delta) {
            accumulated += event.delta;
            flushSync(() => setStreamingReply(accumulated));
          } else if (event.type === 'done') {
            finalReply = event.reply;
            finalUsedToday = event.usage.usedTokensToday;
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }
      }

      const completedText = (finalReply || accumulated).trim();
      setStreamingReply('');
      setMessages([...nextMessages, { role: 'assistant', content: completedText }]);
      if (finalUsedToday !== null) setUsedToday(finalUsedToday);
      window.dispatchEvent(new CustomEvent('teddmhen:usage-updated'));
    } catch (cause) {
      setStreamingReply('');
      setMessages(messages);
      setDraft(trimmed);
      setError(cause instanceof Error ? cause.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendQuestion(draft);
  }

  const starters = [
    tr('assistant:promptCheckIn'),
    tr('assistant:promptHabits'),
    tr('assistant:promptAnalysis'),
    tr('assistant:promptQuotas'),
  ];

  return (
    <>
      <button
        type="button"
        className="ai-chat-fab"
        aria-label={tr('assistant:open')}
        title={tr('assistant:open')}
        onClick={openDialog}
      >
        <Sparkles size={18} aria-hidden="true" />
        <span>{tr('assistant:open')}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="appearance-dialog ai-chat-dialog"
        aria-labelledby="ai-assistant-title"
      >
        <div className="dialog-heading">
          <div className="ai-chat-title-row">
            <MessageSquareText size={20} aria-hidden="true" />
            <h2 id="ai-assistant-title">{tr('assistant:title')}</h2>
          </div>
          <div className="ai-chat-header-actions">
            {messages.length > 0 && (
              <button
                type="button"
                className="icon-button"
                aria-label={tr('assistant:clear')}
                title={tr('assistant:clear')}
                disabled={busy}
                onClick={() => {
                  setMessages([]);
                  setStreamingReply('');
                  setError('');
                }}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              aria-label={tr('assistant:close')}
              onClick={() => dialogRef.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="muted ai-chat-subtitle">{tr('assistant:subtitle')}</p>
        <div className="ai-chat-quotas" role="status">
          <span className={overInputLimit ? 'quota-warn' : ''}>
            {tr('assistant:inputTokensCounter', {
              used: fmt(draftTokens),
              limit: fmt(AI_MAX_INPUT_TOKENS),
            })}
          </span>
          <span>
            {tr('assistant:dailyTokensCounter', {
              used: fmt(usedToday),
              limit: fmt(AI_DAILY_TOKEN_LIMIT),
            })}
          </span>
        </div>
        <div ref={logRef} className="ai-chat-log" aria-live="polite">
          <article className="ai-chat-bubble assistant">
            <p>{tr('assistant:greeting')}</p>
          </article>
          {messages.length === 0 && !busy && (
            <div className="ai-chat-starters">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="button secondary small-button ai-starter-button"
                  disabled={busy}
                  onClick={() => void sendQuestion(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {messages.map((message, index) => (
            <article key={index} className={`ai-chat-bubble ${message.role}`}>
              <p>{message.content}</p>
            </article>
          ))}
          {busy && (
            <article className="ai-chat-bubble assistant-streaming">
              <p>
                {streamingReply}
                <span className="ai-stream-cursor" aria-hidden="true">
                  ▍
                </span>
              </p>
            </article>
          )}
        </div>
        <ErrorBox message={error} />
        <form className="ai-chat-form" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="ai-assistant-input">
            {tr('assistant:questionLabel')}
          </label>
          <textarea
            id="ai-assistant-input"
            ref={inputRef}
            rows={2}
            value={draft}
            disabled={busy}
            placeholder={tr('assistant:placeholder')}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion(draft);
              }
            }}
          />
          <div className="ai-chat-footer">
            <small className="muted">{tr('assistant:noCodeNotice')}</small>
            <button
              type="submit"
              className="button primary small-button"
              disabled={busy || !draft.trim() || overInputLimit}
            >
              <Send size={15} aria-hidden="true" />
              <span>{busy ? tr('assistant:sending') : tr('assistant:send')}</span>
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
