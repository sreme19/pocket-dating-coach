/* Verified Vibe — multi-step verification flow
   Steps: ID + liveness → Photos → Bank → Q&A → done
*/

const { useState: vUseState, useEffect: vUseEffect, useRef: vUseRef } = React;

const VERIFY_STEPS = [
  { id: "id",     name: "Government ID",     pts: 35 },
  { id: "photos", name: "Photo verification", pts: 20 },
  { id: "bank",   name: "Spending pattern",   pts: 25 },
  { id: "qa",     name: "Q&A intent check",   pts: 10 }
];

const PHOTO_SLOTS = [
  { kind: "Casual",   img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80&auto=format&fit=crop" },
  { kind: "Dressed",  img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80&auto=format&fit=crop" },
  { kind: "Activity", img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&q=80&auto=format&fit=crop" },
  { kind: "Social",   img: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&q=80&auto=format&fit=crop" },
  { kind: "Smile",    img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80&auto=format&fit=crop" }
];

const QA_QUESTIONS = {
  casual_man: [
    { q: "What does 'casual' actually mean to you?",   ph: "Casual dating where we both know what we want, treat each other well..." },
    { q: "What are you here for, right now?",           ph: "Real connection, chemistry, low-pressure energy. Not games." },
    { q: "How do you treat the people you date?",       ph: "With respect, honesty, generosity..." },
    { q: "What would be an instant dealbreaker?",       ph: "Dishonesty about what someone wants." }
  ],
  spoilt_woman: [
    { q: "What does being 'spoilt' mean to you?",       ph: "Being cherished — effort, taste, attention to detail..." },
    { q: "What are you looking for in a date?",         ph: "Confidence, conversation, a man with a calendar that respects mine." },
    { q: "What should a guy know about your values?",   ph: "I'm soft because I'm safe. Pay attention." },
    { q: "What's your ideal first date?",                ph: "Wine, dim light, a place I haven't been yet." }
  ],
  marriage_minded_man: [
    { q: "What does 'marriage-minded' mean to you?",    ph: "Building a partnership. Open about timeline, ready for the work." },
    { q: "What are your values in a partner?",          ph: "Kindness, ambition, emotional honesty..." },
    { q: "Where do you see yourself in 5 years?",       ph: "Married, settled, possibly kids, still curious." },
    { q: "How important is building a family?",         ph: "Very. I want this, not a maybe-someday." }
  ],
  safety_first_woman: [
    { q: "What does 'safety-first' mean for you?",       ph: "I date men who've done the work. Verified, boundaried, slow." },
    { q: "What are the biggest red flags you watch for?", ph: "Love-bombing, anonymous profiles, fast-movers..." },
    { q: "How do you decide if someone is trustworthy?", ph: "Consistency over weeks. Their friends, their words, their pace." },
    { q: "What reassurance do you need early on?",       ph: "Their full name, social, a video call before we meet." }
  ]
};

/* ============================================================
   VerificationFlow — root
   ============================================================ */
function VerificationFlow({ archetypeId, onComplete, onBack }) {
  const [step, setStep] = vUseState(0); // 0..3
  const [earned, setEarned] = vUseState(0);

  const advance = (pts) => {
    setEarned(e => e + pts);
    if (step < VERIFY_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // brief celebration then leave
      setTimeout(() => onComplete(), 600);
    }
  };

  const meta = VERIFY_STEPS[step];

  return (
    <div className="screen enter vflow" data-screen-label={`04 Verification — ${meta.name}`}>
      <div className="vflow-top">
        <div className="vflow-top-row">
          <button className="vflow-back" onClick={onBack} title="Exit"><Icon name="x" size={16} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="vflow-step-label">Step {step + 1} of {VERIFY_STEPS.length} · earning trust</div>
            <div className="vflow-step-title">{meta.name}</div>
          </div>
          <div className="t-mono" style={{ fontSize: 12, color: "var(--accent-bright)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            +{earned} pts
          </div>
        </div>
        <div className="vflow-stepper">
          {VERIFY_STEPS.map((_, i) => (
            <span key={i} className={i < step ? "done" : i === step ? "active" : ""} />
          ))}
        </div>
      </div>

      {step === 0 && <IDStep key="id" onDone={() => advance(35)} onSkip={() => advance(35)} />}
      {step === 1 && <PhotosStep key="photos" onDone={() => advance(20)} onSkip={() => advance(20)} />}
      {step === 2 && <BankStep key="bank" onDone={() => advance(25)} onSkip={() => advance(25)} />}
      {step === 3 && <QAStep key="qa" archetypeId={archetypeId} onDone={() => advance(10)} onSkip={() => advance(10)} />}
    </div>
  );
}

/* ============================================================
   ID + Liveness step
   ============================================================ */
function IDStep({ onDone, onSkip }) {
  const [phase, setPhase] = vUseState("idle"); // idle → liveness → verifying → success
  const [livenessIdx, setLivenessIdx] = vUseState(0);

  const challenges = ["Look straight ahead", "Tilt your head left", "Smile"];

  const startLiveness = () => {
    setPhase("liveness");
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i >= challenges.length) {
        clearInterval(id);
        setPhase("verifying");
        setTimeout(() => setPhase("success"), 2200);
      } else {
        setLivenessIdx(i);
      }
    }, 1200);
  };

  return (
    <>
      <div className="vflow-body">
        {phase === "idle" && (
          <>
            <h2 className="vflow-title">Prove you're<br/><em>actually you.</em></h2>
            <p className="vflow-blurb">Snap your government ID. Then a quick liveness check — three head movements, takes 30 seconds.</p>

            <button className="upload-zone" onClick={startLiveness}>
              <span className="ico"><Icon name="camera" size={26} /></span>
              <span className="h">Take a photo of your ID</span>
              <span className="s">Passport, driver's license, or national ID — front side</span>
            </button>

            <div className="t-tiny" style={{ marginTop: 4 }}>What we check</div>
            <div className="check-list">
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Your face is clear and centered</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>ID number visible, not blurred</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Not expired, security features visible</div>
              <div className="check-item muted"><span className="ico"><Icon name="x" size={12} /></span>We don't store your ID number</div>
            </div>
          </>
        )}

        {phase === "liveness" && (
          <>
            <h2 className="vflow-title">Liveness<br/><em>check.</em></h2>
            <p className="vflow-blurb">Follow the prompt. Three quick movements — proves you're not a photo or a bot.</p>

            <div className="liveness">
              <div className="camera"><div className="camera-face" /></div>
              <div className="instr"><em>{challenges[livenessIdx]}</em></div>
              <div className="sub">Challenge {livenessIdx + 1} of {challenges.length}</div>
              <ProgressBar pct={((livenessIdx + 1) / challenges.length) * 100} />
            </div>
          </>
        )}

        {phase === "verifying" && (
          <>
            <h2 className="vflow-title">Verifying<br/><em>your ID.</em></h2>
            <div className="vflow-progress">
              <div className="vflow-spinner" />
              <div className="title">Under 60 seconds</div>
              <div className="checklist">
                <div className="row done"><span className="ico"><Icon name="check" size={14} /></span>ID format & authenticity</div>
                <div className="row pending"><span className="ico" /><span>Face match (ID ↔ liveness)</span></div>
                <div className="row queued"><span className="ico" /><span>Hologram & security check</span></div>
              </div>
            </div>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="vflow-success">
              <div className="check-circle"><Icon name="check" size={32} /></div>
              <div className="title">ID verified.</div>
              <div className="pts">+35 trust points</div>
              <div className="t-small t-muted" style={{ marginTop: 4 }}>You're real, you're you, and your ID checks out.</div>
            </div>

            <div className="check-list">
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Real government ID — not fake</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>You're a real person (liveness passed)</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Face matches the ID photo</div>
            </div>
          </>
        )}
      </div>

      <div className="vflow-cta">
        {phase === "success" && <Btn full onClick={onDone}>Next · Photos →</Btn>}
        {phase === "idle" && (
          <div className="row">
            <Btn variant="secondary" onClick={onSkip} style={{ flex: 1 }}>Skip in demo</Btn>
            <Btn onClick={startLiveness} style={{ flex: 2 }}>Take photo · liveness</Btn>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   Photos step
   ============================================================ */
function PhotosStep({ onDone, onSkip }) {
  const [phase, setPhase] = vUseState("idle"); // idle → uploading → success
  const [slots, setSlots] = vUseState(() => PHOTO_SLOTS.map(s => ({ ...s, status: "empty" })));

  const startUpload = () => {
    setPhase("uploading");
    // fill each slot in sequence
    PHOTO_SLOTS.forEach((_, i) => {
      setTimeout(() => {
        setSlots(prev => prev.map((s, j) => j === i ? { ...s, status: "pending" } : s));
      }, 280 * i);
      setTimeout(() => {
        setSlots(prev => prev.map((s, j) => j === i ? { ...s, status: "ok" } : s));
      }, 280 * i + 900);
    });
    setTimeout(() => setPhase("success"), 280 * PHOTO_SLOTS.length + 1200);
  };

  return (
    <>
      <div className="vflow-body">
        {phase !== "success" && (
          <>
            <h2 className="vflow-title">Five photos.<br/><em>One face.</em></h2>
            <p className="vflow-blurb">Different settings, same you. We run face-matching across the set — and flag any AI-generated photos.</p>

            <div className="photo-grid">
              {slots.map((s, i) => (
                <div
                  key={i}
                  className={`photo-cell ${s.status !== "empty" ? "filled" : ""}`}
                  style={s.status !== "empty" ? { backgroundImage: `url(${s.img})` } : null}
                >
                  {s.status === "pending" && <span className="photo-status pending" />}
                  {s.status === "ok" && <span className="photo-status ok"><Icon name="check" size={12} /></span>}
                  {s.status === "empty" && <span>{s.kind}</span>}
                  {s.status !== "empty" && <span className="photo-label">{s.kind}</span>}
                </div>
              ))}
              <div className="photo-cell" style={{ borderStyle: "solid", background: "var(--bg-3)", color: "var(--text-3)" }}>
                + Add
              </div>
            </div>

            {phase === "uploading" && (
              <div className="vflow-progress">
                <div className="vflow-spinner" />
                <div className="title">Running face-match across photos</div>
                <div className="sub">{slots.filter(s => s.status === "ok").length}/{slots.length} verified</div>
              </div>
            )}
          </>
        )}

        {phase === "success" && (
          <>
            <div className="vflow-success">
              <div className="check-circle"><Icon name="check" size={32} /></div>
              <div className="title">Same person in all 5.</div>
              <div className="pts">+20 trust points</div>
            </div>

            <div className="photo-grid">
              {slots.map((s, i) => (
                <div key={i} className="photo-cell filled" style={{ backgroundImage: `url(${s.img})` }}>
                  <span className="photo-status ok"><Icon name="check" size={12} /></span>
                  <span className="photo-label">{s.kind}</span>
                </div>
              ))}
            </div>

            <div className="check-list">
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Same person, 5 photos</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>No AI-generated photos detected</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Grooming signal: strong</div>
            </div>
          </>
        )}
      </div>

      <div className="vflow-cta">
        {phase === "success" && <Btn full onClick={onDone}>Next · Bank statement →</Btn>}
        {phase === "idle" && (
          <div className="row">
            <Btn variant="secondary" onClick={onSkip} style={{ flex: 1 }}>Skip in demo</Btn>
            <Btn onClick={startUpload} style={{ flex: 2 }}>Upload 5 photos</Btn>
          </div>
        )}
        {phase === "uploading" && <Btn full disabled>Verifying…</Btn>}
      </div>
    </>
  );
}

/* ============================================================
   Bank statement step
   ============================================================ */
function BankStep({ onDone, onSkip }) {
  const [phase, setPhase] = vUseState("idle"); // idle → extracting → success
  const [extractIdx, setExtractIdx] = vUseState(0);

  const items = [
    "Removing account numbers",
    "Categorizing transactions",
    "Detecting dining patterns",
    "Detecting travel & experiences"
  ];

  const start = () => {
    setPhase("extracting");
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i >= items.length) {
        clearInterval(id);
        setTimeout(() => setPhase("success"), 600);
      } else {
        setExtractIdx(i);
      }
    }, 700);
  };

  return (
    <>
      <div className="vflow-body">
        {phase === "idle" && (
          <>
            <h2 className="vflow-title">Where the<br/><em>money lands.</em></h2>
            <p className="vflow-blurb">3 months. We extract spending categories — dining, entertainment, travel — and redact everything else.</p>

            <button className="upload-zone" onClick={start}>
              <span className="ico"><Icon name="wallet" size={26} /></span>
              <span className="h">Upload bank statement</span>
              <span className="s">PDF or screenshot · last 3 months</span>
            </button>

            <div className="t-tiny" style={{ marginTop: 4 }}>What we extract</div>
            <div className="check-list">
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Dining & restaurants</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Entertainment & activities</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Travel & experiences</div>
              <div className="check-item muted"><span className="ico"><Icon name="x" size={12} /></span>Account #, balance, salary — never seen</div>
            </div>
          </>
        )}

        {phase === "extracting" && (
          <>
            <h2 className="vflow-title">Reading your<br/><em>last 90 days.</em></h2>
            <div className="vflow-progress">
              <div className="vflow-spinner" />
              <div className="title">Extracting spending pattern</div>
              <div className="checklist">
                {items.map((label, i) => (
                  <div key={i} className={`row ${i < extractIdx ? "done" : i === extractIdx ? "pending" : "queued"}`}>
                    <span className="ico">{i < extractIdx && <Icon name="check" size={14} />}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="vflow-success">
              <div className="check-circle"><Icon name="check" size={32} /></div>
              <div className="title">Spending verified.</div>
              <div className="pts">+25 trust points</div>
              <div className="t-small t-muted">You invest in dates and experiences. That reads.</div>
            </div>

            <div className="t-tiny">Your 90-day spend</div>
            <div className="spend-summary">
              <div className="spend-row">
                <span className="em-ico">🍽️</span>
                <span className="l"><span className="n">Dining & restaurants</span><span className="d">Casual to upscale · 2–3×/wk</span></span>
                <span className="v">$850/mo</span>
              </div>
              <div className="spend-row">
                <span className="em-ico">🎭</span>
                <span className="l"><span className="n">Entertainment</span><span className="d">Live events, bars, shows</span></span>
                <span className="v">$320/mo</span>
              </div>
              <div className="spend-row">
                <span className="em-ico">✈️</span>
                <span className="l"><span className="n">Travel</span><span className="d">Weekend trips & flights</span></span>
                <span className="v">$1,200/mo</span>
              </div>
            </div>

            <div className="t-small t-muted" style={{ marginTop: 4 }}>
              <Icon name="lock" size={11} /> You choose which of these show on your profile.
            </div>
          </>
        )}
      </div>

      <div className="vflow-cta">
        {phase === "success" && <Btn full onClick={onDone}>Next · Q&A →</Btn>}
        {phase === "idle" && (
          <div className="row">
            <Btn variant="secondary" onClick={onSkip} style={{ flex: 1 }}>Skip in demo</Btn>
            <Btn onClick={start} style={{ flex: 2 }}>Upload statement</Btn>
          </div>
        )}
        {phase === "extracting" && <Btn full disabled>Reading…</Btn>}
      </div>
    </>
  );
}

/* ============================================================
   Q&A step
   ============================================================ */
function QAStep({ archetypeId, onDone, onSkip }) {
  const questions = QA_QUESTIONS[archetypeId] || QA_QUESTIONS.casual_man;
  const [answers, setAnswers] = vUseState(() => questions.map(() => ""));
  const [phase, setPhase] = vUseState("idle"); // idle → checking → success

  const filledCount = answers.filter(a => a.trim().length > 0).length;

  const submit = () => {
    setPhase("checking");
    setTimeout(() => setPhase("success"), 2400);
  };

  const fillExamples = () => {
    setAnswers(questions.map(q => q.ph));
  };

  return (
    <>
      <div className="vflow-body">
        {phase === "idle" && (
          <>
            <h2 className="vflow-title">Tell us<br/><em>the truth.</em></h2>
            <p className="vflow-blurb">Four quick answers. We check them against each other — and against your archetype — for honesty.</p>

            <div className="qa-q" style={{ background: "transparent", border: 0, padding: 0, gap: 6 }}>
              <ProgressBar pct={(filledCount / questions.length) * 100} />
              <div className="t-small t-muted">{filledCount} of {questions.length} answered</div>
            </div>

            {questions.map((q, i) => (
              <div key={i} className="qa-q">
                <div className="num">Q{i + 1}</div>
                <div className="text">{q.q}</div>
                <textarea
                  maxLength={300}
                  placeholder={q.ph}
                  value={answers[i]}
                  onChange={e => {
                    const v = e.target.value;
                    setAnswers(a => a.map((x, j) => j === i ? v : x));
                  }}
                />
                <div className="count">{answers[i].length} / 300</div>
              </div>
            ))}

            <button
              type="button"
              onClick={fillExamples}
              style={{
                alignSelf: "flex-start", fontSize: 11, fontWeight: 600,
                color: "var(--text-3)", textDecoration: "underline",
                textUnderlineOffset: 3, marginTop: -4
              }}
            >
              Use example answers (demo)
            </button>
          </>
        )}

        {phase === "checking" && (
          <>
            <h2 className="vflow-title">Reading between<br/><em>the lines.</em></h2>
            <div className="vflow-progress">
              <div className="vflow-spinner" />
              <div className="title">Checking consistency</div>
              <div className="checklist">
                <div className="row done"><span className="ico"><Icon name="check" size={14} /></span>Answers parsed</div>
                <div className="row done"><span className="ico"><Icon name="check" size={14} /></span>Tone & intent · honest</div>
                <div className="row pending"><span className="ico" /><span>Cross-referencing with archetype</span></div>
              </div>
            </div>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="vflow-success">
              <div className="check-circle"><Icon name="check" size={32} /></div>
              <div className="title">Intent is clear.</div>
              <div className="pts">+10 trust points</div>
              <div className="t-small t-muted">You said what you mean. Matches will trust you from day one.</div>
            </div>

            <div className="check-list">
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Honest about what you want</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Not contradicting yourself</div>
              <div className="check-item"><span className="ico"><Icon name="check" size={12} /></span>Clear on boundaries</div>
            </div>
          </>
        )}
      </div>

      <div className="vflow-cta">
        {phase === "success" && <Btn full onClick={onDone}>See your trust score →</Btn>}
        {phase === "idle" && (
          <div className="row">
            <Btn variant="secondary" onClick={onSkip} style={{ flex: 1 }}>Skip in demo</Btn>
            <Btn onClick={submit} disabled={filledCount < questions.length} style={{ flex: 2 }}>
              {filledCount < questions.length ? `Fill all ${questions.length} to submit` : "Submit answers"}
            </Btn>
          </div>
        )}
        {phase === "checking" && <Btn full disabled>Checking…</Btn>}
      </div>
    </>
  );
}

Object.assign(window, { VerificationFlow });
