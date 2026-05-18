/* Verified Vibe — Profile screen
   "What women see" view: AI-rendered portraits (real photos unlock on match),
   psychographic read, lifestyle signals, embedded trust score, boost actions. */

const { useState: pUseState } = React;

function ProfileScreen({ onEditTrust }) {
  const me = window.SELF;
  const pub = window.PUBLIC_PROFILE;
  const boost = window.BOOST_ACTIONS || [];
  const [activePhoto, setActivePhoto] = pUseState(0);
  const [view, setView] = pUseState("public"); // public | trust

  const totalBoost = boost.reduce((n, b) => n + b.pts, 0);
  const trustLabel = me.trustScore >= 80 ? "High Trust" : me.trustScore >= 60 ? "Solid" : "Building";

  return (
    <div className="screen enter profile" data-screen-label="02 Profile">
      {/* ===== HERO — AI rendered photo ===== */}
      <div className="prof-hero">
        <div className="prof-hero-photo" style={{ backgroundImage: `url(${pub.aiPhotos[activePhoto].url})` }}>
          <div className="prof-hero-grain" />
          <div className="prof-ai-badge">
            <span className="prof-ai-dot" />
            AI rendered · real photos unlock on match
          </div>
          <div className="prof-photo-mood">{pub.aiPhotos[activePhoto].mood}</div>
        </div>

        <div className="prof-photo-strip">
          {pub.aiPhotos.map((p, i) => (
            <button
              key={i}
              className={`prof-thumb ${activePhoto === i ? "active" : ""}`}
              style={{ backgroundImage: `url(${p.url})` }}
              onClick={() => setActivePhoto(i)}
              aria-label={p.mood}
            />
          ))}
          <button className="prof-thumb add" title="Generate another">
            <Icon name="spark" size={14} />
          </button>
        </div>

        <div className="prof-hero-meta">
          <div className="prof-name-row">
            <h1 className="prof-name t-display">{me.firstName}, <span className="age">{me.age}</span></h1>
            <span className="prof-arch-chip">🎯 Casual Man</span>
          </div>
          <div className="prof-sub">
            <Icon name="pin" size={12} />
            <span>{me.city}</span>
            <span className="dot-sep">·</span>
            <span>Verified <span className="t-em">{me.trustScore}</span> trust</span>
          </div>
          <p className="prof-tagline">"{pub.tagline}"</p>
        </div>
      </div>

      {/* ===== VIEW TOGGLE ===== */}
      <div className="prof-tabs">
        <button className={view === "public" ? "active" : ""} onClick={() => setView("public")}>
          <Icon name="heart" size={14} />
          The Public read
        </button>
        <button className={view === "trust" ? "active" : ""} onClick={() => setView("trust")}>
          <Icon name="shield-fill" size={14} />
          Trust & boost
          <span className="prof-tab-num">+{totalBoost}</span>
        </button>
      </div>

      {view === "public" && (
        <div className="prof-body">
          {/* Vibe chips */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="spark" size={12} />
              <span>The vibe in three words (or five)</span>
            </div>
            <div className="prof-vibe">
              {pub.vibeChips.map((v, i) => (
                <span key={v} className={`prof-vibe-chip ${i === 0 ? "lead" : ""}`}>{v}</span>
              ))}
            </div>
          </section>

          {/* Personality reads */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="user-check" size={12} />
              <span>Personality reads</span>
              <span className="prof-sect-meta">inferred from Q&A + lifestyle</span>
            </div>
            <div className="prof-pers">
              {pub.personality.map(p => (
                <div key={p.trait} className="prof-pers-row">
                  <div className="prof-pers-top">
                    <span className="prof-pers-name">{p.trait}</span>
                    <span className="prof-pers-level">{labelFor(p.level)}</span>
                  </div>
                  <div className="prof-pers-bar">
                    <div className="fill" style={{ width: `${p.level * 100}%` }} />
                    {[0.25, 0.5, 0.75].map(t => (
                      <span key={t} className="tick" style={{ left: `${t * 100}%` }} />
                    ))}
                  </div>
                  <div className="prof-pers-blurb">{p.blurb}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Lifestyle */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="compass" size={12} />
              <span>Lifestyle signals</span>
              <span className="prof-sect-meta">verified · last 90 days</span>
            </div>
            <div className="prof-life">
              {pub.lifestyle.map(l => (
                <div key={l.label} className="prof-life-card">
                  <span className="ico">{l.icon}</span>
                  <div className="col">
                    <span className="k">{l.label}</span>
                    <span className="v">{l.value}</span>
                    <span className="d">{l.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Communication */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="msg" size={12} />
              <span>How he communicates</span>
            </div>
            <div className="prof-comms">
              <div className="prof-comm-row">
                <span className="prof-comm-k">Style</span>
                <span className="prof-comm-v">{pub.communication.style}</span>
              </div>
              <div className="prof-comm-row">
                <span className="prof-comm-k">Reply pace</span>
                <span className="prof-comm-v">{pub.communication.pace}</span>
              </div>
              <div className="prof-comm-row">
                <span className="prof-comm-k">Voice</span>
                <span className="prof-comm-v">{pub.communication.voice}</span>
              </div>
              <div className="prof-comm-quote">"{pub.communication.detail}"</div>
            </div>
          </section>

          {/* Bringing to the table */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="flame" size={12} />
              <span>What he brings</span>
            </div>
            <div className="prof-brings-list">
              {pub.bringing.map(b => (
                <div key={b} className="prof-brings-item">
                  <span className="check"><Icon name="check" size={11} /></span>
                  {b}
                </div>
              ))}
            </div>
          </section>

          {/* Looking for */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="heart-fill" size={12} />
              <span>Here for</span>
            </div>
            <div className="prof-here">
              <div className="prof-here-head">{pub.lookingFor.headline}</div>
              <div className="prof-here-body">{pub.lookingFor.detail}</div>
            </div>
          </section>

          {/* Dealbreakers */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="x-circle" size={12} />
              <span>Hard nos</span>
            </div>
            <div className="prof-noes">
              {pub.dealbreakers.map(d => (
                <span key={d} className="prof-no-chip">
                  <span className="glyph">✕</span>{d}
                </span>
              ))}
            </div>
          </section>

          <div className="prof-foot-note">
            <Icon name="lock" size={11} />
            This is what verified women see. Real photos and full name
            unlock only after a match — and only to her.
          </div>
        </div>
      )}

      {view === "trust" && (
        <div className="prof-body">
          {/* Compact trust gauge */}
          <section className="prof-sect prof-trust-card">
            <div className="prof-trust-top">
              <div>
                <div className="t-tiny">Your trust score</div>
                <div className="prof-trust-num">
                  <span className="t-display">{me.trustScore}</span>
                  <span className="prof-trust-max">/ 100</span>
                </div>
                <div className="prof-trust-label">{trustLabel} · <span className="t-muted">Top 40% Casual Men · Brooklyn</span></div>
              </div>
              <div className="prof-trust-ring">
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <defs>
                    <linearGradient id="prof-grad" x1="0" x2="1" y1="1" y2="0">
                      <stop offset="0" stopColor="var(--accent)" />
                      <stop offset="1" stopColor="var(--accent-bright)" />
                    </linearGradient>
                  </defs>
                  <circle cx="40" cy="40" r="32" stroke="var(--bg-3)" strokeWidth="6" fill="none" />
                  <circle
                    cx="40" cy="40" r="32"
                    stroke="url(#prof-grad)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - me.trustScore / 100)}
                    transform="rotate(-90 40 40)"
                    style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }}
                  />
                </svg>
              </div>
            </div>

            <div className="prof-trust-stats">
              <div className="prof-trust-stat">
                <span className="k">Identity</span>
                <span className="v">{me.identity.score}<span className="m">/{me.identity.max}</span></span>
              </div>
              <div className="prof-trust-stat">
                <span className="k">Lifestyle</span>
                <span className="v">{me.lifestyle.score}<span className="m">/{me.lifestyle.max}</span></span>
              </div>
              <div className="prof-trust-stat warn">
                <span className="k">Intent</span>
                <span className="v">{me.intent.score}<span className="m">/{me.intent.max}</span></span>
              </div>
            </div>
          </section>

          {/* Boost actions */}
          <section className="prof-sect">
            <div className="prof-sect-head">
              <Icon name="spark" size={12} />
              <span>Raise your score</span>
              <span className="prof-sect-meta"><span className="t-em">+{totalBoost} pts</span> available</span>
            </div>

            <div className="prof-boost-list">
              {boost.map(b => (
                <button key={b.id} className="prof-boost" onClick={onEditTrust}>
                  <span className="prof-boost-pts">+{b.pts}</span>
                  <span className="prof-boost-ico"><Icon name={b.icon} size={16} /></span>
                  <span className="prof-boost-copy">
                    <span className="n">{b.title}</span>
                    <span className="d">{b.sub}</span>
                  </span>
                  <span className="prof-boost-time">{b.time}</span>
                  <span className="prof-boost-chev"><Icon name="chev-right" size={16} /></span>
                </button>
              ))}
            </div>
          </section>

          {/* What this gets you */}
          <section className="prof-sect prof-perks">
            <div className="prof-sect-head">
              <Icon name="shield" size={12} />
              <span>What each tier unlocks</span>
            </div>
            <div className="prof-tier">
              <span className={`prof-tier-dot ${me.trustScore >= 60 ? "done" : ""}`}>{me.trustScore >= 60 ? <Icon name="check" size={10} /> : "60"}</span>
              <div className="col">
                <div className="prof-tier-h">60 · Visible</div>
                <div className="prof-tier-s">You start showing up in pools.</div>
              </div>
            </div>
            <div className="prof-tier">
              <span className={`prof-tier-dot ${me.trustScore >= 70 ? "done" : ""}`}>{me.trustScore >= 70 ? <Icon name="check" size={10} /> : "70"}</span>
              <div className="col">
                <div className="prof-tier-h">70 · Featured</div>
                <div className="prof-tier-s">Spoilt Women see you in their "Live now". <strong>← you're here</strong></div>
              </div>
            </div>
            <div className="prof-tier">
              <span className="prof-tier-dot">85</span>
              <div className="col">
                <div className="prof-tier-h">85 · Priority</div>
                <div className="prof-tier-s">You appear first. Marriage-Minded matches open up.</div>
              </div>
            </div>
            <div className="prof-tier">
              <span className="prof-tier-dot">95</span>
              <div className="col">
                <div className="prof-tier-h">95 · Elite</div>
                <div className="prof-tier-s">Safety-First Women can see you. Their pool is exclusive.</div>
              </div>
            </div>
          </section>

          <div className="prof-foot-note">
            <Icon name="lock" size={11} />
            Everything here stays private. Matches only see the public read.
          </div>
        </div>
      )}
    </div>
  );
}

function labelFor(level) {
  if (level >= 0.85) return "Very high";
  if (level >= 0.7)  return "High";
  if (level >= 0.5)  return "Solid";
  if (level >= 0.3)  return "Moderate";
  return "Low";
}

Object.assign(window, { ProfileScreen });
