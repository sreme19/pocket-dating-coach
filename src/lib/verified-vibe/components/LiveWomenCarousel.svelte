<script lang="ts">
  import OnlineIndicator from './OnlineIndicator.svelte';

  interface Woman {
    id: string;
    name: string;
    age: number;
    avatar: string;
    title: string;
    isOnline: boolean;
    lastSeen?: Date;
    lastActiveTime?: string;
  }

  interface Props {
    women?: Woman[];
    title?: string;
    subtitle?: string;
  }

  let { women = [], title = 'Compatible Women Online Now', subtitle = '6 Live · 10 today' } = $props();

  // Mock data if none provided
  const mockWomen: Woman[] = [
    {
      id: '1',
      name: 'Maya',
      age: 28,
      avatar: '👩‍🦰',
      title: 'Architect',
      isOnline: true,
      lastActiveTime: '12m ago'
    },
    {
      id: '2',
      name: 'Lena',
      age: 27,
      avatar: '👩‍💼',
      title: 'Brand strategist',
      isOnline: true,
      lastActiveTime: '1h ago'
    },
    {
      id: '3',
      name: 'Camille',
      age: 29,
      avatar: '👩‍⚖️',
      title: 'Lawyer',
      isOnline: true,
      lastActiveTime: '1h ago'
    },
    {
      id: '4',
      name: 'Talia',
      age: 30,
      avatar: '👩‍💻',
      title: 'VC analyst',
      isOnline: false,
      lastActiveTime: '1d ago'
    },
    {
      id: '5',
      name: 'Reyna',
      age: 25,
      avatar: '👩‍🎨',
      title: 'Fashion buyer',
      isOnline: true,
      lastActiveTime: 'just now'
    }
  ];

  const displayWomen = $derived(women.length > 0 ? women : mockWomen);
</script>

<div class="carousel-container">
  <div class="carousel-header">
    <div>
      <h3 class="carousel-title">● {title}</h3>
      <p class="carousel-subtitle">{subtitle}</p>
    </div>
  </div>

  <div class="carousel-scroll">
    {#each displayWomen as woman (woman.id)}
      <div class="carousel-item">
        <div class="avatar-wrapper">
          <div class="avatar">
            {woman.avatar}
          </div>
          <div class="online-badge {woman.isOnline ? 'online' : 'offline'}"></div>
        </div>
        <div class="woman-info">
          <h4 class="woman-name">{woman.name}, {woman.age}</h4>
          <p class="woman-title">{woman.title}</p>
          {#if woman.lastActiveTime}
            <p class="woman-time">● {woman.lastActiveTime}</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="carousel-footer">
    <p class="footer-text">
      ● The moment you're verified, you're talking to a few of them <span class="highlight">within 30 minutes.</span>
    </p>
  </div>
</div>

<style>
  .carousel-container {
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: 12px;
    overflow: hidden;
  }

  .carousel-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .carousel-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 4px;
  }

  .carousel-subtitle {
    font-size: 11px;
    color: var(--text-4);
    margin: 0;
  }

  .carousel-scroll {
    display: flex;
    gap: 12px;
    padding: 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  .carousel-scroll::-webkit-scrollbar {
    height: 4px;
  }

  .carousel-scroll::-webkit-scrollbar-track {
    background: var(--bg-2);
  }

  .carousel-scroll::-webkit-scrollbar-thumb {
    background: var(--border-2);
    border-radius: 2px;
  }

  .carousel-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 200ms ease;
  }

  .carousel-item:hover {
    transform: translateY(-2px);
  }

  .avatar-wrapper {
    position: relative;
    width: 64px;
    height: 64px;
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-tint), var(--bg-3));
    border: 2px solid var(--border-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
  }

  .online-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--bg-1);
    background: var(--text-4);
  }

  .online-badge.online {
    background: var(--accent-bright);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
  }

  .woman-info {
    text-align: center;
    width: 100%;
  }

  .woman-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
    white-space: nowrap;
  }

  .woman-title {
    font-size: 11px;
    color: var(--text-3);
    margin: 2px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .woman-time {
    font-size: 10px;
    color: var(--text-4);
    margin: 2px 0 0;
  }

  .carousel-footer {
    padding: 12px 16px;
    background: var(--accent-tint);
    border-top: 1px solid rgba(52, 211, 153, 0.2);
  }

  .footer-text {
    font-size: 12px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .highlight {
    color: var(--accent-bright);
    font-weight: 600;
  }
</style>
