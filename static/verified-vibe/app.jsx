/* Verified Vibe — root app, navigation, tweaks */

const { useState: useS, useEffect: useE, useMemo: useM, useRef: useR } = React;

function App() {
  const [t, setTweak] = useTweaks(window.__TWEAK_DEFAULTS);
  const [phase, setPhase] = useS("gate");      // gate → home → verify → verification → app
  const [tab, setTab] = useS("discover");      // discover | trust | chat
  const [matched, setMatched] = useS(null);    // profile object
  const [hasChat, setHasChat] = useS(false);   // unlocks the messages tab badge
  const [gender, setGender] = useS(null);      // 'man' | 'woman'
  const [pickedArchetype, setPickedArchetype] = useS(null);

  // apply accent at root
  useE(() => {
    document.documentElement.setAttribute("data-accent", t.accent || "emerald");
  }, [t.accent]);

  const onMatch = (profile) => { setMatched(profile); setHasChat(true); };
  const closeMatch = () => setMatched(null);
  const goToChat = () => { setMatched(null); setTab("chat"); };

  const onPassGate = ({ gender: g }) => { setGender(g); setPhase("home"); };
  const onContinueFromHome = (archetypeId) => {
    setPickedArchetype(archetypeId);
    setPhase("verify");
  };
  const onStartVerification = () => {
    setPhase("verification");
  };
  const onVerificationDone = () => {
    setPhase("app");
    setTab("trust");
  };

  // contents for current tab
  let body = null;
  if (phase === "gate") {
    body = <GateScreen onPass={onPassGate} />;
  } else if (phase === "home") {
    body = <HomeScreen gender={gender} onContinue={onContinueFromHome} />;
  } else if (phase === "verify") {
    body = <VerifyScreen archetypeId={pickedArchetype} onBack={() => setPhase("home")} onStart={onStartVerification} />;
  } else if (phase === "verification") {
    body = <VerificationFlow
      archetypeId={pickedArchetype}
      onComplete={onVerificationDone}
      onBack={() => setPhase("verify")}
    />;
  } else {
    if (tab === "discover") body = <DiscoveryScreen onMatch={onMatch} interaction={t.discoveryInteraction} showBackdrop={t.showVerifiedBackdrop} />;
    if (tab === "trust") body = <TrustScreen gaugeStyle={t.gaugeStyle} onEditQA={() => alert("Q&A editor — out of scope for hero screens demo")} />;
    if (tab === "chat") body = <ChatScreen profile={window.MATCH_PROFILE} onBack={() => setTab("discover")} />;
  }

  return (
    <div className="stage">
      <div className="stage-meta">
        <div className="brand">Verified <em>Vibe</em></div>
        <div><b>Hero screens prototype</b> · v1</div>
        <div>{phase === "gate" ? "00 · Quick check" : phase === "home" ? "01 · Archetype select" : phase === "verify" ? "01b · Verify requirements" : phase === "verification" ? "04 · Verification flow" : tab === "discover" ? "03 · Discovery" : tab === "trust" ? "02 · Trust dashboard" : "05 · Chat"}</div>
        <div style={{ marginTop: 14, maxWidth: 220 }}>
          {phase === "gate"
            ? "Pick a gender + confirm 18+. We filter archetypes from here."
            : phase === "home"
            ? "Tap any archetype card → review traits + what you bring → Lock it in."
            : phase === "verify"
            ? "Verification requirements page — tap Start to begin the 4-step flow."
            : phase === "verification"
            ? "Multi-step verification: ID + liveness → photos → bank → Q&A. Each step earns trust points. Use 'Skip in demo' to fast-forward."
            : tab === "discover"
            ? "Drag a card or use the buttons. Right-swipe Sarah to trigger the match."
            : tab === "trust"
            ? "Live trust gauge. Try changing the style in Tweaks."
            : "Send a message — she'll reply. Date proposal card is interactive."}
        </div>
        {phase !== "gate" && (
          <button
            onClick={() => { setPhase("gate"); setTab("discover"); setMatched(null); setGender(null); }}
            style={{
              marginTop: 16, alignSelf: "flex-start", pointerEvents: "auto",
              padding: "6px 10px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-sans)"
            }}
          >
            ← Restart flow
          </button>
        )}
      </div>

      <div className="phone">
        <StatusBar />
        <div className="viewport">
          {body}
          {matched && (
            <MatchOverlay
              profile={matched}
              onSendMessage={goToChat}
              onClose={closeMatch}
            />
          )}
        </div>
        {phase === "app" && (
          <BottomNav tab={tab} onTab={setTab} unread={hasChat ? 1 : 0} />
        )}
      </div>

      <TweaksPanel>
        <TweakSection label="Visual" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={[
            { value: "emerald", color: "#10b981" },
            { value: "mint",    color: "#5eead4" },
            { value: "lime",    color: "#a3e635" },
            { value: "amber",   color: "#fbbf24" }
          ].map(o => o.color)}
          onChange={(hex) => {
            const map = { "#10b981": "emerald", "#5eead4": "mint", "#a3e635": "lime", "#fbbf24": "amber" };
            setTweak("accent", map[hex] || "emerald");
          }}
        />

        <TweakSection label="Trust gauge" />
        <TweakRadio
          label="Style"
          value={t.gaugeStyle}
          options={["radial", "linear", "arc"]}
          onChange={(v) => setTweak("gaugeStyle", v)}
        />

        <TweakSection label="Discovery" />
        <TweakRadio
          label="Interaction"
          value={t.discoveryInteraction}
          options={["swipe", "tap", "both"]}
          onChange={(v) => setTweak("discoveryInteraction", v)}
        />
        <TweakToggle
          label="Show swipe labels"
          value={t.showVerifiedBackdrop}
          onChange={(v) => setTweak("showVerifiedBackdrop", v)}
        />

        <TweakSection label="Demo" />
        <TweakButton
          label="Jump to verification"
          onClick={() => { setPickedArchetype("casual_man"); setGender("man"); setPhase("verification"); }}
        />
        <TweakButton
          label="Trigger match"
          onClick={() => { setPhase("app"); setTab("discover"); setTimeout(() => onMatch(window.MATCH_PROFILE), 100); }}
        />
        <TweakButton
          label="Skip to chat"
          onClick={() => { setPhase("app"); setHasChat(true); setTab("chat"); }}
        />
        <TweakButton
          label="Restart flow"
          onClick={() => { setPhase("gate"); setTab("discover"); setMatched(null); setHasChat(false); setGender(null); }}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
