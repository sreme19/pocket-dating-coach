/* Verified Vibe — Messages inbox
   List of conversations + "New matches" carousel.
   Tapping a row opens the chat for that profile. */

const { useState: mUseState, useMemo: mUseMemo } = React;

function MessagesListScreen({ onOpen }) {
  const [filter, setFilter] = mUseState("all");
  const conversations = window.CONVERSATIONS || [];
  const newMatches = window.NEW_MATCHES || [];

  const rows = mUseMemo(() => conversations.map(c => ({
    ...c,
    profile: window.getProfileById(c.profileId)
  })).filter(c => c.profile), [conversations]);

  const filtered = mUseMemo(() => {
    if (filter === "unread") return rows.filter(r => r.unread > 0);
    if (filter === "dates")  return rows.filter(r => r.dateProposed || r.dateConfirmed);
    return rows;
  }, [rows, filter]);

  const unreadCount = rows.reduce((n, r) => n + (r.unread > 0 ? 1 : 0), 0);

  return (
    <div className="screen enter messages" data-screen-label="06 Messages list">
      <div className="msg-header">
        <div className="msg-header-row">
          <div>
            <div className="msg-title t-display">Messages.</div>
            <div className="msg-sub">
              <span className="msg-pulse" />
              {rows.length} verified · <span className="t-em">{unreadCount} unread</span>
            </div>
          </div>
          <button className="icon-btn msg-search" title="Search">
            <Icon name="settings" size={18} />
          </button>
        </div>
      </div>

      {newMatches.length > 0 && (
        <div className="new-matches">
          <div className="new-matches-head">
            <span className="dot" />
            <span className="label">New matches</span>
            <span className="count">{newMatches.length} waiting · message first</span>
          </div>
          <div className="new-matches-row">
            {newMatches.map(m => {
              const p = window.getProfileById(m.profileId);
              if (!p) return null;
              return (
                <button key={m.profileId} className="new-match-card" onClick={() => onOpen(p, { fresh: true })}>
                  <span className="nm-avatar" style={{ backgroundImage: `url(${p.photo})` }}>
                    <span className="nm-verified"><Icon name="check" size={9} /></span>
                    <span className="nm-spark">✨</span>
                  </span>
                  <span className="nm-name">{p.name}, {p.age}</span>
                  <span className="nm-meta">{m.matchedAgo}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="msg-filters">
        {[
          { id: "all",    label: "All",          count: rows.length },
          { id: "unread", label: "Unread",       count: rows.filter(r => r.unread > 0).length },
          { id: "dates",  label: "Date set",     count: rows.filter(r => r.dateProposed || r.dateConfirmed).length }
        ].map(f => (
          <button
            key={f.id}
            className={`msg-filter ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="n">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="msg-list">
        {filtered.length === 0 && (
          <div className="msg-empty">
            <div className="t-display" style={{ fontSize: 26 }}>Nothing here.</div>
            <div className="t-small t-muted" style={{ marginTop: 6 }}>
              {filter === "unread" ? "You're caught up. Reply rate matters — keep it that way." : "Set a date and it shows up here."}
            </div>
          </div>
        )}

        {filtered.map(c => {
          const p = c.profile;
          const archLabel = p.archetype === "spoilt_woman"
            ? "Spoilt Woman" : p.archetype === "safety_first_woman" ? "Safety-First" : "Marriage-Minded";
          return (
            <button
              key={c.profileId}
              className={`msg-row ${c.unread > 0 ? "unread" : ""} ${c.pinned ? "pinned" : ""}`}
              onClick={() => onOpen(p)}
            >
              <span className="msg-avatar" style={{ backgroundImage: `url(${p.photo})` }}>
                <span className="msg-avatar-verified"><Icon name="check" size={9} /></span>
              </span>

              <span className="msg-body">
                <span className="msg-row-top">
                  <span className="msg-name">
                    {p.name}<span className="age">, {p.age}</span>
                  </span>
                  <span className="msg-arch">{p.archEmoji} {archLabel}</span>
                  <span className="msg-trust" title="Trust score">
                    <Icon name="shield-fill" size={9} />
                    {p.trustScore}
                  </span>
                  <span className="spacer" />
                  <span className={`msg-time ${c.unread > 0 ? "em" : ""}`}>{c.time}</span>
                </span>

                <span className="msg-row-bottom">
                  {c.typing ? (
                    <span className="msg-typing">
                      <span className="dots"><span /><span /><span /></span>
                      typing…
                    </span>
                  ) : (
                    <span className={`msg-preview ${c.lastFrom === "me" ? "mine" : ""}`}>
                      {c.preview}
                    </span>
                  )}
                  <span className="spacer" />
                  {c.unread > 0 && <span className="msg-unread">{c.unread}</span>}
                </span>

                {(c.dateProposed || c.dateConfirmed) && (
                  <span className={`msg-date-tag ${c.dateConfirmed ? "confirmed" : ""}`}>
                    <Icon name="calendar" size={10} />
                    {c.dateConfirmed ? <><strong>Date set</strong> · {c.dateConfirmed}</> : <><strong>Pending</strong> · {c.dateProposed}</>}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        <div className="msg-foot">
          <Icon name="lock" size={11} />
          Conversations stay in-app. We watch for red flags so you don't have to.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MessagesListScreen });
