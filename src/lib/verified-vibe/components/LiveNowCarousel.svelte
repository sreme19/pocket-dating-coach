<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  interface LiveUser {
    id: string;
    name: string;
    age: number;
    profession: string;
    avatar: string;
    online: boolean;
  }

  // Mock data for live users
  const liveUsers: LiveUser[] = [
    {
      id: '1',
      name: 'Sarah',
      age: 26,
      profession: 'Designer',
      avatar: '👩‍🦰',
      online: true
    },
    {
      id: '2',
      name: 'Emma',
      age: 24,
      profession: 'Marketer',
      avatar: '👩‍💼',
      online: true
    },
    {
      id: '3',
      name: 'Jessica',
      age: 28,
      profession: 'Developer',
      avatar: '👩‍💻',
      online: true
    },
    {
      id: '4',
      name: 'Alex',
      age: 29,
      profession: 'Entrepreneur',
      avatar: '👨‍💼',
      online: true
    },
    {
      id: '5',
      name: 'Michael',
      age: 31,
      profession: 'Designer',
      avatar: '👨‍🎨',
      online: false
    },
    {
      id: '6',
      name: 'David',
      age: 27,
      profession: 'Engineer',
      avatar: '👨‍💻',
      online: true
    },
    {
      id: '7',
      name: 'James',
      age: 30,
      profession: 'Consultant',
      avatar: '👨‍💼',
      online: true
    },
    {
      id: '8',
      name: 'Chris',
      age: 26,
      profession: 'Photographer',
      avatar: '👨‍📷',
      online: false
    }
  ];

  let scrollContainer: HTMLElement;
  let canScrollLeft = $state(false);
  let canScrollRight = $state(true);

  function checkScroll() {
    if (!scrollContainer) return;
    canScrollLeft = scrollContainer.scrollLeft > 0;
    canScrollRight =
      scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 10;
  }

  function scroll(direction: 'left' | 'right') {
    if (!scrollContainer) return;
    const scrollAmount = 280; // Width of card + gap
    scrollContainer.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
    setTimeout(checkScroll, 300);
  }

  $effect(() => {
    checkScroll();
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScroll);
      return () => scrollContainer.removeEventListener('scroll', checkScroll);
    }
  });
</script>

<div class="carousel-section" transition:fade={{ duration: 300 }}>
  <div class="carousel-header">
    <div>
      <h3 class="carousel-title">Live Now</h3>
      <p class="carousel-subtitle">Active users right now</p>
    </div>
    <div class="carousel-controls">
      <button
        class="carousel-btn {!canScrollLeft ? 'disabled' : ''}"
        onclick={() => scroll('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        class="carousel-btn {!canScrollRight ? 'disabled' : ''}"
        onclick={() => scroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  </div>

  <div class="carousel-container" bind:this={scrollContainer}>
    {#each liveUsers as user (user.id)}
      <button class="user-card" transition:fade={{ duration: 200 }}>
        <div class="user-avatar">
          <div class="avatar-emoji">{user.avatar}</div>
          <div class="online-indicator {user.online ? 'online' : 'offline'}"></div>
        </div>
        <div class="user-info">
          <div class="user-name">{user.name}</div>
          <div class="user-meta">{user.age} • {user.profession}</div>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .carousel-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 24px 0;
  }

  .carousel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .carousel-title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.005em;
    color: var(--text-1);
    margin: 0;
  }

  .carousel-subtitle {
    font-size: 12px;
    color: var(--text-3);
    margin: 2px 0 0;
  }

  .carousel-controls {
    display: flex;
    gap: 6px;
  }

  .carousel-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--r-md);
    border: 1px solid var(--border-1);
    background: var(--bg-2);
    color: var(--text-2);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 200ms ease;
    font-family: inherit;
    padding: 0;
  }

  .carousel-btn:hover:not(.disabled) {
    border-color: var(--accent);
    color: var(--accent-bright);
    background: var(--bg-3);
  }

  .carousel-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .carousel-container {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-behavior: smooth;
    padding: 4px 0;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .carousel-container::-webkit-scrollbar {
    display: none;
  }

  .user-card {
    flex: 0 0 260px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-lg);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    transition: all 200ms ease;
    font-family: inherit;
    color: inherit;
    text-align: left;
  }

  .user-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .user-avatar {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--r-md);
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .avatar-emoji {
    font-size: 48px;
    line-height: 1;
  }

  .online-indicator {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bg-2);
    background: var(--text-3);
    transition: background 200ms ease;
  }

  .online-indicator.online {
    background: var(--accent-bright);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-name {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.005em;
    color: var(--text-1);
  }

  .user-meta {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 767px) {
    .carousel-section {
      margin: 20px 0;
      gap: 12px;
    }

    .carousel-title {
      font-size: 15px;
    }

    .user-card {
      flex: 0 0 240px;
    }

    .avatar-emoji {
      font-size: 40px;
    }
  }
</style>
