<script lang="ts">
  import { goto } from '$app/navigation';
  import { fade, slide } from 'svelte/transition';

  let messageInput = $state('');
  let messages = $state([
    {
      id: '1',
      sender: 'other',
      content: 'Hey! How are you doing?',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: '2',
      sender: 'user',
      content: 'Hey! Doing great, thanks for asking. How about you?',
      timestamp: new Date(Date.now() - 3300000)
    },
    {
      id: '3',
      sender: 'other',
      content: 'Pretty good! I saw you like travel. Any favorite destinations?',
      timestamp: new Date(Date.now() - 3000000)
    },
    {
      id: '4',
      sender: 'user',
      content: 'Absolutely! I love Southeast Asia. Been to Thailand, Vietnam, and Cambodia. You?',
      timestamp: new Date(Date.now() - 2700000)
    }
  ]);

  const currentMatch = {
    name: 'Sarah',
    age: 26,
    city: 'Brooklyn, NY',
    photo: '👩',
    online: true
  };

  function handleSendMessage() {
    if (!messageInput.trim()) return;

    messages = [
      ...messages,
      {
        id: String(messages.length + 1),
        sender: 'user',
        content: messageInput,
        timestamp: new Date()
      }
    ];

    messageInput = '';

    // Auto-scroll to bottom
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function formatTime(date: Date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }
</script>

<div class="chat-screen">
  <!-- Header -->
  <div class="chat-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="back-btn" onclick={() => goto('/verified-vibe/discover')}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>

    <div class="match-header">
      <div class="match-avatar">{currentMatch.photo}</div>
      <div class="match-info">
        <h2>{currentMatch.name}, {currentMatch.age}</h2>
        <p class="match-status {currentMatch.online ? 'online' : 'offline'}">
          {currentMatch.online ? '🟢 Online' : 'Offline'}
        </p>
      </div>
    </div>

    <button class="menu-btn">⋮</button>
  </div>

  <!-- Messages -->
  <div class="messages-container">
    <div class="messages">
      {#each messages as message}
        <div class="message {message.sender}" transition:fade={{ duration: 300 }}>
          <div class="message-bubble">
            {message.content}
          </div>
          <span class="message-time">{formatTime(message.timestamp)}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Input -->
  <div class="chat-input-container" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <div class="chat-input-wrapper">
      <textarea
        bind:value={messageInput}
        onkeydown={handleKeyDown}
        placeholder="Type a message..."
        rows="1"
      ></textarea>
      <button
        class="send-btn"
        onclick={handleSendMessage}
        disabled={!messageInput.trim()}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99701575 L3.03521743,10.4380088 C3.03521743,10.5951061 3.19218622,10.7522035 3.50612381,10.7522035 L16.6915026,11.5376905 C16.6915026,11.5376905 17.1624089,11.5376905 17.1624089,12.0089827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .chat-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    gap: 12px;
  }

  .back-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .match-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .match-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--accent-tint);
    display: grid;
    place-items: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  .match-info {
    min-width: 0;
  }

  .match-info h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .match-status {
    font-size: 12px;
    color: var(--text-3);
    margin: 2px 0 0;
  }

  .match-status.online {
    color: var(--accent-bright);
  }

  .menu-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    font-size: 18px;
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .menu-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 80%;
  }

  .message.user {
    align-self: flex-end;
    align-items: flex-end;
  }

  .message.other {
    align-self: flex-start;
    align-items: flex-start;
  }

  .message-bubble {
    padding: 12px 16px;
    border-radius: 18px;
    word-wrap: break-word;
    line-height: 1.4;
    font-size: 14px;
  }

  .message.user .message-bubble {
    background: var(--accent);
    color: #06281e;
    border-bottom-right-radius: 4px;
  }

  .message.other .message-bubble {
    background: var(--bg-2);
    color: var(--text-1);
    border-bottom-left-radius: 4px;
  }

  .message-time {
    font-size: 11px;
    color: var(--text-4);
    padding: 0 4px;
  }

  .chat-input-container {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .chat-input-wrapper {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .chat-input-wrapper textarea {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--border-1);
    border-radius: 24px;
    background: var(--bg-2);
    color: var(--text-1);
    font-family: inherit;
    font-size: 14px;
    resize: none;
    max-height: 100px;
    outline: none;
    transition: border-color 200ms ease;
  }

  .chat-input-wrapper textarea:focus {
    border-color: var(--accent);
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #06281e;
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 767px) {
    .chat-header {
      padding: 10px 12px;
      gap: 8px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      border-radius: 8px;
    }

    .match-header {
      gap: 10px;
    }

    .match-avatar {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      font-size: 18px;
    }

    .match-info h2 {
      font-size: 14px;
    }

    .match-status {
      font-size: 11px;
    }

    .menu-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      border-radius: 8px;
      font-size: 16px;
    }

    .messages-container {
      padding: 12px;
    }

    .messages {
      gap: 10px;
    }

    .message {
      max-width: 85%;
      gap: 3px;
    }

    .message-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.3;
    }

    .message-time {
      font-size: 10px;
      padding: 0 2px;
    }

    .chat-input-container {
      padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0));
    }

    .chat-input-wrapper {
      gap: 6px;
    }

    .chat-input-wrapper textarea {
      padding: 10px 14px;
      font-size: 13px;
      border-radius: 20px;
      min-height: 36px;
      max-height: 80px;
    }

    .send-btn {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      border-radius: 50%;
    }

    .send-btn svg {
      width: 18px;
      height: 18px;
    }
  }
</style>
