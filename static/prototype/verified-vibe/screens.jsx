/* Verified Vibe — 5 hero screens
   Home, Trust Dashboard, Discovery, Match (overlay), Chat
*/

const { useState: useStateS, useEffect: useEffectS, useRef: useRefS, useMemo: useMemoS } = React;

/* ============================================================
   0. GATE — quick age + gender check
   ============================================================ */
function GateScreen({ onPass }) {
  const [gender, setGender] = useStateS(null);     // 'man' | 'woman'
  const [over18, setOver18] = useStateS(false);
  const ready = gender && over18;

  return (
    <div className="screen enter gate" data-screen-label="00 Gate">
      <div className="gate-hero">
        <div className="gate-eyebrow">
          <span className="pulse" />
          Verified Vibe
        </div>
        <h1 className="gate-title">Two<br/>questions.<br/><em>Then we move.</em></h1>
        <p className="gate-sub">No accounts yet. No email. Just tell us who's setting up.</p>
      </div>

      <div className="gate-q">
        <div className="gate-q-label">
          <span className={`gate-q-num ${gender ? "done" : ""}`}>{gender ? <Icon name="check" size={11} /> : "1"}</span>
          <span className="gate-q-title">I'm a…</span>
        </div>
        <div className="gate-pick">
          <button className={`gate-pick-btn ${gender === "man" ? "selected" : ""}`} onClick={() => setGender("man")}>
            <span className="pick-ico">♂</span>
            <span className="pick-name">Man</span>
            <span className="pick-sub">See Casual & Marriage-Minded</span>
          </button>
          <button className={`gate-pick-btn ${gender === "woman" ? "selected" : ""}`} onClick={() => setGender("woman")}>
            <span className="pick-ico">♀</span>
            <span className="pick-name">Woman</span>
            <span className="pick-sub">See Spoilt & Safety-First</span>
          </button>
        </div>
      </div>

      <div className="gate-q">
        <div className="gate-q-label">
          <span className={`gate-q-num ${over18 ? "done" : ""}`}>{over18 ? <Icon name="check" size={11} /> : "2"}</span>
          <span className="gate-q-title">I'm 18 or older</span>
        </div>
        <button
          className={`gate-age ${over18 ? "checked" : ""}`}
          onClick={() => setOver18(v => !v)}
          type="button"
        >
          <span className="box">{over18 && <Icon name="check" size={14} />}</span>
          <span className="copy">
            <span className="l">Yes, I'm 18+</span>
            <span className="s">Required — we ID-verify everyone, no exceptions.</span>
          </span>
        </button>
      </div>

      <div className="gate-cta">
        <Btn full disabled={!ready} onClick={() => ready && onPass({ gender, over18 })}>
          {ready ? "Let's go →" : "Pick both to continue"}
        </Btn>
        <div className="gate-foot">
          By continuing you agree to ID verification, our <a>Terms</a> and <a>Privacy</a>.<br/>We never share ID details with matches.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   1. HOME — Archetype selector
   ============================================================ */
function HomeScreen({ gender, onContinue }) {
  const [openId, setOpenId] = useStateS(null);
  const archetypes = useMemoS(
    () => gender ? window.ARCHETYPES.filter(a => a.gender === gender) : window.ARCHETYPES,
    [gender]
  );
  const open = archetypes.find(a => a.id === openId);

  return (
    <div className="screen enter" data-screen-label="01 Home">
      <div className="home">
        <div className="home-hero">
          <div className="home-mark">
            <span className="shield"><Icon name="shield-fill" size={14} /></span>
            Verified Vibe · v1
          </div>
          <h1 className="home-title">Pick your<br/><em>lane.</em></h1>
          <p className="home-tag">Stop swiping blind. Earn your profile, verify your intent, and start speaking to people who actually want what you want. <em>Pay later.</em></p>
        </div>

        {!open && (
          <>
            <div className="home-prompt">{gender === "woman" ? "What do you want?" : "What are you here for?"}</div>
            <div className="home-prompt-sub">Pick one. You can switch later — but switching means re-verifying.</div>
            <div className="archetype-grid">
              {archetypes.map(a => (
                <button key={a.id} className="archetype" onClick={() => setOpenId(a.id)}>
                  <span className="ico">{a.emoji}</span>
                  <span className="label">
                    <span className="name">{a.name}</span>
                    <span className="desc">{a.tag}</span>
                  </span>
                  <span className="chev"><Icon name="chev-right" size={18} /></span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 22, fontSize: 12, color: "var(--text-3)", textAlign: "center", lineHeight: 1.55 }}>
              We verify ID, photos, spending pattern & intent.<br/>No one sees the raw files — only the signals you allow.
            </div>

            <LiveCarousel
              gender={gender}
              prompt={<>Finish onboarding and you'll be speaking to a few of them <strong>within 30 minutes.</strong></>}
            />
          </>
        )}

        {open && (
          <div className="archetype-detail">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <span className="ico-big">{open.emoji}</span>
              <div className="col" style={{ gap: 4, flex: 1 }}>
                <div className="t-tiny">You're a</div>
                <div className="t-display" style={{ fontSize: 32 }}>{open.name}.</div>
              </div>
              <button className="btn btn-ghost sm" onClick={() => setOpenId(null)}><Icon name="x" size={16} /></button>
            </div>

            <div className="t-body" style={{ color: "var(--text-2)" }}>{open.longTag}</div>

            <div className="traits-section match">
              <div className="traits-head">
                <span className="ico"><Icon name="heart-fill" size={10} /></span>
                You'll match with
              </div>
              <div className="traits">
                {open.matchTraits.map((tr, i) => (
                  <span key={i} className={`trait match ${tr.lead ? "lead" : ""}`}>
                    {!tr.lead && <span className="glyph">✓</span>}
                    <span>{tr.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="traits-section avoid">
              <div className="traits-head">
                <span className="ico"><Icon name="x" size={10} /></span>
                You won't see
              </div>
              <div className="traits">
                {open.avoidTraits.map((tr, i) => (
                  <span key={i} className="trait avoid">
                    <span className="glyph">✕</span>
                    <span>{tr.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="brings-section">
              <div className="brings-head">
                <span className="ico"><Icon name="spark" size={10} /></span>
                What you bring to the table
              </div>
              <div className="brings">
                {open.brings.map((b, i) => (
                  <span key={i} className="trait brings">
                    <span className="glyph">✓</span>
                    <span>{b}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <Btn full onClick={() => onContinue(open.id)}>Lock it in — start verifying →</Btn>
              <Btn variant="ghost" full onClick={() => setOpenId(null)}>← Show me the others</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   1.5 VERIFY — requirements before onboarding
   ============================================================ */
function VerifyScreen({ archetypeId, onBack, onStart }) {
  const a = window.ARCHETYPES.find(x => x.id === archetypeId) || window.ARCHETYPES[0];
  const items = a.needs.map((n) => {
    // split "Government ID (prove you're real)" → label + desc
    const m = n.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { n: m[1].trim(), d: m[2].trim() };
    return { n, d: "" };
  });

  return (
    <div className="screen enter verify" data-screen-label="01b Verify requirements">
      <div className="verify-top">
        <button className="verify-back" onClick={onBack}><Icon name="back" size={16} /></button>
        <div className="col" style={{ gap: 0 }}>
          <span className="verify-eyebrow">Step 1 of 4</span>
          <span className="verify-archetype">{a.emoji} You're a {a.name}</span>
        </div>
      </div>

      <div className="verify-hero">
        <h2>Earn your<br/><em>profile.</em></h2>
        <p>Four steps. Each one takes under a minute. We verify, you control what's visible.</p>
      </div>

      <div className="verify-list">
        {items.map((it, i) => {
          const time = ["~30 sec", "~60 sec", "~45 sec", "~2 min", "~1 min"][i] || "~1 min";
          return (
            <div key={i} className="verify-item">
              <span className="step">{String(i + 1).padStart(2, "0")}</span>
              <span className="label">
                <span className="n">{it.n}</span>
                {it.d && <span className="d">{it.d}</span>}
              </span>
              <span className="t">{time}</span>
            </div>
          );
        })}
      </div>

      <div className="verify-time">
        <span className="ico"><Icon name="flame" size={14} /></span>
        Total time · <span className="em">~{a.timeMins} min</span>
        <span className="spacer" />
        <span className="t-mono" style={{ fontSize: 11, color: "var(--text-3)" }}>Pause anytime</span>
      </div>

      <LiveCarousel
        gender={a.gender === "man" ? "man" : "woman"}
        archetypeId={a.id}
        compact
        prompt={<>The moment you're verified, you're talking to a few of them <strong>within 30 minutes.</strong></>}
      />

      <div className="verify-foot">
        <Btn full onClick={onStart}>Start with Government ID →</Btn>
        <div className="verify-privacy">
          <Icon name="lock" size={11} /> Files stored encrypted. We surface signals — never the raw documents.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   2. TRUST DASHBOARD
   ============================================================ */
function TrustScreen({ gaugeStyle, onEditQA }) {
  const me = window.SELF;
  const totalMax = me.identity.max + me.lifestyle.max + me.intent.max;

  return (
    <div className="screen enter" data-screen-label="02 Trust">
      <div className="trust">
        <div className="trust-header">
          <div className="trust-eyebrow">Your trust score</div>
          <TrustGauge score={me.trustScore} max={100} style={gaugeStyle} />
          {gaugeStyle === "radial" && (
            <>
              <div className="gauge-label">High Trust — you're earning it</div>
              <div className="gauge-rank">Top 40% of Casual Men · Brooklyn</div>
            </>
          )}
        </div>

        <div className="trust-stats">
          <div className="trust-stat">
            <div className="k">Identity</div>
            <div className="v">{me.identity.score}<span className="total">/{me.identity.max}</span></div>
          </div>
          <div className="trust-stat">
            <div className="k">Lifestyle</div>
            <div className="v">{me.lifestyle.score}<span className="total">/{me.lifestyle.max}</span></div>
          </div>
          <div className="trust-stat">
            <div className="k">Intent</div>
            <div className="v">{me.intent.score}<span className="total">/{me.intent.max}</span></div>
          </div>
        </div>

        <div className="breakdown">
          {[
            { ...me.identity, name: "Identity", iconName: "user-check", state: "ok" },
            { ...me.lifestyle, name: "Lifestyle", iconName: "spark", state: "ok" },
            { ...me.intent, name: "Intent", iconName: "compass", state: "warn" }
          ].map(b => (
            <div className="bd" key={b.name}>
              <div className="bd-head">
                <span className={`bd-dot ${b.state}`} />
                <span className="name">{b.name}</span>
                <span className="score t-mono">{b.score}<span className="max">/{b.max}</span></span>
              </div>
              <div className="bd-items">
                {b.items.map((it, i) => (
                  <div key={i} className={`bd-item ${it.ok ? "" : "warn"}`}>
                    <Icon name={it.ok ? "check" : "info"} size={14} />
                    <span>{it.label}</span>
                    {it.note && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600 }}>{it.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="nudge">
          <div className="nudge-head"><Icon name="spark" size={14} />Boost "Intent Clarity"</div>
          <div className="nudge-body">Q1 said "casual" but Q3 hinted long-term. Tighten that and you pick up <strong style={{ color: "var(--accent-bright)" }}>+5 pts</strong> — enough to crack the top decile.</div>
          <Btn variant="primary" size="sm" onClick={onEditQA}>Fix it now · 2 min</Btn>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="t-tiny" style={{ marginBottom: 6 }}>What this gets you</div>
          <div className="t-small" style={{ color: "var(--text-2)", lineHeight: 1.55 }}>
            72 lands you top-tier — Spoilt Women see you first. Drop below 60 and you stop showing up. Re-upload anything to push it.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   3. DISCOVERY
   ============================================================ */
function DiscoveryScreen({ onMatch, interaction = "both", showBackdrop = true }) {
  const [stack, setStack] = useStateS(window.PROFILES);
  const [drag, setDrag] = useStateS({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useStateS(null); // { dir: 'left' | 'right' }
  const [passesLeft, setPassesLeft] = useStateS(7);
  const [filter, setFilter] = useStateS("compatible");
  const cardRef = useRefS(null);
  const start = useRefS({ x: 0, y: 0 });

  const top = stack[0];
  const peek = stack[1];

  const swipeOff = (dir) => {
    if (!top) return;
    setExiting({ dir, id: top.id });
    setTimeout(() => {
      // matched on right swipe for first profile only (demo)
      if (dir === "right" && top.id === window.MATCH_PROFILE.id) {
        onMatch(top);
      }
      setStack(s => s.slice(1));
      setExiting(null);
      setDrag({ x: 0, y: 0, active: false });
      if (dir === "left") setPassesLeft(p => Math.max(0, p - 1));
    }, 320);
  };

  const onPointerDown = (e) => {
    if (interaction === "tap") return;
    start.current = { x: e.clientX ?? e.touches?.[0]?.clientX, y: e.clientY ?? e.touches?.[0]?.clientY };
    setDrag({ x: 0, y: 0, active: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.active) return;
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - start.current.x;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - start.current.y;
    setDrag({ x, y, active: true });
  };
  const onPointerUp = () => {
    if (!drag.active) return;
    const TH = 100;
    if (drag.x > TH) swipeOff("right");
    else if (drag.x < -TH) swipeOff("left");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const topTransform = exiting
    ? `translateX(${exiting.dir === "right" ? 600 : -600}px) rotate(${exiting.dir === "right" ? 25 : -25}deg)`
    : drag.active
    ? `translate(${drag.x}px, ${drag.y * 0.3}px) rotate(${drag.x * 0.05}deg)`
    : "translate(0, 0) rotate(0)";

  const topOpacity = exiting ? 0 : 1;
  const passOpacity = Math.max(0, Math.min(1, -drag.x / 100));
  const likeOpacity = Math.max(0, Math.min(1, drag.x / 100));

  return (
    <div className="screen enter" data-screen-label="03 Discovery">
      <div className="discovery">
        <div className="discover-head">
          <div>
            <div className="title t-display" style={{ fontSize: 30 }}>Tonight's pool</div>
            <div className="who">Spoilt Women · within 5 mi</div>
          </div>
          <div className="passes">
            <Icon name="flame" size={12} />
            <span className="n">{passesLeft}</span>
            <span style={{ color: "var(--text-3)" }}>/10</span>
          </div>
        </div>

        <div className="filters">
          {[
            { id: "compatible", label: "Compatible 💎 💍" },
            { id: "all", label: "All archetypes" },
            { id: "score", label: "Score 70+" },
            { id: "near", label: "< 5 mi" },
            { id: "new", label: "New today" }
          ].map(f => (
            <button key={f.id} className={`filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="deck">
          {peek && (
            <div className="profile-card peek">
              <div className="img" style={{ backgroundImage: `url(${peek.photo})` }} />
            </div>
          )}
          {top && (
            <div
              ref={cardRef}
              className={`profile-card ${drag.active ? "dragging" : ""}`}
              style={{ transform: topTransform, opacity: topOpacity }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="img" style={{ backgroundImage: `url(${top.photo})` }} />

              {showBackdrop && (
                <>
                  <div className="swipe-tag pass" style={{ opacity: passOpacity }}>NOT FOR ME</div>
                  <div className="swipe-tag like" style={{ opacity: likeOpacity }}>INTERESTED</div>
                </>
              )}

              <div className="verified-badge">
                <Icon name="shield-fill" size={12} />
                <span>VERIFIED</span>
                <span className="sep2" />
                <span className="score">{top.trustScore}</span>
              </div>

              <div className="meta">
                <div className="name-row">
                  <span className="t-display">{top.name}</span>
                  <span className="age">· {top.age}</span>
                </div>
                <div className="loc">
                  <Icon name="pin" size={12} />
                  <span>{top.city} · {top.distance}</span>
                </div>
                <div className="about">{top.about}</div>
                <div className="chips">
                  <span className="chip em">{top.archEmoji} {top.archetype === "spoilt_woman" ? "Spoilt Woman" : "Marriage-Minded"}</span>
                  {top.verified.slice(0, 3).map(v => (
                    <span className="chip" key={v}><Icon name="check" size={10} /> {v}</span>
                  ))}
                  <span className="chip"><Icon name="wallet" size={10} /> ${top.spending.dining}/mo dining</span>
                </div>
              </div>
            </div>
          )}
          {!top && (
            <div className="profile-card" style={{ display: "grid", placeItems: "center", padding: 28 }}>
              <div style={{ textAlign: "center" }}>
                <div className="t-display" style={{ fontSize: 36 }}>You're caught up.</div>
                <div className="t-muted t-small" style={{ marginTop: 8 }}>Come back at midnight — we'll have new people for you.</div>
              </div>
            </div>
          )}
        </div>

        {(interaction === "tap" || interaction === "both") && top && (
          <div className="deck-actions">
            <button className="act pass" onClick={() => swipeOff("left")} title="Not for me">
              <Icon name="x" size={22} />
            </button>
            <button className="act info" title="See full profile">
              <Icon name="info" size={18} />
            </button>
            <button className="act like" onClick={() => swipeOff("right")} title="Interested">
              <Icon name="heart-fill" size={22} />
            </button>
          </div>
        )}

        {interaction === "swipe" && (
          <div style={{ textAlign: "center", padding: "16px 22px 0", color: "var(--text-3)", fontSize: 12 }}>
            Swipe left to skip · right to start something
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   4. MATCH (overlay)
   ============================================================ */
function MatchOverlay({ profile, onSendMessage, onClose }) {
  const [confetti] = useStateS(() => Array.from({ length: 24 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    rot: Math.random() * 360,
    color: i % 3 === 0 ? "var(--accent-bright)" : i % 3 === 1 ? "var(--accent)" : "#fbbf24"
  })));

  return (
    <div className="match-overlay">
      <div className="match-burst" />
      <div className="confetti">
        {confetti.map((c, i) => (
          <span key={i} style={{
            left: `${c.left}%`,
            animationDelay: `${c.delay}s`,
            background: c.color,
            transform: `rotate(${c.rot}deg)`
          }} />
        ))}
      </div>

      <button className="close-x" onClick={onClose}><Icon name="x" size={16} /></button>

      <div className="match-content">
        <div className="match-eyebrow">✨ It's a match</div>
          <h1 className="match-title">You both<br/>showed up.</h1>

        <div className="match-photos">
          <div className="match-photo left" style={{ backgroundImage: `url(${window.SELF.avatar})` }} />
          <div className="match-photo right" style={{ backgroundImage: `url(${profile.photo})` }} />
        </div>

        <div className="match-pair">
          <em>🎯</em> Casual Man
          <span className="x">+</span>
          <em>{profile.archEmoji}</em> Spoilt Woman
        </div>

        <div className="match-next">
          <div className="h">Do these three</div>
          <ol>
            <li>Open with something specific from her profile</li>
            <li>Keep it here — don't move to text till you've met</li>
            <li>Propose a date when it feels right — we'll help</li>
          </ol>
        </div>

        <div className="match-safety">
          <strong>Both profiles are verified.</strong> If anything feels off — even a vibe — tap the report button. We act fast.
        </div>

        <div className="match-cta">
          <Btn full onClick={onSendMessage}><Icon name="send" size={16} />Send the first message</Btn>
          <Btn variant="ghost" full onClick={onClose}>View her profile again</Btn>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   5. CHAT
   ============================================================ */
function ChatScreen({ profile, onBack }) {
  const [messages, setMessages] = useStateS(window.MESSAGES);
  const [draft, setDraft] = useStateS("");
  const [typing, setTyping] = useStateS(false);
  const threadRef = useRefS(null);

  useEffectS(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, typing]);

  const send = () => {
    if (!draft.trim()) return;
    const txt = draft;
    const nextId = messages.length + 1;
    setMessages(m => [...m, { id: nextId, from: "me", text: txt, time: "now" }]);
    setDraft("");
    // simulated reply
    setTimeout(() => setTyping(true), 600);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, {
        id: nextId + 1,
        from: "them",
        text: ["Lol you don't waste time", "Friday works.", "Send a place and I'll be there.", "Okay deal."][Math.floor(Math.random() * 4)],
        time: "now"
      }]);
    }, 2200);
  };

  return (
    <div className="screen enter chat" data-screen-label="05 Chat">
      <div className="chat-header">
        <button className="icon-btn" onClick={onBack} title="Back"><Icon name="back" size={18} /></button>
        <div className="avatar" style={{ backgroundImage: `url(${profile.photo})` }} />
        <div className="who">
          <span className="name">{profile.name}, {profile.age}</span>
          <span className="sub"><span className="dot" /> Verified · trust {profile.trustScore}</span>
        </div>
        <span className="spacer" />
        <button className="icon-btn" title="Video call"><Icon name="video" size={18} /></button>
        <button className="icon-btn" title="More"><Icon name="dots" size={18} /></button>
      </div>

      <div className="intent-banner">
        <div className="pair">
          <em>🎯</em> Casual Man <span style={{ color: "var(--text-3)" }}>matched with</span> <em>{profile.archEmoji}</em> Spoilt Woman
        </div>
        <div className="sub">
          <span>Both verified</span>
          <span>·</span>
          <span>trust <span className="score">{window.SELF.trustScore}</span> & <span className="score">{profile.trustScore}</span></span>
          <span style={{ marginLeft: "auto" }}>
            <button className="badge" style={{ background: "transparent", border: "1px solid var(--border-2)" }}>
              <Icon name="report" size={11} /> Report
            </button>
          </span>
        </div>
      </div>

      <div className="thread" ref={threadRef}>
        <div className="daydiv">Yesterday</div>
        {messages.slice(0, 3).map(m => (
          <div key={m.id} className={`bubble ${m.from}`}>{m.text}</div>
        ))}
        <div className="daydiv">Today</div>
        {messages.slice(3).map(m => (
          <div key={m.id} className={`bubble ${m.from}`}>{m.text}</div>
        ))}

        {typing && (
          <div className="typing"><span /><span /><span /></div>
        )}

        <div className="date-card">
          <div className="h">
            <Icon name="calendar" size={12} />
            <span className="em">Suggest a date</span>
            <span className="spacer" />
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>Draft · not sent</span>
          </div>
          <div className="fields">
            <div className="date-field">
              <span className="k">When</span>
              <span className="v">{window.DATE_PROPOSAL.when}</span>
            </div>
            <div className="date-field">
              <span className="k">Where</span>
              <span className="v">{window.DATE_PROPOSAL.where} <span className="light">· {window.DATE_PROPOSAL.vibe}</span></span>
            </div>
            <div className="date-field">
              <span className="k">Budget</span>
              <span className="v">{window.DATE_PROPOSAL.budget}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="primary" size="sm" style={{ flex: 1 }}><Icon name="send" size={14} /> Send proposal</Btn>
            <Btn variant="secondary" size="sm">Tweak</Btn>
          </div>
        </div>
      </div>

      <div className="chat-input">
        <button className="icon-btn" title="Photo"><Icon name="camera" size={18} /></button>
        <div className="input-shell">
          <input
            placeholder="Type something honest…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
          />
          <button className="icon-btn" title="Emoji"><Icon name="emoji" size={18} /></button>
        </div>
        <button className="send" onClick={send} title="Send"><Icon name="send" size={16} /></button>
      </div>
    </div>
  );
}

Object.assign(window, { GateScreen, HomeScreen, VerifyScreen, TrustScreen, DiscoveryScreen, MatchOverlay, ChatScreen });
