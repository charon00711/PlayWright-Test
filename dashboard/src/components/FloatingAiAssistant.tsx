import { useEffect, useRef, useState } from 'react';
import { aiChat } from '../api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
};

const STORAGE_KEY = 'pw-ai-assistant-pos';
const HISTORY_KEY = 'pw-ai-assistant-history';
const FAB_SIZE = 56;

type Pos = { x: number; y: number };

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    x: window.innerWidth - FAB_SIZE - 24,
    y: window.innerHeight - FAB_SIZE - 24,
  };
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function clampPos(pos: Pos): Pos {
  const maxX = window.innerWidth - FAB_SIZE;
  const maxY = window.innerHeight - FAB_SIZE;
  return {
    x: Math.max(8, Math.min(maxX - 8, pos.x)),
    y: Math.max(8, Math.min(maxY - 8, pos.y)),
  };
}

export function FloatingAiAssistant() {
  const [pos, setPos] = useState<Pos>(() => loadPos());
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fabRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages]);

  useEffect(() => {
    if (open) listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function startDrag(e: React.PointerEvent) {
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
    fabRef.current?.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    setPos(
      clampPos({
        x: drag.current.origX + dx,
        y: drag.current.origY + dy,
      }),
    );
  }

  function endDrag(e: React.PointerEvent) {
    const moved = drag.current?.moved;
    drag.current = null;
    try {
      fabRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!moved) setOpen((v) => !v);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await aiChat({ message: text, history });
      const reply: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: result.text,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  // Panel is anchored above/left of the FAB depending on its position
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    width: 380,
    height: 480,
    bottom: window.innerHeight - pos.y + 8,
    right: window.innerWidth - pos.x - FAB_SIZE,
    zIndex: 999,
  };

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={`ai-fab${open ? ' open' : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        title="AI 助手（可拖动）"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a2 2 0 0 1-2 2h-1" />
          <path d="M8 13H7a2 2 0 0 1-2-2v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4" />
          <circle cx="9" cy="18" r="2" />
          <circle cx="15" cy="18" r="2" />
          <path d="M9 18h6" />
        </svg>
      </button>

      {open && (
        <div className="ai-fab-panel" style={panelStyle}>
          <div className="ai-fab-header">
            <strong>AI 助手</strong>
            <div className="ai-fab-actions">
              <button
                type="button"
                className="ai-fab-icon-btn"
                onClick={handleClear}
                title="清空对话"
              >
                清空
              </button>
              <button
                type="button"
                className="ai-fab-icon-btn"
                onClick={() => setOpen(false)}
                title="关闭"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="ai-fab-messages">
            {messages.length === 0 && (
              <div className="ai-fab-empty">
                <p>你好！我是平台助手 👋</p>
                <p className="muted">可以问我：</p>
                <ul className="muted">
                  <li>怎么新建一个 @smoke 用例？</li>
                  <li>定时任务的 Cron 表达式怎么写？</li>
                  <li>Playwright 怎么等待元素可见？</li>
                </ul>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`ai-fab-msg ${m.role}`}>
                <div className="ai-fab-msg-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-fab-msg assistant">
                <div className="ai-fab-msg-bubble loading">思考中…</div>
              </div>
            )}
            {error && <div className="alert alert-error">{error}</div>}
            <div ref={listEndRef} />
          </div>

          <form
            className="ai-fab-input"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="submit"
              className="btn primary"
              disabled={loading || !input.trim()}
            >
              发送
            </button>
          </form>
        </div>
      )}
    </>
  );
}
