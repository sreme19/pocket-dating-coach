/* Verified Vibe — primitives & shared bits */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Tiny icons (stroke-based, minimal, premium) ---------- */
const Icon = ({ name, size = 18, ...rest }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 1.8,
    strokeLinecap: "round", strokeLinejoin: "round",
    ...rest
  };
  switch (name) {
    case "check": return <svg {...props}><polyline points="4 12 10 18 20 6" /></svg>;
    case "check-circle": return <svg {...props}><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></svg>;
    case "x": return <svg {...props}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>;
    case "chev-right": return <svg {...props}><polyline points="9 6 15 12 9 18" /></svg>;
    case "chev-down": return <svg {...props}><polyline points="6 9 12 15 18 9" /></svg>;
    case "back": return <svg {...props}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
    case "shield": return <svg {...props}><path d="M12 3l8 4v6c0 5-4 8-8 9-4-1-8-4-8-9V7l8-4z" /><polyline points="9 12 11.2 14 15 10" /></svg>;
    case "shield-fill": return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}><path d="M12 2l9 4v7c0 5.5-4.4 9.4-9 11-4.6-1.6-9-5.5-9-11V6l9-4z" /></svg>;
    case "spark": return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
    case "flame": return <svg {...props}><path d="M12 3c1 4 4 5 4 9a4 4 0 11-8 0c0-1 .5-2 1-3 .5 2 2 2 2 4 0 0 0-3 1-5 0-2-1-3 0-5z" /></svg>;
    case "compass": return <svg {...props}><circle cx="12" cy="12" r="9" /><polygon points="14.5 9.5 10 11 9.5 14.5 14 13" /></svg>;
    case "msg": return <svg {...props}><path d="M21 11.5a8.4 8.4 0 01-1 4 8.5 8.5 0 01-7.5 4.5 8.4 8.4 0 01-4-1L3 21l2-5.5a8.4 8.4 0 01-1-4 8.5 8.5 0 014.5-7.5 8.4 8.4 0 014-1h.5a8.5 8.5 0 018 8v.5z" /></svg>;
    case "msg-fill": return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}><path d="M21 11.5a8.4 8.4 0 01-1 4 8.5 8.5 0 01-7.5 4.5 8.4 8.4 0 01-4-1L3 21l2-5.5a8.4 8.4 0 01-1-4 8.5 8.5 0 014.5-7.5 8.4 8.4 0 014-1h.5a8.5 8.5 0 018 8v.5z" /></svg>;
    case "heart": return <svg {...props}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.6z" /></svg>;
    case "heart-fill": return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.6z" /></svg>;
    case "x-circle": return <svg {...props}><circle cx="12" cy="12" r="9" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>;
    case "info": return <svg {...props}><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="8" r="0.5" fill="currentColor" /></svg>;
    case "pin": return <svg {...props}><path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>;
    case "filter": return <svg {...props}><polygon points="4 4 20 4 14 12 14 19 10 21 10 12 4 4" /></svg>;
    case "phone": return <svg {...props}><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .3 2 .6 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012-.5c1 .3 2 .5 3 .6a2 2 0 011.7 2.1z" /></svg>;
    case "video": return <svg {...props}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>;
    case "report": return <svg {...props}><path d="M4 4v17" /><path d="M4 4l13 1 -2 5 2 5 -13 -1z" /></svg>;
    case "send": return <svg {...props}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
    case "emoji": return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M8.5 15a4 4 0 007 0" /><line x1="9" y1="10" x2="9" y2="10" /><line x1="15" y1="10" x2="15" y2="10" /></svg>;
    case "camera": return <svg {...props}><path d="M21 19a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3l2-3h4l2 3h3a2 2 0 012 2v11z" /><circle cx="12" cy="13" r="3.5" /></svg>;
    case "dots": return <svg {...props}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></svg>;
    case "lock": return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1A2 2 0 113.4 17l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H2a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1A2 2 0 116 4.4l.1.1a1.7 1.7 0 001.8.3H8a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1A2 2 0 1119.7 7l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
    case "wallet": return <svg {...props}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14.5" r="1" fill="currentColor" /></svg>;
    case "user-check": return <svg {...props}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>;
    default: return null;
  }
};

/* ---------- StatusBar (top of phone) ---------- */
const StatusBar = () => (
  <div className="statusbar">
    <span>9:41</span>
    <span className="icons">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="0.5"/><rect x="5" y="5" width="3" height="7" rx="0.5"/><rect x="10" y="2" width="3" height="10" rx="0.5"/><rect x="15" y="0" width="3" height="12" rx="0.5" opacity="0.5"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 5a10 10 0 0114 0M3.5 7.5a6 6 0 019 0M6 10a2.5 2.5 0 014 0"/></svg>
      <svg width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="22" height="11" rx="3"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="2" height="4" rx="0.5" fill="currentColor"/></svg>
    </span>
  </div>
);

/* ---------- Buttons ---------- */
const Btn = ({ variant = "primary", size, full, pill, children, ...rest }) => (
  <button
    className={`btn btn-${variant} ${size === "sm" ? "sm" : ""} ${full ? "full" : ""} ${pill ? "pill" : ""}`}
    {...rest}
  >
    {children}
  </button>
);

/* ---------- Badge ---------- */
const Badge = ({ tone = "default", icon, children }) => (
  <span className={`badge ${tone === "em" ? "em" : tone === "warn" ? "warn" : tone === "err" ? "err" : ""}`}>
    {icon ? <Icon name={icon} size={12} /> : null}
    {children}
  </span>
);

/* ---------- Progress bar ---------- */
const ProgressBar = ({ pct }) => (
  <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
);

/* ---------- Trust Gauge (3 styles via tweak) ---------- */
const TrustGauge = ({ score = 72, max = 100, style = "radial", label = "High Trust", rank = "Top 40% of Casual Men" }) => {
  const pct = Math.max(0, Math.min(1, score / max));

  if (style === "linear") {
    return (
      <div style={{ width: "100%", padding: "10px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <span className="t-display" style={{ fontSize: 72 }}>{score}</span>
          <span className="t-muted t-mono" style={{ fontSize: 14 }}>/{max}</span>
          <span className="spacer" />
          <span className="t-em" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ height: 10, background: "var(--bg-3)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${pct * 100}%`, height: "100%",
            background: "linear-gradient(90deg, var(--accent), var(--accent-bright))",
            borderRadius: 999,
            boxShadow: "0 0 12px var(--accent-glow)",
            transition: "width 1.2s cubic-bezier(.2,.7,.2,1)"
          }} />
        </div>
        <div className="t-tiny" style={{ marginTop: 10 }}>{rank}</div>
      </div>
    );
  }

  if (style === "arc") {
    const R = 90;
    const C = Math.PI * R;
    const offset = C - pct * C;
    return (
      <div className="gauge-wrap" style={{ height: 160 }}>
        <svg width="220" height="160" style={{ transform: "rotate(0)" }} viewBox="0 0 220 160">
          <defs>
            <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent-bright)" />
            </linearGradient>
          </defs>
          <path d={`M 20 130 A ${R} ${R} 0 0 1 200 130`} fill="none" stroke="var(--bg-3)" strokeWidth="16" strokeLinecap="round" />
          <path d={`M 20 130 A ${R} ${R} 0 0 1 200 130`} fill="none" stroke="url(#gauge-grad)" strokeWidth="16" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 0 12px var(--accent-glow))" }} />
        </svg>
        <div className="gauge-num" style={{ alignItems: "end", paddingBottom: 14 }}>
          {score}<small>out of {max}</small>
        </div>
      </div>
    );
  }

  // default: radial
  const R = 90;
  const C = 2 * Math.PI * R;
  const offset = C - pct * C;
  return (
    <div className="gauge-wrap">
      <svg width="220" height="220" viewBox="0 0 220 220">
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-bright)" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r={R} className="gauge-track" strokeWidth="14" fill="none" strokeLinecap="round" />
        <circle cx="110" cy="110" r={R} className="gauge-fill" strokeWidth="14" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset} />
      </svg>
      <div className="gauge-num">
        <div>
          {score}
          <small>out of {max}</small>
        </div>
      </div>
    </div>
  );
};

/* ---------- Bottom nav ---------- */
const BottomNav = ({ tab, onTab, unread }) => {
  const items = [
    { id: "discover", label: "Discover", icon: "compass" },
    { id: "trust",    label: "Trust",    icon: "shield" },
    { id: "chat",     label: "Messages", icon: "msg", badge: unread }
  ];
  return (
    <nav className="bottomnav">
      {items.map(it => (
        <button key={it.id} className={tab === it.id ? "active" : ""} onClick={() => onTab(it.id)}>
          <span className="nav-icon">
            <Icon name={tab === it.id && it.icon === "msg" ? "msg-fill" : tab === it.id && it.icon === "shield" ? "shield-fill" : it.icon} size={20} />
          </span>
          {it.label}
          {it.badge ? <span className="badge">{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
};

/* ---------- Live-now carousel (gender-aware + archetype filter) ---------- */
const LiveCarousel = ({ gender, archetypeId = null, compact = false, heading = null, prompt = null }) => {
  // gender = the user's gender → show the OPPOSITE gender's pool
  const pool = gender === "woman" ? (window.LIVE_NOW?.men || []) : (window.LIVE_NOW?.women || []);

  // if an archetype is locked in, filter to compatible buckets only
  const allowed = archetypeId ? (window.MATCH_MATRIX?.[archetypeId] || null) : null;
  const filtered = allowed ? pool.filter(p => allowed.includes(p.archetype)) : pool;
  const filteredCount = filtered.length;
  const totalCount = pool.length;
  const onlineCount = filtered.filter(p => p.online).length;

  // duplicate for seamless -50% keyframe loop. Pad up if we ended up with too few.
  const minForLoop = 8;
  const padded = filteredCount === 0
    ? pool
    : filteredCount < minForLoop
      ? Array.from({ length: Math.ceil(minForLoop / filteredCount) }, () => filtered).flat()
      : filtered;
  const doubled = [...padded, ...padded];

  // heading
  let h = heading;
  if (!h) {
    if (archetypeId) {
      h = gender === "woman" ? "Compatible men online now" : "Compatible women online now";
    } else {
      h = gender === "woman" ? "Verified men online now" : "Verified women online now";
    }
  }

  return (
    <div className={`live-now ${compact ? "compact" : ""}`}>
      <div className="live-now-head">
        <span className="pulse-dot" />
        <span className="label">{h}</span>
        <span className="count">
          {archetypeId && filteredCount < totalCount && (
            <span style={{ marginRight: 6, textDecoration: "line-through", color: "var(--text-4)" }}>{totalCount}</span>
          )}
          <span className="em">{onlineCount}</span> live · {filteredCount} today
        </span>
      </div>
      <div className="live-strip">
        <div className="live-track">
          {doubled.map((p, i) => {
            // 3-state status: online → green; offline today (m/h) → orange; >=1d → grey
            const isOnline = !!p.online;
            const isToday = !isOnline && p.lastSeen && !/d/i.test(p.lastSeen);
            const dotCls = isOnline ? "" : (isToday ? "today" : "off");
            return (
              <button key={i} className="live-card" tabIndex={-1}>
                <span className={`live-avatar ${isOnline ? "online" : ""}`} style={{ backgroundImage: `url(${p.photo})` }}>
                  <span className="verified-mini" title="Verified">
                    <Icon name="check" size={10} />
                  </span>
                  <span className={`dot ${dotCls}`} />
                </span>
                <span className="live-name">
                  {p.name} <span className="age">{p.age}</span>
                </span>
                {p.profession && <span className="live-prof">{p.profession}</span>}
                {isOnline ? (
                  <span className="live-status placeholder" aria-hidden="true">·</span>
                ) : (
                  <span className={`live-status ${isToday ? "today" : "stale"}`}>
                    <span className="mini-dot" />
                    {p.lastSeen} ago
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {prompt && (
        <div className="live-prompt">
          <span className="live-prompt-ico"><Icon name="flame" size={13} /></span>
          <span>{prompt}</span>
        </div>
      )}
    </div>
  );
};

/* expose */
Object.assign(window, { Icon, StatusBar, Btn, Badge, ProgressBar, TrustGauge, BottomNav, LiveCarousel });
