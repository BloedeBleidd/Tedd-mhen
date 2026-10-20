import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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

function renderInlineMarkdown(text: string, isStreamingTail = false): ReactNode[] {
  let cleaned = text;
  if (isStreamingTail) {
    cleaned = cleaned.replace(/\*+$/, '');
  }
  const nodes: ReactNode[] = [];
  const pattern =
    /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_|(?:\*\*([^*]+)$)|(?:`([^`\n]+)$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(cleaned.slice(lastIndex, match.index));
    }
    const boldText = match[1] ?? match[2] ?? (isStreamingTail ? match[6] : undefined);
    const codeText = match[3] ?? (isStreamingTail ? match[7] : undefined);
    const italicText = match[4] ?? match[5];

    if (boldText !== undefined) {
      nodes.push(<strong key={`md-b-${key++}`}>{boldText}</strong>);
    } else if (codeText !== undefined) {
      nodes.push(<code key={`md-c-${key++}`}>{codeText}</code>);
    } else if (italicText !== undefined) {
      nodes.push(<em key={`md-i-${key++}`}>{italicText}</em>);
    } else {
      nodes.push(match[0]);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    nodes.push(cleaned.slice(lastIndex));
  }
  return nodes;
}

function renderChatMarkdown(content: string, cursorNode?: ReactNode): ReactNode {
  const lines = content.split('\n');
  type Block =
    | { type: 'heading'; text: string }
    | { type: 'ul'; items: string[] }
    | { type: 'ol'; items: string[] }
    | { type: 'p'; lines: string[] };

  const blocks: Block[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (blocks.length > 0 && blocks[blocks.length - 1].type === 'p') {
        blocks.push({ type: 'p', lines: [] });
      }
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', text: headingMatch[1] });
      continue;
    }

    const ulMatch = trimmed.match(/^(?:[-*•])\s+(.*)$/);
    if (ulMatch) {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === 'ul') {
        prev.items.push(ulMatch[1]);
      } else {
        blocks.push({ type: 'ul', items: [ulMatch[1]] });
      }
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === 'ol') {
        prev.items.push(olMatch[1]);
      } else {
        blocks.push({ type: 'ol', items: [olMatch[1]] });
      }
      continue;
    }

    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      continue;
    }

    const prev = blocks[blocks.length - 1];
    if (prev && prev.type === 'p') {
      prev.lines.push(trimmed);
    } else {
      blocks.push({ type: 'p', lines: [trimmed] });
    }
  }

  const nonEmptyBlocks = blocks.filter((b) => (b.type === 'p' ? b.lines.length > 0 : true));
  if (nonEmptyBlocks.length === 0) {
    return <p>{cursorNode}</p>;
  }

  return nonEmptyBlocks.map((block, bIdx) => {
    const isLastBlock = bIdx === nonEmptyBlocks.length - 1;
    const isStreaming = Boolean(cursorNode);

    if (block.type === 'heading') {
      return (
        <h4 key={bIdx} className="ai-md-heading">
          {renderInlineMarkdown(block.text, isStreaming && isLastBlock)}
          {isLastBlock ? cursorNode : null}
        </h4>
      );
    }

    if (block.type === 'ul') {
      return (
        <ul key={bIdx} className="ai-md-list">
          {block.items.map((item, iIdx) => {
            const isLastItem = isLastBlock && iIdx === block.items.length - 1;
            return (
              <li key={iIdx}>
                {renderInlineMarkdown(item, isStreaming && isLastItem)}
                {isLastItem ? cursorNode : null}
              </li>
            );
          })}
        </ul>
      );
    }

    if (block.type === 'ol') {
      return (
        <ol key={bIdx} className="ai-md-list">
          {block.items.map((item, iIdx) => {
            const isLastItem = isLastBlock && iIdx === block.items.length - 1;
            return (
              <li key={iIdx}>
                {renderInlineMarkdown(item, isStreaming && isLastItem)}
                {isLastItem ? cursorNode : null}
              </li>
            );
          })}
        </ol>
      );
    }

    return (
      <p key={bIdx}>
        {block.lines.map((line, lIdx) => {
          const isLastLine = isLastBlock && lIdx === block.lines.length - 1;
          return (
            <span key={lIdx}>
              {lIdx > 0 ? '\n' : ''}
              {renderInlineMarkdown(line, isStreaming && isLastLine)}
            </span>
          );
        })}
        {isLastBlock ? cursorNode : null}
      </p>
    );
  });
}

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
        let cursor = 0;
        const full = chatResponse.reply;
        while (cursor < full.length) {
          cursor = Math.min(
            full.length,
            cursor + Math.max(3, Math.ceil((full.length - cursor) / 14)),
          );
          flushSync(() => setStreamingReply(full.slice(0, cursor)));
          await new Promise((resolve) => setTimeout(resolve, 14));
        }
        setStreamingReply('');
        setMessages([...nextMessages, { role: 'assistant', content: full }]);
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
      let sseBuffer = '';
      let streamBuffer = '';
      let finalReply = '';
      let finalUsedToday: number | null = null;
      let networkDone = false;
      let streamError: Error | null = null;

      // Read network SSE chunks and append immediately to streamBuffer
      const readerPromise = (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith('data:')) continue;
              const dataStr = line.slice(5).trim();
              if (!dataStr) continue;
              const event = JSON.parse(dataStr) as StreamEvent;
              if (event.type === 'delta' && event.delta) {
                streamBuffer += event.delta;
              } else if (event.type === 'done') {
                finalReply = event.reply;
                if (!streamBuffer) streamBuffer = event.reply;
                finalUsedToday = event.usage.usedTokensToday;
              } else if (event.type === 'error') {
                streamError = new Error(event.error);
              }
            }
          }
        } catch (err) {
          streamError = err instanceof Error ? err : new Error('Request failed.');
        } finally {
          networkDone = true;
        }
      })();

      // Concurrently paint received characters onto the screen frame-by-frame
      let displayedCursor = 0;
      while (!networkDone || displayedCursor < streamBuffer.length) {
        if (streamError) throw streamError;
        if (displayedCursor < streamBuffer.length) {
          const backlog = streamBuffer.length - displayedCursor;
          const step = Math.max(2, Math.ceil(backlog / 10));
          displayedCursor = Math.min(streamBuffer.length, displayedCursor + step);
          const visibleSlice = streamBuffer.slice(0, displayedCursor);
          flushSync(() => setStreamingReply(visibleSlice));
        }
        await new Promise((resolve) => setTimeout(resolve, 14));
      }

      await readerPromise;
      if (streamError) throw streamError;

      const completedText = (finalReply || streamBuffer).trim();
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

  const cursorElement = (
    <span className="ai-stream-cursor" aria-hidden="true">
      ▍
    </span>
  );

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
              {message.role === 'assistant' ? (
                renderChatMarkdown(message.content)
              ) : (
                <p>{message.content}</p>
              )}
            </article>
          ))}
          {busy && (
            <article className="ai-chat-bubble assistant-streaming">
              {streamingReply ? (
                renderChatMarkdown(streamingReply, cursorElement)
              ) : (
                <p>
                  <span className="muted ai-thinking-label">{tr('assistant:sending')}</span>
                  {cursorElement}
                </p>
              )}
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
