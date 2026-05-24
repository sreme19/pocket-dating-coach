/* Verified Vibe — AI Bestie
   Asymmetric screening agent: women get one out of the gate, men earn one.
   Components:
   - AIBestieIncomingBanner   man's chat banner when she has AI on
   - AIBestieBubbleBadge      ✨ tag on messages sent by the bestie
   - AIBestieEnablePrompt     woman's "set up" CTA above input
   - AIBestieActiveCard       woman's "Mira is on duty" status above input
   - AIBestieLocked           man's "you haven't unlocked one" chip
   - AIBestieSetup            full-overlay setup form
*/

const { useState: bUseState } = React;

const personalityLabel = (key) => ({
  sharp:    "Sharp & curious",
  warm:     "Warm & encouraging",
  skeptical:"Skeptical & probing",
  playful:  "Playful & disarming"
}[key] || "Sharp & curious");

const bringInLabel = (key) => ({
  "4-of-5":     "Only after he passes 4 of 5 checks",
  "3-of-5":     "When he clears 3 of 5",
  "every-5":    "Every 5 messages",
  "end-of-day": "End-of-day summary only"
}[key] || "When he clears 3 of 5");

/* ============================================================
   Bubble badge — shown under a message Mira sent
   ============================================================ */
function AIBestieBubbleBadge({ name = "Mira" }) {
  return (
    <div className="ai-msg-meta">
      <span className="sparkle">✨</span>
      <span><strong>{name}</strong></span>
      <span className="dot-sep">·</span>
      <span>AI bestie</span>
    </div>
  );
}

/* ============================================================
   Top-of-chat banner — man's POV, woman has AI on
   ============================================================ */
function AIBestieIncomingBanner({ herName, bestie }) {
  const passed = bestie?.passed ?? 0;
  const total  = bestie?.total ?? 5;
  const pct = Math.round((passed / total) * 100);
  const bestieName = bestie?.name || "Mira";
  return (
    <div className="ai-incoming">
      <div className="ai-incoming-top">
        <div className="ai-incoming-ico">✨</div>
        <div className="ai-incoming-name">
          <span className="ai-incoming-bestie"><strong className="ai-purple">{bestieName}</strong></span>
          <span className="ai-incoming-tag">{herName}'s AI bestie</span>
        </div>
      </div>

      <p className="ai-incoming-msg">
        <strong>{herName}</strong> asked <strong className="ai-purple">{bestieName}</strong> to get to know you first. Anything you share here, <strong>{herName}</strong> sees — directly, or summarised by <strong className="ai-purple">{bestieName}</strong>. Bring your best.
      </p>

      <div className="ai-incoming-progress">
        <div className="ai-progress-head">
          <span><strong>{herName}</strong> joins in</span>
          <span className="ai-progress-num t-mono"><strong className="ai-purple">{passed}</strong>/{total} cleared</span>
        </div>
        <div className="ai-progress-bar">
          <div className="ai-progress-fill" style={{ width: `${pct}%` }} />
          <div className="ai-progress-flag" title="She joins here">
            <span className="ai-progress-flag-ico">★</span>
          </div>
        </div>
        <div className="ai-progress-foot">
          She can also drop in herself, any time.
        </div>
      </div>

      <div className="ai-incoming-fine">
        Not a fit? <strong className="ai-purple">{bestieName}</strong> will let you know kindly. Your replies still go toward strengthening <em>your</em> profile.
      </div>
    </div>
  );
}

/* ============================================================
   Above-input control — woman's POV, AI OFF
   ============================================================ */
function AIBestieEnablePrompt({ onConfigure }) {
  return (
    <div className="ai-prompt">
      <div className="ai-prompt-head">
        <span className="sparkle">✨</span>
        <span>Try <strong className="ai-purple">AI Bestie</strong></span>
        <span className="ai-prompt-tag">new</span>
      </div>
      <div className="ai-prompt-body">
        Let her have the first 10–15 messages on your behalf. Your standards, her conversation. She brings you in when he clears your bar.
      </div>
      <button className="btn btn-primary sm ai-prompt-cta" onClick={onConfigure}>
        <span className="sparkle">✨</span>
        Set up your bestie
      </button>
    </div>
  );
}

/* ============================================================
   Above-input control — woman's POV, AI ON
   ============================================================ */
function AIBestieActiveCard({ config, onTakeOver, onTweak, onAddProbe }) {
  const checksOn = Object.values(config.checks).filter(Boolean).length;
  const passed = Math.min(config.passed, checksOn);
  const pct = Math.round((passed / checksOn) * 100);
  const [probeOpen, setProbeOpen] = bUseState(false);
  const [probe, setProbe] = bUseState("");

  const submitProbe = () => {
    if (!probe.trim()) return;
    onAddProbe?.(probe.trim());
    setProbe("");
    setProbeOpen(false);
  };

  return (
    <div className="ai-active">
      <div className="ai-active-head">
        <span className="sparkle ai-active-spark">✨</span>
        <span className="ai-active-name"><strong className="ai-purple">{config.name}</strong> is on duty</span>
        <span className="spacer" />
        <span className="ai-active-meter t-mono">{passed}/{checksOn}</span>
      </div>

      <div className="ai-active-progress">
        <div className="ai-progress-bar small">
          <div className="ai-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="ai-active-body">
        {personalityLabel(config.personality)} · {bringInLabel(config.bringMeIn).toLowerCase()}
      </div>

      <div className="ai-active-actions">
        <button className="ai-active-btn primary" onClick={onTakeOver}>
          Take over
        </button>
        <button className="ai-active-btn ghost" onClick={onTweak}>
          <Icon name="settings" size={12} /> Tweak {config.name}
        </button>
      </div>

      {probeOpen ? (
        <div className="ai-probe-row">
          <span className="ai-probe-ico">+</span>
          <input
            autoFocus
            className="ai-probe-input"
            value={probe}
            placeholder={`Tell ${config.name} to ask about\u2026`}
            onChange={e => setProbe(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitProbe(); if (e.key === "Escape") setProbeOpen(false); }}
          />
          <button className="ai-probe-send" onClick={submitProbe} disabled={!probe.trim()}>Add</button>
        </div>
      ) : (
        <button className="ai-add-probe" onClick={() => setProbeOpen(true)}>
          <span className="ai-probe-ico">+</span>
          Add a probe for {config.name}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Above-input control — man's POV, locked
   ============================================================ */
function AIBestieLocked({ unlocksIn, reason }) {
  return (
    <div className="ai-locked">
      <div className="ai-locked-head">
        <span className="ai-locked-ico"><Icon name="lock" size={11} /></span>
        <span className="ai-locked-label">Your <strong>AI Bestie</strong> is locked</span>
        <span className="spacer" />
        <span className="ai-locked-time">unlocks in <strong>{unlocksIn}</strong></span>
      </div>
      <div className="ai-locked-body">{reason}</div>
    </div>
  );
}

/* ============================================================
   Setup overlay — configure Mira / Theo
   ============================================================ */

const GENDER_OPTIONS = [
  { id: "female-cis",   label: "Female",     sub: "she/her",          icon: "♀",  span: 1 },
  { id: "male-cis",     label: "Male",       sub: "he/him",           icon: "♂",  span: 1 },
  { id: "female-trans", label: "Female",     sub: "she/her · trans",  icon: "⚧",  span: 1 },
  { id: "male-trans",   label: "Male",       sub: "he/him · trans",   icon: "⚧",  span: 1 },
  { id: "nonbinary",    label: "Non-binary", sub: "they/them",        icon: "✦",  span: 2 }
];

const PERSONALITY_OPTIONS = [
  { id: "sharp",     label: "Sharp",     blurb: "Asks the awkward stuff" },
  { id: "warm",      label: "Warm",      blurb: "Encouraging, but firm" },
  { id: "skeptical", label: "Skeptical", blurb: "Believes when proven" },
  { id: "playful",   label: "Playful",   blurb: "Disarming. Then surgical." }
];

const BRING_IN_OPTIONS = [
  { id: "4-of-5",     label: "Only after 4/5 checks pass" },
  { id: "3-of-5",     label: "When 3/5 checks pass" },
  { id: "every-5",    label: "Every 5 messages" },
  { id: "end-of-day", label: "End-of-day summary only" }
];

/* Reusable form body — no chrome, no save button. Caller renders those. */
function AIBestieConfigForm({ config, onChange, mode = "bestie", userArchetype = "spoilt_woman" }) {
  const isBestie = mode === "bestie";
  const themPronoun = isBestie ? "him" : "her";
  const sheLabel = isBestie ? "she" : "he";
  const characterLabel = isBestie ? "her" : "him";

  const update      = (k, v) => onChange({ ...config, [k]: v });
  const toggleCheck = (k)    => onChange({ ...config, checks: { ...config.checks, [k]: !config.checks[k] } });
  const addPrompt   = (p)    => onChange({ ...config, prompts: [...(config.prompts || []), p] });
  const removePrompt= (i)    => onChange({ ...config, prompts: (config.prompts || []).filter((_, j) => j !== i) });

  const [promptDraft, setPromptDraft] = bUseState("");
  const submitDraft = () => {
    if (!promptDraft.trim()) return;
    addPrompt(promptDraft.trim());
    setPromptDraft("");
  };

  const suggestions = (window.SUGGESTED_PROMPTS && window.SUGGESTED_PROMPTS[userArchetype]) || [];
  const added = new Set(config.prompts || []);
  const remaining = suggestions.filter(s => !added.has(s.p));

  const tonePct = Math.round(config.tone * 100);
  const toneLabel = config.tone < 0.33 ? "Cordial" : config.tone < 0.67 ? "Probing" : "Cutting";

  return (
    <div className="ai-form">

      {/* About her/him --------------------------- */}
      <section className="ai-form-section">
        <div className="ai-form-section-head">
          <span className="ai-form-sect-num">01</span>
          About {characterLabel}
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">{isBestie ? "Her" : "His"} name</div>
          <input
            type="text"
            className="ai-form-input"
            value={config.name}
            onChange={e => update("name", e.target.value)}
            placeholder={isBestie ? "Mira" : "Theo"}
          />
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">
            Gender
            <span className="ai-form-meta">Cis or trans</span>
          </div>
          <div className="ai-gender-grid">
            {GENDER_OPTIONS.map(g => (
              <button
                key={g.id}
                className={`ai-gender ${config.gender === g.id ? "active" : ""}`}
                style={{ gridColumn: `span ${g.span}` }}
                onClick={() => update("gender", g.id)}
              >
                <span className="ai-gender-ico">{g.icon}</span>
                <span className="ai-gender-col">
                  <span className="ai-gender-name">{g.label}</span>
                  <span className="ai-gender-sub">{g.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">
            Age
            <span className="ai-form-meta t-mono">{config.age} · 18+ only</span>
          </div>
          <div className="ai-age-card">
            <div className="ai-age-ticks">
              <span>18</span><span>30</span><span>45</span><span>60</span>
            </div>
            <input
              type="range"
              min="18" max="60" step="1"
              className="ai-age-slider"
              value={config.age || 28}
              onChange={e => update("age", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">Personality</div>
          <div className="ai-pers-grid">
            {PERSONALITY_OPTIONS.map(p => (
              <button
                key={p.id}
                className={`ai-pers-chip ${config.personality === p.id ? "active" : ""}`}
                onClick={() => update("personality", p.id)}
              >
                <span className="n">{p.label}</span>
                <span className="b">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* What she/he asks --------------------------- */}
      <section className="ai-form-section">
        <div className="ai-form-section-head">
          <span className="ai-form-sect-num">02</span>
          What {sheLabel} asks
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">
            Your prompts
            <span className="ai-form-meta">{(config.prompts || []).length} added</span>
          </div>
          <div className="ai-prompts-card">
            {(config.prompts || []).length > 0 && (
              <div className="ai-prompts-list">
                {(config.prompts || []).map((p, i) => (
                  <span key={i} className="ai-prompt-chip">
                    <span className="quote">"</span>
                    <span className="t">{p}</span>
                    <button className="x" onClick={() => removePrompt(i)} aria-label="Remove">
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="ai-prompts-input-row">
              <span className="ai-prompts-add-ico">+</span>
              <input
                type="text"
                className="ai-prompts-input"
                value={promptDraft}
                placeholder={`Tell ${config.name || (isBestie ? "Mira" : "Theo")} what to ask…`}
                onChange={e => setPromptDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitDraft(); }}
              />
              <button className="ai-prompts-submit" onClick={submitDraft} disabled={!promptDraft.trim()}>
                Add
              </button>
            </div>
          </div>
        </div>

        {remaining.length > 0 && (
          <div className="ai-form-field">
            <div className="ai-form-label">
              <span className="sparkle">✨</span>
              Suggested for you
              <span className="ai-form-meta">based on your archetype</span>
            </div>
            <div className="ai-suggested-list">
              {remaining.map((s, i) => (
                <button key={i} className="ai-suggested" onClick={() => addPrompt(s.p)}>
                  <span className="ai-suggested-plus">+</span>
                  <span className="ai-suggested-text">{s.p}</span>
                  <span className="ai-suggested-why">{s.why}</span>
                </button>
              ))}
            </div>
            <div className="ai-suggested-foot">
              These are tuned to <strong>{userArchetypeName(userArchetype)}</strong>. Tap to add.
            </div>
          </div>
        )}
      </section>

      {/* Boundaries --------------------------- */}
      <section className="ai-form-section">
        <div className="ai-form-section-head">
          <span className="ai-form-sect-num">03</span>
          Boundaries
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">
            What {sheLabel} screens for
            <span className="ai-form-meta">{Object.values(config.checks).filter(Boolean).length} on</span>
          </div>
          <div className="ai-checks-list">
            {Object.keys(config.checks).map(k => (
              <button
                key={k}
                className={`ai-check ${config.checks[k] ? "on" : ""}`}
                onClick={() => toggleCheck(k)}
              >
                <span className="ai-check-box">
                  {config.checks[k] && <Icon name="check" size={11} />}
                </span>
                <span>{k}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">
            Tone with {themPronoun}
            <span className="ai-form-meta">{toneLabel} · {tonePct}%</span>
          </div>
          <div className="ai-tone-card">
            <div className="ai-tone-labels">
              <span>Cordial</span>
              <span>Probing</span>
              <span>Cutting</span>
            </div>
            <input
              type="range" min="0" max="100" step="1"
              className="ai-tone-slider"
              value={tonePct}
              onChange={e => update("tone", Number(e.target.value) / 100)}
            />
          </div>
        </div>

        <div className="ai-form-field">
          <div className="ai-form-label">When to bring you in</div>
          <div className="ai-setup-radios">
            {BRING_IN_OPTIONS.map(o => (
              <button
                key={o.id}
                className={`ai-radio-row ${config.bringMeIn === o.id ? "on" : ""}`}
                onClick={() => update("bringMeIn", o.id)}
              >
                <span className="ai-radio">{config.bringMeIn === o.id && <span className="ai-radio-dot" />}</span>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function userArchetypeName(id) {
  return ({
    spoilt_woman: "Spoilt Woman",
    safety_first_woman: "Safety-First Woman",
    casual_man: "Casual Man",
    marriage_minded_man: "Marriage-Minded Man"
  })[id] || "your archetype";
}

/* Overlay wrapper — full-screen sheet with save CTA */
function AIBestieSetup({ initial, onSave, onClose, mode = "bestie", userArchetype = "spoilt_woman" }) {
  const [cfg, setCfg] = bUseState(initial || (mode === "bestie" ? window.AI_BESTIE_DEFAULT : window.AI_WINGMAN_DEFAULT));
  const isBestie = mode === "bestie";
  const titleNoun = isBestie ? "bestie" : "wingman";

  return (
    <div className="ai-setup-overlay">
      <button className="ai-setup-close" onClick={onClose}><Icon name="x" size={16}/></button>

      <div className="ai-setup-content">
        <div className="ai-setup-hero">
          <div className="ai-setup-eyebrow">
            <span className="ai-purple">✨ Your AI {isBestie ? "bestie" : "wingman"}</span>
          </div>
          <h1 className="ai-setup-title">
            Tune the way<br/><em>{cfg.name || (isBestie ? "Mira" : "Theo")}</em> shows up.
          </h1>
          <p className="ai-setup-sub">
            Your standards, {isBestie ? "her" : "his"} conversation. {isBestie ? "She" : "He"} learns from your edits, skips, and the matches you keep.
          </p>
        </div>

        <AIBestieConfigForm
          config={cfg}
          onChange={setCfg}
          mode={mode}
          userArchetype={userArchetype}
        />

        <div className="ai-setup-foot-cta">
          <button className="btn btn-primary full ai-save-btn" onClick={() => onSave(cfg)}>
            <span className="sparkle">✨</span>
            Save and turn {cfg.name || (isBestie ? "Mira" : "Theo")} on
          </button>
          <div className="ai-setup-foot">
            Change anytime. Your {titleNoun} learns from your replies, edits, and skips too.
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AIBestieBubbleBadge,
  AIBestieIncomingBanner,
  AIBestieEnablePrompt,
  AIBestieActiveCard,
  AIBestieLocked,
  AIBestieSetup,
  AIBestieConfigForm
});
