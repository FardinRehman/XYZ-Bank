import { useCallback, useEffect, useState, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, BookOpen, Building2, CheckCircle2, ChevronDown, Clock3, FileText, Headphones, LayoutDashboard, LogOut, Menu, PhoneCall, Search, ShieldCheck, Ticket, Users, Wifi, AlertTriangle, RefreshCw, Plus, X, Mic, MicOff, PhoneOff, Send, Volume2, VolumeX, Sparkles, Key, ExternalLink, Check, Languages, Globe } from 'lucide-react';
import { api, login, getToken, type User, startSimulationCall, sendSimulationMessage, sendSimulationAudio, endSimulationCall, synthesizeSpeechApi, type SimCall, getStoredGeminiKey, setStoredGeminiKey, getGeminiStatus, testGeminiApiKey, isStandaloneMode } from './api';

type Summary = { calls: { total: number; active: number; last24h: number; transferred: number }; tickets: { open: number }; knowledge: { published: number }; failures: { failures: number }; dataMode: string };
type Call = { id: string; provider_call_id: string | null; status: string; from_number_masked: string | null; to_number_masked: string | null; started_at: string; duration_seconds: number | null; resolution: string | null; escalation_reason: string | null };
type Ticket = { id: string; reference_code: string; category: string; subject: string; status: string; priority: string; created_at: string; assigned_to: string | null };
type Article = { id: string; title: string; category: string; content: string; status: string; updated_at: string };
type Page = 'Overview' | 'Calls' | 'Support tickets' | 'Knowledge base' | 'Audit log';

const nav: { name: Page; icon: any }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Calls', icon: PhoneCall },
  { name: 'Support tickets', icon: Ticket },
  { name: 'Knowledge base', icon: BookOpen },
  { name: 'Audit log', icon: ShieldCheck }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>('Overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [showArticle, setShowArticle] = useState(false);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleCategory, setArticleCategory] = useState('general');
  const [articleContent, setArticleContent] = useState('');
  const [showTicket, setShowTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [showSimulator, setShowSimulator] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError('');
    try {
      const me = await api<{ user: User }>('/api/auth/me');
      setUser(me.user);
      const s = await api<Summary>('/api/dashboard/summary');
      setSummary(s);
      const c = await api<{ calls: Call[] }>('/api/dashboard/calls');
      setCalls(c.calls);
      const t = await api<{ tickets: Ticket[] }>('/api/dashboard/tickets');
      setTickets(t.tickets);
      const a = await api<{ articles: Article[] }>('/api/knowledge');
      setArticles(a.articles);
      if (me.user.role === 'SUPER_ADMIN' || me.user.role === 'SUPERVISOR' || me.user.role === 'AUDITOR') {
        const au = await api<{ events: any[] }>('/api/dashboard/audit');
        setAudit(au.events);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load dashboard');
      if (String(e).includes('session') || String(e).includes('Authentication')) {
        localStorage.removeItem('xyz_token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) void load();
  }, [load]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    try {
      await login(String(fd.get('email')), String(fd.get('password')));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function createArticle(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/knowledge', { method: 'POST', body: JSON.stringify({ title: articleTitle, category: articleCategory, content: articleContent, status: 'DRAFT' }) });
      setShowArticle(false);
      setArticleTitle('');
      setArticleContent('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create article');
    }
  }

  async function createTicket(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/tickets', { method: 'POST', body: JSON.stringify({ category: ticketCategory, subject: ticketSubject, description: ticketDescription, priority: 'NORMAL' }) });
      setShowTicket(false);
      setTicketSubject('');
      setTicketDescription('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create ticket');
    }
  }

  async function updateTicket(id: string, status: string) {
    try {
      await api(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update ticket');
    }
  }

  async function publishArticle(id: string, status: string) {
    try {
      await api(`/api/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update article');
    }
  }

  async function transferCall(id: string) {
    if (!window.confirm('Transfer this active call to the configured human support destination?')) return;
    try {
      await api(`/api/dashboard/calls/${id}/transfer`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to transfer call');
    }
  }

  function logout() {
    void api('/api/auth/logout', { method: 'POST' }).catch(() => { });
    localStorage.removeItem('xyz_token');
    setUser(null);
    setSummary(null);
  }

  if (!user) return <Login onSubmit={handleLogin} error={error} />;

  const filteredCalls = calls.filter(c => `${c.provider_call_id || ''} ${c.status} ${c.from_number_masked || ''}`.toLowerCase().includes(query.toLowerCase()));
  const filteredTickets = tickets.filter(t => `${t.reference_code} ${t.subject} ${t.category} ${t.status}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Building2 size={21} /></div>
          <div><strong>XYZ BANK</strong><span>AI OPERATIONS</span></div>
          <button className="mobile-close icon-button" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="workspace">
          <span className="workspace-dot" />Customer Support <ChevronDown size={14} />
        </div>

        {/* AI Call Simulator Launch Button in Sidebar */}
        <div style={{ margin: '0 4px 18px' }}>
          <button
            className="button primary"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 0,
              boxShadow: '0 4px 14px rgba(37,99,235,.35)'
            }}
            onClick={() => setShowSimulator(true)}
          >
            <Headphones size={15} /> AI Call Simulator
          </button>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.name} onClick={() => { setPage(item.name); setMobileNav(false); }} className={`nav-item ${page === item.name ? 'active' : ''}`}>
                <Icon size={18} />
                <span>{item.name}</span>
                {item.name === 'Calls' && summary?.calls.active ? <b className="nav-count">{summary.calls.active}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note">
            <ShieldCheck size={17} />
            <div><b>Security enabled</b><span>Role-based access active</span></div>
          </div>
          <div className="profile">
            <div className="avatar">{user.displayName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className="profile-text"><b>{user.displayName}</b><span>{user.role.replace('_', ' ')}</span></div>
            <button className="icon-button" onClick={logout} title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button>
            <div className="breadcrumbs">Workspace <span>/</span> <b>{page}</b></div>
          </div>
          <div className="topbar-right">
            <button
              className="button primary"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 0,
                boxShadow: '0 4px 12px rgba(16,185,129,.35)',
                padding: '8px 14px'
              }}
              onClick={() => setShowSimulator(true)}
            >
              <PhoneCall size={14} /> Talk with AI Call
            </button>
            <span className="env-pill">
              <span style={{ background: isStandaloneMode() ? '#10b981' : undefined }} />
              {isStandaloneMode() ? 'GitHub Pages Live Preview' : 'Operational Environment'}
            </span>
            <button className="icon-button" onClick={() => void load()} title="Refresh"><RefreshCw size={17} /></button>
            <div className="top-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">XYZ BANK <span>•</span> OPERATIONS CENTER</div>
              <h1>{page === 'Overview' ? 'Good day, ' + user.displayName.split(' ')[0] : page}</h1>
              <p>{page === 'Overview' ? 'Here is what is happening across your AI support operations.' : page === 'Calls' ? 'Monitor inbound voice sessions and resolution outcomes.' : page === 'Support tickets' ? 'Track and manage customer issues through resolution.' : page === 'Knowledge base' ? 'Manage the approved information the AI can use to answer callers.' : 'Review security and operational events.'}</p>
            </div>
            <div className="heading-actions">
              <button className="button secondary" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button>
              {page === 'Knowledge base' && canManage(user.role) && <button className="button primary" onClick={() => setShowArticle(true)}><Plus size={16} /> New article</button>}
              {page === 'Support tickets' && <button className="button primary" onClick={() => setShowTicket(true)}><Plus size={16} /> New ticket</button>}
            </div>
          </div>

          {error && <div className="alert"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
          {loading && <div className="loading-line"><span /> Updating live data…</div>}

          {page === 'Overview' && (
            <>
              <div className="notice">
                <div className="notice-icon"><ShieldCheck size={19} /></div>
                <div>
                  <b>Protected development workspace</b>
                  <p>Synthetic data mode is active. You can test live conversational voice calls with the AI assistant using the Call Simulator.</p>
                </div>
                <button
                  className="button primary"
                  style={{ marginLeft: 'auto', whiteSpace: 'nowrap', background: '#2563eb', padding: '8px 12px', fontSize: '11px' }}
                  onClick={() => setShowSimulator(true)}
                >
                  <PhoneCall size={13} /> Start AI Voice Call
                </button>
              </div>

              <div className="metric-grid">
                <Metric title="Inbound calls" value={summary?.calls.last24h ?? 0} delta="Last 24 hours" icon={PhoneCall} tone="blue" />
                <Metric title="Active calls" value={summary?.calls.active ?? 0} delta="Currently ringing or live" icon={Activity} tone="green" />
                <Metric title="Open tickets" value={summary?.tickets.open ?? 0} delta="Awaiting resolution" icon={Ticket} tone="amber" />
                <Metric title="Published articles" value={summary?.knowledge.published ?? 0} delta="Approved AI knowledge" icon={BookOpen} tone="violet" />
              </div>

              <div className="content-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div><h2>Recent calls</h2><p>Latest inbound activity</p></div>
                    <button className="text-button" onClick={() => setPage('Calls')}>View all <ArrowUpRight size={14} /></button>
                  </div>
                  <CallsTable calls={calls.slice(0, 6)} onTransfer={canManage(user.role) ? transferCall : undefined} />
                </section>
                <section className="panel side-panel">
                  <div className="panel-heading">
                    <div><h2>System status</h2><p>Core service indicators</p></div>
                    <span className="live-dot-label"><span /> Operational view</span>
                  </div>
                  <div className="system-row">
                    <div className="system-icon green"><Wifi size={17} /></div>
                    <div><b>API service</b><span>Data loaded successfully</span></div>
                    <span className="mini-status">Connected</span>
                  </div>
                  <div className="system-row">
                    <div className="system-icon blue"><BookOpen size={17} /></div>
                    <div><b>Knowledge service</b><span>{summary?.knowledge.published ?? 0} published articles</span></div>
                    <span className="mini-status">Ready</span>
                  </div>
                  <div className="system-row">
                    <div className="system-icon green"><Headphones size={17} /></div>
                    <div><b>Voice simulation</b><span>Ready for browser mic & audio</span></div>
                    <span className="mini-status">Active</span>
                  </div>
                  <div className="system-row">
                    <div className="system-icon violet"><ShieldCheck size={17} /></div>
                    <div><b>AI banking actions</b><span>Restricted to safe support tools</span></div>
                    <span className="mini-status">Protected</span>
                  </div>
                  <div className="panel-footnote"><Clock3 size={14} /> Metrics update when calls complete.</div>
                </section>
              </div>

              <section className="panel lower-panel">
                <div className="panel-heading">
                  <div><h2>Support queue</h2><p>Tickets that may need attention</p></div>
                  <button className="text-button" onClick={() => setPage('Support tickets')}>Open queue <ArrowUpRight size={14} /></button>
                </div>
                <TicketsTable tickets={tickets.slice(0, 5)} onStatusChange={canUpdateTickets(user.role) ? updateTicket : undefined} />
              </section>
            </>
          )}

          {page === 'Calls' && (
            <section className="panel table-panel">
              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search calls or status…" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="button primary" style={{ padding: '7px 12px', fontSize: '11px' }} onClick={() => setShowSimulator(true)}>
                    <PhoneCall size={13} /> Simulate New Call
                  </button>
                  <span className="results-count">{filteredCalls.length} calls</span>
                </div>
              </div>
              <CallsTable calls={filteredCalls} onTransfer={canManage(user.role) ? transferCall : undefined} />
            </section>
          )}

          {page === 'Support tickets' && (
            <section className="panel table-panel">
              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tickets…" />
                </div>
                <span className="results-count">{filteredTickets.length} tickets</span>
              </div>
              <TicketsTable tickets={filteredTickets} onStatusChange={canUpdateTickets(user.role) ? updateTicket : undefined} />
            </section>
          )}

          {page === 'Knowledge base' && (
            <section className="knowledge-grid">
              {articles.filter(a => `${a.title} ${a.category} ${a.content}`.toLowerCase().includes(query.toLowerCase())).map(a => (
                <article className="knowledge-card" key={a.id}>
                  <div className="knowledge-card-top">
                    <span className="category-pill">{a.category}</span>
                    <span className={`status-pill ${a.status.toLowerCase()}`}>{a.status}</span>
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.content}</p>
                  <div className="knowledge-card-foot">
                    <span>v1+ • Updated {new Date(a.updated_at).toLocaleDateString()}</span>
                    {canManage(user.role) ? (
                      <button className="text-button" onClick={() => void publishArticle(a.id, a.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED')}>
                        {a.status === 'PUBLISHED' ? 'Archive' : 'Publish'} <ArrowUpRight size={13} />
                      </button>
                    ) : <FileText size={15} />}
                  </div>
                </article>
              ))}
              {!articles.length && <Empty icon={BookOpen} title="No articles found" text="Create an article to build the bank's approved knowledge base." />}
            </section>
          )}

          {page === 'Audit log' && (
            <section className="panel table-panel">
              <div className="table-toolbar">
                <div><h2>Audit events</h2><p>Recent security and operational activity</p></div>
                <span className="results-count">{audit.length} events</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Action</th><th>Actor</th><th>Resource</th><th>Outcome</th><th>Time</th></tr>
                  </thead>
                  <tbody>
                    {audit.map(a => (
                      <tr key={a.id}>
                        <td><b>{a.action}</b></td>
                        <td>{a.actor_email || a.actor_type}</td>
                        <td>{a.resource_type}</td>
                        <td><span className={`status-pill ${String(a.outcome).toLowerCase()}`}>{a.outcome}</span></td>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!audit.length && <Empty icon={ShieldCheck} title="No audit events yet" text="Staff and system actions will appear here." />}
            </section>
          )}

          <footer className="footer">
            <span>© {new Date().getFullYear()} XYZ Bank AI Operations</span>
            <span><ShieldCheck size={13} /> Secure workspace <i /> Built for responsible AI support</span>
          </footer>
        </div>
      </main>

      {/* Modals */}
      {showArticle && (
        <Modal title="Create knowledge article" onClose={() => setShowArticle(false)}>
          <form onSubmit={createArticle} className="modal-form">
            <label>Title<input required minLength={3} value={articleTitle} onChange={e => setArticleTitle(e.target.value)} placeholder="e.g. UPI payment status" /></label>
            <label>Category<input required value={articleCategory} onChange={e => setArticleCategory(e.target.value)} placeholder="payments" /></label>
            <label>Content<textarea required minLength={10} rows={5} value={articleContent} onChange={e => setArticleContent(e.target.value)} placeholder="Approved policy or support guidance…" /></label>
            <p className="form-note">New articles are saved as drafts. Only published articles can be used by the AI.</p>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setShowArticle(false)}>Cancel</button>
              <button className="button primary">Save draft</button>
            </div>
          </form>
        </Modal>
      )}

      {showTicket && (
        <Modal title="Create support ticket" onClose={() => setShowTicket(false)}>
          <form onSubmit={createTicket} className="modal-form">
            <label>Category<input required value={ticketCategory} onChange={e => setTicketCategory(e.target.value)} placeholder="payments" /></label>
            <label>Subject<input required minLength={4} value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} placeholder="Short summary" /></label>
            <label>Description<textarea required minLength={8} rows={4} value={ticketDescription} onChange={e => setTicketDescription(e.target.value)} placeholder="Describe the issue. Do not include PINs, CVVs, passwords or OTPs." /></label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setShowTicket(false)}>Cancel</button>
              <button className="button primary">Create ticket</button>
            </div>
          </form>
        </Modal>
      )}

      {/* AI Voice Call Simulator Modal */}
      {showSimulator && (
        <CallSimulatorModal
          onClose={() => setShowSimulator(false)}
          onCallUpdated={() => void load()}
        />
      )}
    </div>
  );
}

function canManage(role: string) { return role === 'SUPER_ADMIN' || role === 'SUPERVISOR'; }
function canUpdateTickets(role: string) { return role === 'SUPER_ADMIN' || role === 'SUPERVISOR' || role === 'SUPPORT_AGENT'; }

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
  nativeName: string;
  fallbackGreeting: string;
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳', nativeName: 'Indian English', fallbackGreeting: "Namaste! Welcome to XYZ Bank. How can I help you today?" },
  { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी', fallbackGreeting: "नमस्ते! एक्सवाईजेड बैंक में आपका स्वागत है। मैं आपकी क्या सहायता कर सकती हूँ?" },
  { code: 'ta-IN', label: 'Tamil', flag: '🇮🇳', nativeName: 'தமிழ்', fallbackGreeting: "வணக்கம்! XYZ வங்கிக்கு உங்களை வரவேற்கிறோம். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?" },
  { code: 'te-IN', label: 'Telugu', flag: '🇮🇳', nativeName: 'తెలుగు', fallbackGreeting: "నమస్కారం! XYZ బ్యాంక్‌కు స్వాగతం. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?" },
  { code: 'kn-IN', label: 'Kannada', flag: '🇮🇳', nativeName: 'ಕನ್ನಡ', fallbackGreeting: "ನಮಸ್ಕಾರ! XYZ ಬ್ಯಾಂಕ್‌ಗೆ ಸ್ವಾಗತ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?" },
  { code: 'ml-IN', label: 'Malayalam', flag: '🇮🇳', nativeName: 'മലയാളം', fallbackGreeting: "നമസ്കാരം! XYZ ബാങ്കിലേക്ക് സ്വാಗതം. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?" },
  { code: 'bn-IN', label: 'Bengali', flag: '🇮🇳', nativeName: 'বাংলা', fallbackGreeting: "নমস্কার! XYZ ব্যাংকে আপনাকে স্বাগত। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?" },
  { code: 'en-US', label: 'English (US)', flag: '🌐', nativeName: 'Global English', fallbackGreeting: "Hello! Welcome to XYZ Bank customer support. How may I assist you today?" }
];

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[*_#`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\bINR\b/gi, 'Rupees')
    .replace(/₹\s*/g, 'Rupees ')
    .replace(/\bUPI\b/g, 'U P I')
    .replace(/\bOTP\b/g, 'O T P')
    .replace(/\bPIN\b/g, 'P I N')
    .replace(/\bCVV\b/g, 'C V V')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase();
  // Filter out all known male voice names
  if (/(david|mark|george|richard|james|guy|stefan|paul|brian|ravi|hemant|prabhat|madhur|male|man)/i.test(name) && !name.includes('female')) {
    return false;
  }
  // Prioritize female voice names
  if (/(zira|jenny|aria|sonia|neerja|heera|samantha|victoria|karen|moira|fiona|swara|kalpana|female|girl|sofia)/i.test(name)) {
    return true;
  }
  if (name.includes('google us english') || name.includes('google uk english female')) return true;
  return !name.includes('male');
}

function findBestVoiceForLanguage(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice | null {
  if (!voices || !voices.length) return null;
  const femaleVoices = voices.filter(isFemaleVoice);
  const pool = femaleVoices.length > 0 ? femaleVoices : voices;
  const langPrefix = langCode.split('-')[0].toLowerCase();

  // 1. Natural / Neural / HD female voice matching exact language (e.g. Neerja for en-IN, Jenny/Aria for en-US)
  const naturalMatch = pool.find(v =>
    v.lang.toLowerCase() === langCode.toLowerCase() &&
    /natural|neural|online|google/i.test(v.name)
  );
  if (naturalMatch) return naturalMatch;

  // 2. Exact language match in female pool
  const exactMatch = pool.find(v => v.lang.toLowerCase() === langCode.toLowerCase());
  if (exactMatch) return exactMatch;

  // 3. Natural / Neural / HD female English voice (Jenny, Aria, Google US English - highest quality)
  const naturalEn = pool.find(v => /natural|neural|online|google/i.test(v.name) && v.lang.startsWith('en'));
  if (naturalEn) return naturalEn;

  // 4. Any female voice matching language prefix
  const prefixMatch = pool.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  if (prefixMatch) return prefixMatch;

  // 5. If Indian language and none found, check for Indian English (Neerja, Heera)
  if (langCode.endsWith('-IN')) {
    const indianVoice = pool.find(v => /(neerja|heera|india|en-in|hi-in)/i.test(v.name + v.lang));
    if (indianVoice) return indianVoice;
  }

  // 6. Any English female voice (Zira, Samantha, etc.)
  const enMatch = pool.find(v => v.lang.startsWith('en'));
  if (enMatch) return enMatch;

  return pool[0] || null;
}

function CallSimulatorModal({ onClose, onCallUpdated }: { onClose: () => void; onCallUpdated: () => void }) {
  const [call, setCall] = useState<SimCall | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'caller'; text: string; tool?: string; time: string; engine?: string; geminiError?: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transferred, setTransferred] = useState(false);
  const [callEndedInfo, setCallEndedInfo] = useState<{ duration: number; status: string } | null>(null);
  const [callState, setCallState] = useState<'IDLE' | 'DIALING' | 'CONNECTED' | 'ENDED'>('IDLE');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  // Multilingual & Voice Engine state
  const [selectedLang, setSelectedLang] = useState<string>('en-IN');
  const [voiceEngine, setVoiceEngine] = useState<'gemini_hd' | 'browser'>('gemini_hd');

  // Gemini Free Key State
  const [geminiKey, setGeminiKey] = useState<string>(() => getStoredGeminiKey());
  const [serverHasEnvKey, setServerHasEnvKey] = useState<boolean>(false);
  const [showKeySettings, setShowKeySettings] = useState<boolean>(false);
  const [keyInputVal, setKeyInputVal] = useState<string>(() => getStoredGeminiKey());
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [keyFeedback, setKeyFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Female voice engine state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Speech-to-text and audio intake state
  const [speechStatus, setSpeechStatus] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [autoListen, setAutoListen] = useState<boolean>(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const latestSpeechTextRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const startListeningRef = useRef<() => void>(() => { });
  const loadingRef = useRef<boolean>(false);
  const callRef = useRef<SimCall | null>(null);

  // Sync refs to avoid stale closures
  callRef.current = call;
  loadingRef.current = loading;

  // Audio Player ref for playing Gemini HD Studio Voice WAV
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // VAD & Speech Synthesis safety refs
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakTimeoutRef = useRef<any>(null);
  const hasSpokenRef = useRef<boolean>(false);
  const lastSoundTimeRef = useRef<number>(0);
  const speechStartTimeRef = useRef<number>(0);
  const hasSpeechRecognitionActiveRef = useRef<boolean>(false);

  useEffect(() => {
    void getGeminiStatus().then(st => {
      setServerHasEnvKey(st.hasEnvKey);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, loading, interimText]);

  useEffect(() => {
    if (!call || callEndedInfo) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [call, callEndedInfo]);

  // Load and select the best voice matching selected language
  const initVoices = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const all = window.speechSynthesis.getVoices();
    if (all.length > 0) {
      setVoices(all);
      const best = findBestVoiceForLanguage(all, selectedLang);
      if (best) setSelectedVoice(best);
    }
  }, [selectedLang]);

  useEffect(() => {
    initVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = initVoices;
    }
  }, [initVoices]);

  // When language changes, update the selected browser voice
  useEffect(() => {
    if (voices.length > 0) {
      const best = findBestVoiceForLanguage(voices, selectedLang);
      if (best) setSelectedVoice(best);
    }
  }, [selectedLang, voices]);

  // Browser voice fallback function
  const speakWithBrowserVoice = useCallback((cleanText: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSpeaking(false);
      onDone?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;

      const voiceToUse = (selectedVoice && isFemaleVoice(selectedVoice))
        ? selectedVoice
        : findBestVoiceForLanguage(voices, selectedLang);
      if (voiceToUse) {
        utterance.voice = voiceToUse;
        utterance.lang = voiceToUse.lang || selectedLang;
      } else {
        utterance.lang = selectedLang;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.06;
      utterance.volume = 1.0;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
        setIsSpeaking(false);
        utteranceRef.current = null;
        onDone?.();
      };

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = finish;
      utterance.onerror = finish;

      const wordCount = cleanText.split(/\s+/).length;
      const maxMs = Math.max(2500, (wordCount / 2.2) * 1000 + 2000);
      speakTimeoutRef.current = setTimeout(finish, maxMs);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      onDone?.();
    }
  }, [selectedVoice, voices, selectedLang]);

  // Dual-mode voice synthesis: Ultra-human Gemini Studio AI Voice + Browser Voice
  const speakText = useCallback(async (text: string, onDone?: () => void) => {
    if (!ttsEnabled) {
      onDone?.();
      return;
    }
    const clean = cleanTextForSpeech(text);
    if (!clean) {
      onDone?.();
      return;
    }

    // Stop any existing playing audio or speech
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch { }
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

    // 1. Studio AI Voice (Gemini HD Neural TTS with Aoede voice)
    if (voiceEngine === 'gemini_hd') {
      try {
        setIsSpeaking(true);
        const res = await synthesizeSpeechApi(clean, 'Aoede', geminiKey || undefined);
        if (res.audioBase64) {
          const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/wav');
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audioPlayerRef.current = audio;

          let finished = false;
          const handleDone = () => {
            if (finished) return;
            finished = true;
            if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
            setIsSpeaking(false);
            audioPlayerRef.current = null;
            try { URL.revokeObjectURL(audioUrl); } catch {}
            onDone?.();
          };

          audio.onended = handleDone;
          audio.onerror = (e) => {
            console.warn('Studio voice audio element playback error:', e);
            try { URL.revokeObjectURL(audioUrl); } catch {}
            speakWithBrowserVoice(clean, onDone);
          };

          const wordCount = clean.split(/\s+/).length;
          const maxMs = Math.max(3000, (wordCount / 2) * 1000 + 4000);
          speakTimeoutRef.current = setTimeout(handleDone, maxMs);

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise.catch(e => {
              console.warn('Autoplay blocked or audio play error:', e);
              speakWithBrowserVoice(clean, onDone);
            });
          }
          return;
        }
      } catch (err) {
        console.warn('Gemini Studio AI voice unavailable for this turn, using high-definition browser voice fallback:', err);
        speakWithBrowserVoice(clean, onDone);
        return;
      }
    }

    // 2. Instant Browser Voice
    speakWithBrowserVoice(clean, onDone);
  }, [ttsEnabled, voiceEngine, geminiKey, speakWithBrowserVoice]);

  // Stop current turn's active listening/recording without destroying the live mic hardware stream
  const stopListeningOnly = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setAudioLevel(0);
    hasSpokenRef.current = false;
    lastSoundTimeRef.current = 0;
    speechStartTimeRef.current = 0;
    hasSpeechRecognitionActiveRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch { }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch { }
      mediaRecorderRef.current = null;
    }
  }, []);

  // Full teardown: closes mic hardware stream, audio context, and timers when call ends
  const teardownMediaAndCleanup = useCallback(() => {
    stopListeningOnly();

    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch { }
      audioPlayerRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          void audioContextRef.current.close();
        }
      } catch { }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      } catch { }
      mediaStreamRef.current = null;
    }
  }, [stopListeningOnly]);

  // Cleanup on modal unmount
  useEffect(() => {
    return () => {
      teardownMediaAndCleanup();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [teardownMediaAndCleanup]);

  const handleSendMessage = useCallback(async (textToSend: string) => {
    const currentCall = callRef.current;
    if (!currentCall || !textToSend.trim() || loadingRef.current || callEndedInfo) return;
    const userText = textToSend.trim();
    stopListeningOnly();
    setInput('');
    setInterimText('');
    setSpeechStatus('');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'caller', text: userText, time }]);
    loadingRef.current = true;
    setLoading(true);

    try {
      const history = messages.slice(-4).map(m => ({
        role: m.sender === 'ai' ? ('model' as const) : ('user' as const),
        text: m.text
      }));

      const res = await sendSimulationMessage(currentCall.callId, userText, geminiKey || undefined, history);
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: res.reply,
        tool: res.tool || undefined,
        time: aiTime,
        engine: res.engine,
        geminiError: res.geminiError
      }]);
      if (res.transferred) {
        setTransferred(true);
      }
      speakText(res.reply, () => {
        if (autoListen && !res.transferred) {
          setTimeout(() => startListeningRef.current(), 350);
        }
      });
      onCallUpdated();
    } catch (e) {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'I encountered a connection error. Please try asking again.',
        time
      }]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [callEndedInfo, stopListeningOnly, messages, geminiKey, speakText, autoListen, onCallUpdated]);

  const handleSendAudio = useCallback(async (audioBlob: Blob, manual = false) => {
    const currentCall = callRef.current;
    if (!currentCall || loadingRef.current || callEndedInfo) return;

    // Capture spoken text before resetting state
    const capturedSpokenText = latestSpeechTextRef.current.trim() || interimText.trim() || input.trim();

    stopListeningOnly();
    setInput('');
    setInterimText('');
    loadingRef.current = true;
    setLoading(true);
    setSpeechStatus('Transcribing your speech with Gemini AI...');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = (reader.result as string) || '';
          const base64 = res.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      const history = messages.slice(-4).map(m => ({
        role: m.sender === 'ai' ? ('model' as const) : ('user' as const),
        text: m.text
      }));

      const mimeType = audioBlob.type || 'audio/webm';
      const res = await sendSimulationAudio(currentCall.callId, audioBase64, mimeType, geminiKey || undefined, history, manual, capturedSpokenText);

      if (res.ignored) {
        // Automated silence check returned no human words: quietly resume listening
        setSpeechStatus('');
        loadingRef.current = false;
        setLoading(false);
        if (autoListen && !transferred) {
          setTimeout(() => startListeningRef.current(), 150);
        }
        return;
      }

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userText = res.transcribedText || capturedSpokenText || '(Voice Question)';
      setMessages(prev => [
        ...prev,
        { sender: 'caller', text: userText, time },
        {
          sender: 'ai',
          text: res.reply,
          tool: res.tool || undefined,
          time,
          engine: res.engine || 'Gemini Multimodal Audio',
          geminiError: res.geminiError
        }
      ]);

      if (res.transferred) {
        setTransferred(true);
      }

      setSpeechStatus('');
      speakText(res.reply, () => {
        if (autoListen && !res.transferred) {
          setTimeout(() => startListeningRef.current(), 350);
        }
      });
      onCallUpdated();
    } catch (err: any) {
      console.error('Audio processing error:', err);
      setSpeechStatus(`Audio error: ${err.message || 'Could not process audio'}. You can type below.`);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [callEndedInfo, stopListeningOnly, messages, geminiKey, speakText, autoListen, onCallUpdated, transferred, interimText, input]);

  const stopListeningAndSubmit = useCallback(async (manual = false) => {
    // 1. First priority: Text from speech recognition, interim caption, or typed input
    const textToSubmit = latestSpeechTextRef.current.trim() || interimText.trim() || input.trim();
    if (textToSubmit) {
      stopListeningOnly();
      setSpeechStatus('Processing your question...');
      await handleSendMessage(textToSubmit);
      return;
    }

    // Flush any pending chunks from media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch { }
    }

    // Brief tick to ensure ondataavailable catches the flushed chunk
    await new Promise(r => setTimeout(r, 60));

    // 2. Audio chunks from MediaRecorder
    const recordedChunks = [...audioChunksRef.current];
    stopListeningOnly();

    const mimeType = recordedChunks[0]?.type || 'audio/webm';
    const audioBlob = recordedChunks.length > 0 ? new Blob(recordedChunks, { type: mimeType }) : null;

    if (audioBlob && audioBlob.size > 200) {
      setSpeechStatus('Processing your voice question...');
      await handleSendAudio(audioBlob, manual);
    } else {
      if (manual) {
        // User explicitly tapped "Done Speaking (Send)", but no speech was captured
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const fallbackText = "I couldn't hear any audio from your microphone. Please speak into your microphone or type your question in the text box below.";
        setMessages(prev => [
          ...prev,
          { sender: 'caller', text: '(Microphone audio)', time },
          { sender: 'ai', text: fallbackText, time, engine: 'Sofia AI Assistant' }
        ]);
        setSpeechStatus('');
        speakText(fallbackText, () => {
          if (autoListen && !transferred) {
            setTimeout(() => startListeningRef.current(), 350);
          }
        });
        return;
      }
      // Quiet ambient sound on automatic silence: resume listening smoothly
      hasSpokenRef.current = false;
      lastSoundTimeRef.current = 0;
      speechStartTimeRef.current = 0;
      if (!isMuted && !transferred) {
        setTimeout(() => startListeningRef.current(), 150);
      }
    }
  }, [input, interimText, stopListeningOnly, handleSendMessage, handleSendAudio, isMuted, transferred, speakText, autoListen]);

  const startListening = useCallback(async () => {
    if (callEndedInfo || isMuted) return;

    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch { }
      audioPlayerRef.current = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    stopListeningOnly();

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang);
    latestSpeechTextRef.current = '';
    setInterimText('');
    setSpeechStatus(`Listening in ${currentLang?.label || 'selected language'}... speak now`);
    audioChunksRef.current = [];
    hasSpokenRef.current = false;
    lastSoundTimeRef.current = 0;
    speechStartTimeRef.current = 0;

    // Reuse persistent stream if already active, or initialize once
    let stream: MediaStream | null = mediaStreamRef.current;
    const isStreamLive = stream && stream.active && stream.getAudioTracks().some(t => t.readyState === 'live');

    if (!isStreamLive) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          mediaStreamRef.current = stream;
        }
      } catch (err: any) {
        console.warn('Microphone permission error:', err);
        setSpeechStatus('Microphone blocked. Please allow mic permissions in your browser bar.');
        return;
      }
    }

    if (!stream) {
      setSpeechStatus('No microphone detected.');
      return;
    }

    isListeningRef.current = true;
    setIsListening(true);

    // Audio level meter + Voice Activity Detection (VAD)
    try {
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          ctx = new AudioCtx();
          audioContextRef.current = ctx;
        }
      }
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => { });
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        const updateVADAndLevel = () => {
          if (!isListeningRef.current) return;
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) {
            sum += dataArr[i];
          }
          const avg = sum / dataArr.length;
          const level = Math.min(100, Math.round((avg / 64) * 100));
          setAudioLevel(level);

          const now = Date.now();
          if (level > 6) {
            if (!hasSpokenRef.current) {
              hasSpokenRef.current = true;
              speechStartTimeRef.current = now;
            }
            lastSoundTimeRef.current = now;
          } else if (hasSpokenRef.current && lastSoundTimeRef.current > 0) {
            // Only auto-submit based on audio silence IF Web Speech is NOT actively running
            // (When Web Speech is running, Web Speech API's silenceTimerRef handles turn-taking accurately without cutting off caller)
            if (!hasSpeechRecognitionActiveRef.current) {
              const silenceMs = now - lastSoundTimeRef.current;
              const speakingMs = lastSoundTimeRef.current - speechStartTimeRef.current;

              if (speakingMs >= 800 && silenceMs >= 1600) {
                hasSpokenRef.current = false;
                lastSoundTimeRef.current = 0;
                void stopListeningAndSubmit(false);
                return;
              }
            }
          }

          animFrameRef.current = requestAnimationFrame(updateVADAndLevel);
        };
        updateVADAndLevel();
      }
    } catch (e) {
      console.warn('Audio visualizer setup error:', e);
    }

    // MediaRecorder background audio intake
    try {
      if (typeof MediaRecorder !== 'undefined') {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : '';
        const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        rec.start(100);
        mediaRecorderRef.current = rec;
      }
    } catch (e) {
      console.warn('MediaRecorder setup error:', e);
    }

    // Web Speech API configured to selected language
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.lang = selectedLang;
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          hasSpeechRecognitionActiveRef.current = true;
          setSpeechStatus(`Listening in ${currentLang?.label || 'selected language'}... speak now`);
        };

        rec.onresult = (event: any) => {
          let full = '';
          let interim = '';
          for (let i = 0; i < event.results.length; ++i) {
            const tr = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              full += tr + ' ';
            } else {
              interim += tr;
            }
          }
          const combined = (full + interim).trim();
          if (combined) {
            latestSpeechTextRef.current = combined;
            setInterimText(combined);
            setInput(combined);
            hasSpokenRef.current = true;

            // Natural conversational turn-taking pause: 1400ms after final segment, or 1800ms while interim
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            const isFinalChunk = event.results[event.results.length - 1]?.isFinal;
            const pauseDuration = isFinalChunk ? 1400 : 1800;
            silenceTimerRef.current = setTimeout(() => {
              void stopListeningAndSubmit(false);
            }, pauseDuration);
          }
        };

        rec.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
          }
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setSpeechStatus('Microphone blocked. Check browser permissions.');
          } else if (event.error === 'network') {
            hasSpeechRecognitionActiveRef.current = false;
            console.warn('Web Speech network offline, falling back to MediaRecorder');
          }
        };

        rec.onend = () => {
          hasSpeechRecognitionActiveRef.current = false;
          if (!isListeningRef.current || isMuted) return;
          if (latestSpeechTextRef.current.trim()) {
            void stopListeningAndSubmit(false);
          } else {
            // Re-initialize fresh instance smoothly
            setTimeout(() => {
              if (isListeningRef.current && !isMuted) {
                try {
                  const nextRec = new SpeechRec();
                  nextRec.lang = selectedLang;
                  nextRec.interimResults = true;
                  nextRec.continuous = true;
                  nextRec.onstart = rec.onstart;
                  nextRec.onresult = rec.onresult;
                  nextRec.onerror = rec.onerror;
                  nextRec.onend = rec.onend;
                  recognitionRef.current = nextRec;
                  nextRec.start();
                } catch { }
              }
            }, 80);
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e) {
        console.warn('Web Speech API start error:', e);
      }
    }
  }, [callEndedInfo, isMuted, stopListeningOnly, stopListeningAndSubmit, selectedLang]);

  startListeningRef.current = startListening;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      void startListening();
    } else {
      setIsMuted(true);
      stopListeningOnly();
    }
  };

  const playTelephoneRing = () => {
    return new Promise<void>(resolve => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) { resolve(); return; }
        const ctx = new AudioCtx();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;
        gain.gain.value = 0.05;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        setTimeout(() => {
          try {
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
            setTimeout(() => {
              try { osc1.stop(); osc2.stop(); void ctx.close(); } catch { }
              resolve();
            }, 250);
          } catch { resolve(); }
        }, 1000);
      } catch {
        resolve();
      }
    });
  };

  const playHangupTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 425;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try {
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
          setTimeout(() => { try { osc.stop(); void ctx.close(); } catch { } }, 150);
        } catch { }
      }, 250);
    } catch { }
  };

  const handleStartCall = async () => {
    setLoading(true);
    setCallState('DIALING');
    setSpeechStatus('');

    // Pre-warm mic stream while telephone rings so first spoken words are never cut off
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        mediaStreamRef.current = stream;
      } catch (mErr) {
        console.warn('Initial mic warmup note:', mErr);
      }
    }

    try {
      await playTelephoneRing();
      const res = await startSimulationCall('Aarav Sharma (SYN-CUST-1001)', '+91 98765 00011');
      setCall(res);
      setCallState('CONNECTED');
      setSeconds(0);
      setIsMuted(false);
      setTransferred(false);
      setCallEndedInfo(null);
      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang);
      const greeting = langObj?.fallbackGreeting || res.greeting;
      setMessages([{
        sender: 'ai',
        text: greeting,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      speakText(greeting, () => {
        if (!isMuted) {
          setTimeout(() => startListeningRef.current(), 350);
        }
      });
      onCallUpdated();
    } catch (e) {
      setCallState('IDLE');
      teardownMediaAndCleanup();
      alert(e instanceof Error ? e.message : 'Failed to connect call');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeminiKey = () => {
    setStoredGeminiKey(keyInputVal);
    setGeminiKey(keyInputVal.trim());
    setKeyFeedback({ ok: true, msg: keyInputVal.trim() ? 'Key saved to browser storage!' : 'Key cleared. Server environment or local fallback will be used.' });
    setTimeout(() => setKeyFeedback(null), 3000);
  };

  const handleTestGeminiKey = async () => {
    setTestingKey(true);
    setKeyFeedback(null);
    try {
      const res = await testGeminiApiKey(keyInputVal.trim() || undefined);
      if (res.ok) {
        setKeyFeedback({ ok: true, msg: `Verified! Connected to: ${res.model || 'gemini-3.8-flash'}` });
      } else {
        setKeyFeedback({ ok: false, msg: res.error || 'Validation failed' });
      }
    } catch (e: any) {
      setKeyFeedback({ ok: false, msg: e.message || 'Connection test failed' });
    } finally {
      setTestingKey(false);
    }
  };

  const handleEndCall = async () => {
    if (!call) return;
    playHangupTone();
    teardownMediaAndCleanup();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsListening(false);
    setSpeechStatus('');
    setCallState('ENDED');
    try {
      const res = await endSimulationCall(call.callId);
      setCallEndedInfo({ duration: res.durationSeconds, status: res.status });
      onCallUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const testVoiceSample = () => {
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang);
    const sample = langObj?.fallbackGreeting || "Thank you for calling XYZ Bank. I'm your AI support assistant. How can I help you today?";
    void speakText(sample);
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !call) onClose(); }}>
      <div className="sim-modal-card">
        {/* Head */}
        <div className="sim-head">
          <div className="sim-head-title">
            <Headphones size={20} color="#60a5fa" />
            <div>
              <h2>AI Voice Call Simulator</h2>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Real-time voice & bank tool execution</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`sim-gemini-pill ${geminiKey || serverHasEnvKey ? 'active' : ''}`}
              onClick={() => setShowKeySettings(v => !v)}
              title="Click to configure Google Gemini Free API Key"
            >
              <Sparkles size={12} />
              <span>{geminiKey || serverHasEnvKey ? '⚡ Gemini Free AI: Active' : '🔑 Free Gemini Key'}</span>
            </button>
            <span className={`sim-live-indicator ${!call ? 'idle' : transferred ? 'transferred' : ''}`}>
              <span className="sim-pulse-dot" />
              {!call ? 'IDLE' : transferred ? 'TRANSFERRED' : `LIVE ${formatTimer(seconds)}`}
            </span>
            <button className="icon-button" onClick={() => { if (call) void handleEndCall(); onClose(); }} style={{ color: '#94a3b8' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Gemini Key Configuration Dropdown Panel */}
        {showKeySettings && (
          <div className="sim-gemini-panel">
            <div className="sim-gemini-panel-head">
              <b>
                <Key size={14} color="#818cf8" />
                Google Gemini Free API Key Configuration
              </b>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="sim-gemini-link"
              >
                Get Free Key at Google AI Studio ↗
              </a>
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              {serverHasEnvKey
                ? '✅ Server environment (.env) has GEMINI_API_KEY loaded. You can also paste or override with a custom key below.'
                : 'Google Gemini 1.5/3.8 Flash is 100% free with no credit card required at Google AI Studio. Paste your key below to activate live AI reasoning.'}
            </div>
            <div className="sim-gemini-panel-input">
              <input
                type="password"
                value={keyInputVal}
                onChange={e => setKeyInputVal(e.target.value)}
                placeholder="Paste key here (AIzaSy...)"
              />
              <button
                className="button secondary"
                style={{ padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                onClick={handleTestGeminiKey}
                disabled={testingKey}
              >
                {testingKey ? 'Testing...' : 'Test Key'}
              </button>
              <button
                className="button primary"
                style={{ padding: '6px 14px', fontSize: '11px', background: '#4f46e5', whiteSpace: 'nowrap' }}
                onClick={handleSaveGeminiKey}
              >
                Save Key
              </button>
            </div>
            {keyFeedback && (
              <div style={{ fontSize: '10px', color: keyFeedback.ok ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {keyFeedback.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
                <span>{keyFeedback.msg}</span>
              </div>
            )}
          </div>
        )}

        {/* Multilingual & Voice Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#0e1a2b', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '10px' }}>
          {/* Language Selector */}
          <div className="sim-lang-selector">
            <Languages size={14} color="#60a5fa" />
            <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Language:</span>
            <select
              className="sim-lang-select"
              value={selectedLang}
              onChange={e => setSelectedLang(e.target.value)}
              title="Select speech language for transcription and AI voice"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>

          {/* Voice Engine Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="sim-engine-toggle" title="Switch between Gemini Studio HD Human Voice and Browser Voice">
              <button
                type="button"
                className={`sim-engine-opt ${voiceEngine === 'gemini_hd' ? 'active' : ''}`}
                onClick={() => setVoiceEngine('gemini_hd')}
                title="Ultra-realistic human neural voice powered by Gemini 2.5 Flash TTS (Warm, empathetic & natural across languages)"
              >
                🎙️ Studio Human Voice (HD)
              </button>
              <button
                type="button"
                className={`sim-engine-opt ${voiceEngine === 'browser' ? 'active' : ''}`}
                onClick={() => setVoiceEngine('browser')}
                title="Instant zero-latency browser speech synthesis"
              >
                ⚡ Browser Voice
              </button>
            </div>

            {voiceEngine === 'browser' && (
              <select
                className="sim-voice-select"
                value={selectedVoice?.name || ''}
                onChange={e => {
                  const v = voices.find(item => item.name === e.target.value);
                  if (v) setSelectedVoice(v);
                }}
              >
                {voices
                  .filter(isFemaleVoice)
                  .map(v => (
                    <option key={v.name} value={v.name}>
                      Sofia ({v.name.replace(/Microsoft |Online \(Natural\) |Google /g, '').slice(0, 18)})
                    </option>
                  ))}
              </select>
            )}

            <button
              className="button secondary"
              style={{ padding: '4px 9px', fontSize: '10px', height: '26px' }}
              onClick={testVoiceSample}
              title="Preview how the voice sounds in the selected language"
            >
              ▶ Test Voice
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#94a3b8', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoListen} onChange={e => setAutoListen(e.target.checked)} />
            <span>Auto-Listen (Hands-free)</span>
          </label>
        </div>

        {/* Real Phone Call Screen Enclosure */}
        <div className="sim-phone-screen-wrap">
          {/* Phone Header */}
          <div className="sim-phone-head">
            <div className="sim-phone-caller-id">
              <div className="sim-phone-verified-tag">
                <ShieldCheck size={13} color="#34d399" />
                <span>XYZ BANK 24/7 CUSTOMER CARE</span>
              </div>
              <h1 className="sim-phone-number">1800-XYZ-BANK</h1>
              <span className="sim-phone-sub">Toll-Free Customer Line • +91 1800 890 0011</span>
            </div>

            <div className="sim-phone-status-pill">
              {callState === 'DIALING' && <span className="sim-dialing-dot">Dialing...</span>}
              {callState === 'CONNECTED' && (
                <>
                  <span className="sim-live-green-dot" />
                  <span>{formatTimer(seconds)}</span>
                </>
              )}
              {callState === 'IDLE' && <span>Ready</span>}
              {callState === 'ENDED' && <span>Call Ended</span>}
            </div>
          </div>

          {/* Center Call Visualizer / Phone Stage */}
          <div className="sim-phone-stage">
            {callState === 'IDLE' && (
              <div className="sim-phone-idle-card">
                <div className="sim-phone-bank-icon">
                  <Building2 size={38} color="#ffffff" />
                </div>
                <h3>Connect to XYZ Bank Voice Care</h3>
                <p>Talk directly with our AI Banking Assistant like a real phone call. No buttons to click to speak—just connect and talk!</p>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Caller: Aarav Sharma (+91 98765 00011)
                </div>
                <button className="sim-phone-call-btn-large" onClick={handleStartCall} disabled={loading}>
                  <PhoneCall size={20} />
                  <span>{loading ? 'Dialing...' : 'Call 1800-XYZ-BANK'}</span>
                </button>
              </div>
            )}

            {callState === 'DIALING' && (
              <div className="sim-phone-calling-view">
                <div className="sim-phone-avatar-pulse thinking">
                  <div className="sim-phone-avatar-inner">
                    <PhoneCall size={38} color="#ffffff" className="sim-pulse-dot" />
                  </div>
                </div>
                <h3>Calling 1800-XYZ-BANK...</h3>
                <p>Connecting your line to AI Banking Assistant...</p>
              </div>
            )}

            {callState === 'CONNECTED' && (
              <div className="sim-phone-active-view">
                {/* Large Animated Avatar Circle with Sound Ripple Rings */}
                <div className={`sim-phone-avatar-pulse ${isSpeaking ? 'ai-speaking' : isListening ? 'user-speaking' : loading ? 'thinking' : ''}`}>
                  <div className="sim-phone-avatar-inner">
                    <Headphones size={42} color="#ffffff" />
                  </div>
                  <div className="sim-ring ring-1" style={{ transform: `scale(${1 + Math.min(0.3, audioLevel * 0.005)})` }} />
                  <div className="sim-ring ring-2" style={{ transform: `scale(${1 + Math.min(0.5, audioLevel * 0.009)})` }} />
                </div>

                {/* Live Call State Label */}
                <div className="sim-phone-state-label">
                  {isMuted ? (
                    <span style={{ color: '#f87171' }}>Microphone Muted</span>
                  ) : isSpeaking ? (
                    <span style={{ color: '#38bdf8' }}>AI Assistant Sofia Speaking ({voiceEngine === 'gemini_hd' ? 'Studio HD Voice' : 'Browser Voice'})...</span>
                  ) : loading ? (
                    <span style={{ color: '#cbd5e1' }}>Checking Bank Records & Policies...</span>
                  ) : isListening ? (
                    audioLevel > 5 ? (
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>
                        🟢 Hearing your voice... (keep speaking)
                      </span>
                    ) : (
                      <span style={{ color: '#34d399' }}>
                        Listening... <em style={{ fontStyle: 'normal', opacity: 0.75 }}>(Speak in {SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.nativeName})</em>
                      </span>
                    )
                  ) : (
                    <span>Call Connected</span>
                  )}
                </div>

                {speechStatus && !speechStatus.includes('Listening') && (
                  <div style={{
                    fontSize: '10px',
                    color: /error|blocked/i.test(speechStatus) ? '#f87171' : '#38bdf8',
                    padding: '2px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}>
                    {!/error|blocked/i.test(speechStatus) && <span className="sim-pulse-dot" style={{ width: '5px', height: '5px', display: 'inline-block' }} />}
                    <span>{speechStatus}</span>
                  </div>
                )}

                {/* Real-time Subtitle / Live Speech Caption */}
                <div className="sim-phone-live-caption">
                  {interimText ? (
                    <div className="sim-phone-caption-user">
                      <b>You:</b> "{interimText}"
                    </div>
                  ) : messages.length > 0 ? (
                    <div className="sim-phone-caption-ai">
                      <b>{messages[messages.length - 1].sender === 'ai' ? 'XYZ Assistant' : 'You'}:</b>
                      <span> "{messages[messages.length - 1].text.slice(0, 150)}{messages[messages.length - 1].text.length > 150 ? '...' : ''}"</span>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Connected to XYZ Bank Customer Care</span>
                  )}
                </div>

                {/* Manual Done Speaking action button - always accessible when connected */}
                <button
                  type="button"
                  className="sim-done-speaking-btn"
                  onClick={() => void stopListeningAndSubmit(true)}
                  disabled={loading}
                  title="Tap when finished speaking or typing to send your question immediately"
                >
                  <Sparkles size={14} />
                  <span>{loading ? 'Processing Question...' : 'Done Speaking (Send)'}</span>
                </button>

                {/* Direct Text Input Bar so caller can type if mic is quiet */}
                <form
                  className="sim-phone-text-bar"
                  onSubmit={e => {
                    e.preventDefault();
                    if (input.trim() && !loading) {
                      void handleSendMessage(input.trim());
                    }
                  }}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isListening ? "Type question here or speak into microphone..." : "Type your banking question here..."}
                    disabled={loading}
                  />
                  <button type="submit" disabled={!input.trim() || loading}>
                    <Send size={13} />
                    <span>Send</span>
                  </button>
                </form>

                {/* Quick Scenarios for Convenience */}
                <div className="sim-chips-bar" style={{ background: 'transparent', borderTop: 'none', padding: '0', justifyContent: 'center' }}>
                  <button className="sim-chip" onClick={() => handleSendMessage('My UPI payment failed yesterday, what should I do?')}>
                    💳 UPI failed
                  </button>
                  <button className="sim-chip" onClick={() => handleSendMessage('Can you tell me my card PIN or unblock my card?')}>
                    🔒 Card PIN (Safety)
                  </button>
                  <button className="sim-chip" onClick={() => handleSendMessage('I want to register an official complaint for unauthorized charge')}>
                    🎫 Raise complaint
                  </button>
                  <button className="sim-chip" onClick={() => handleSendMessage('Please transfer me to a human representative')}>
                    👤 Human transfer
                  </button>
                </div>
              </div>
            )}

            {callState === 'ENDED' && (
              <div className="sim-phone-ended-card">
                <CheckCircle2 size={44} color="#34d399" />
                <h3>Call Completed ({formatTimer(callEndedInfo?.duration || seconds)})</h3>
                <p>Call summary and any support tickets created have been automatically logged in your dashboard.</p>
                <button className="sim-phone-call-btn-large" onClick={handleStartCall} disabled={loading}>
                  <PhoneCall size={18} />
                  <span>Call 1800-XYZ-BANK Again</span>
                </button>
              </div>
            )}
          </div>

          {/* Authentic Phone Controls (Only when Connected) */}
          {callState === 'CONNECTED' && (
            <div className="sim-phone-dial-controls">
              <button
                className={`sim-phone-round-btn ${isMuted ? 'active-mute' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                className="sim-phone-round-btn"
                onClick={() => void handleSendMessage('Please transfer me to a human representative')}
                title="Transfer to Human Supervisor"
              >
                <Users size={20} />
                <span>Transfer</span>
              </button>

              <button
                className={`sim-phone-round-btn ${showTranscript ? 'active' : ''}`}
                onClick={() => setShowTranscript(v => !v)}
                title="Toggle Audit Transcript & Tools"
              >
                <FileText size={20} />
                <span>Transcript</span>
              </button>

              <button
                className="sim-phone-round-btn hangup"
                onClick={handleEndCall}
                title="End Call (Hang up)"
              >
                <PhoneOff size={24} />
                <span>End Call</span>
              </button>
            </div>
          )}

          {/* Collapsible Live Audit Transcript Drawer */}
          {showTranscript && (
            <div className="sim-phone-transcript-drawer" ref={transcriptRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <b style={{ fontSize: '11px', color: '#cbd5e1' }}>Live Audit Transcript & Executed Tools</b>
                <button className="text-button" onClick={() => setShowTranscript(false)}>Hide</button>
              </div>
              {messages.map((m, idx) => (
                <div key={idx} className={`sim-msg ${m.sender}`}>
                  <div className="sim-msg-sender">
                    {m.sender === 'ai' ? 'XYZ BANK AI ASSISTANT' : 'CALLER (YOU)'} • {m.time}
                  </div>
                  <div className="sim-msg-bubble">
                    {m.text}
                    {m.tool && (
                      <div className="sim-tool-badge">
                        <Activity size={12} />
                        <b>Executed Tool:</b> {m.tool}
                      </div>
                    )}
                    {m.sender === 'ai' && m.engine && (
                      <div className="sim-engine-badge">
                        <Sparkles size={10} color="#818cf8" />
                        <span>{m.engine}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Login({ onSubmit, error }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void; error: string }) {
  const [email, setEmail] = useState('admin@xyzbank.local');
  const [password, setPassword] = useState('ChangeThisPassword123!');

  return (
    <div className="login-screen">
      <div className="login-visual">
        <div className="login-brand">
          <div className="brand-mark"><Building2 size={23} /></div>
          <div><strong>XYZ BANK</strong><span>AI OPERATIONS</span></div>
        </div>
        <div className="login-copy">
          <div className="eyebrow light">NEXT-GENERATION CUSTOMER CARE</div>
          <h1>Every call.<br /><em>Handled with care.</em></h1>
          <p>One secure workspace for AI-powered voice support, customer issues and operational oversight.</p>
          <div className="login-features">
            <div><CheckCircle2 size={17} /> Secure by design</div>
            <div><CheckCircle2 size={17} /> Human-ready escalation</div>
            <div><CheckCircle2 size={17} /> Auditable AI actions</div>
          </div>
        </div>
        <div className="login-visual-foot">
          <span>XYZ BANK AI</span><span>Responsible AI support platform</span>
        </div>
      </div>
      <div className="login-form-area">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-icon"><ShieldCheck size={23} /></div>
          <div className="eyebrow">STAFF ACCESS</div>
          <h2>Welcome back</h2>
          <p>Sign in to your operations workspace.</p>
          {error && <div className="alert"><AlertTriangle size={16} />{error}</div>}
          <label>
            Work email
            <input
              type="email"
              name="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@xyzbank.local"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button primary login-button">Sign in securely <ArrowUpRight size={16} /></button>
          <button
            type="button"
            className="button secondary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              fontWeight: 600,
              background: '#f8fafc',
              borderColor: '#cbd5e1',
              color: '#1e293b'
            }}
            onClick={() => {
              const fakeForm = document.createElement('form');
              const emailInput = document.createElement('input');
              emailInput.name = 'email';
              emailInput.value = 'admin@xyzbank.local';
              fakeForm.appendChild(emailInput);
              const passInput = document.createElement('input');
              passInput.name = 'password';
              passInput.value = 'ChangeThisPassword123!';
              fakeForm.appendChild(passInput);
              onSubmit({ preventDefault: () => { }, currentTarget: fakeForm } as any);
            }}
          >
            <Sparkles size={16} color="#2563eb" /> Instant Live Demo Access
          </button>
          <div className="login-disclaimer"><ShieldCheck size={14} /> Authorized staff only. Access is monitored and logged.</div>
          <div className="dev-hint" style={{ display: 'flex', flexDirection: 'column', gap: '5px', background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
            <b style={{ fontSize: '10px' }}>Demo Admin Credentials:</b>
            <span style={{ fontSize: '10px' }}>Email: <code>admin@xyzbank.local</code></span>
            <span style={{ fontSize: '10px' }}>Password: <code>ChangeThisPassword123!</code></span>
            <button
              type="button"
              className="text-button"
              style={{ marginTop: '4px', alignSelf: 'flex-start', fontSize: '10px', color: '#15803d' }}
              onClick={() => { setEmail('admin@xyzbank.local'); setPassword('ChangeThisPassword123!'); }}
            >
              ✓ Click to re-fill Admin credentials
            </button>
          </div>
        </form>
        <div className="login-bottom">© {new Date().getFullYear()} XYZ Bank · Internal operations</div>
      </div>
    </div>
  );
}

function Metric({ title, value, delta, icon: Icon, tone }: { title: string; value: number; delta: string; icon: any; tone: string }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{title}</span>
        <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
      </div>
      <div className="metric-value">{value.toLocaleString()}</div>
      <div className="metric-delta"><span className="delta-dot" />{delta}</div>
    </div>
  );
}

function CallsTable({ calls, onTransfer }: { calls: Call[]; onTransfer?: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Call reference</th><th>Caller</th><th>Status</th><th>Started</th><th>Duration</th>{onTransfer && <th>Action</th>}</tr>
        </thead>
        <tbody>
          {calls.map(c => (
            <tr key={c.id}>
              <td>
                <div className="call-ref">
                  <span className="call-ref-icon"><PhoneCall size={14} /></span>
                  <div><b>{c.provider_call_id ? c.provider_call_id.slice(0, 18) : c.id.slice(0, 12)}</b><span>{c.resolution || 'Inbound voice support'}</span></div>
                </div>
              </td>
              <td>{c.from_number_masked || 'Private / unavailable'}</td>
              <td><span className={`status-pill ${c.status.toLowerCase()}`}>{c.status.replace('_', ' ')}</span></td>
              <td>{new Date(c.started_at).toLocaleString()}</td>
              <td>{c.duration_seconds == null ? '—' : `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s`}</td>
              {onTransfer && <td>{['RINGING', 'IN_PROGRESS'].includes(c.status) ? <button className="text-button" onClick={() => void onTransfer(c.id)}>Transfer <ArrowUpRight size={13} /></button> : <span>—</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!calls.length && <Empty icon={PhoneCall} title="No calls recorded yet" text="Once an inbound call or simulation is started, it will appear here." />}
    </div>
  );
}

function TicketsTable({ tickets, onStatusChange }: { tickets: Ticket[]; onStatusChange?: (id: string, status: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Reference</th><th>Issue</th><th>Priority</th><th>Status</th><th>Created</th>{onStatusChange && <th>Update</th>}</tr>
        </thead>
        <tbody>
          {tickets.map(t => (
            <tr key={t.id}>
              <td><b className="ticket-ref">{t.reference_code}</b></td>
              <td><div className="ticket-subject"><b>{t.subject}</b><span>{t.category}</span></div></td>
              <td><span className={`priority ${t.priority.toLowerCase()}`}><i />{t.priority}</span></td>
              <td><span className={`status-pill ${t.status.toLowerCase()}`}>{t.status.replace('_', ' ')}</span></td>
              <td>{new Date(t.created_at).toLocaleDateString()}</td>
              {onStatusChange && <td><select className="inline-select" value={t.status} onChange={e => void onStatusChange(t.id, e.target.value)} aria-label={`Update ${t.reference_code} status`}>{['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!tickets.length && <Empty icon={Ticket} title="Your queue is clear" text="New support requests will show up here." />}
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="empty-state">
      <div><Icon size={21} /></div>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
