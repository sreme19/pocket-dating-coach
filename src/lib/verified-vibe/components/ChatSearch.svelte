<script lang="ts">
  /**
   * ChatSearch Component
   *
   * Provides message search functionality with filters.
   * Allows searching by content, sender, and date range.
   *
   * Props:
   * - onSearch: (query: string, filters: SearchFilters) => void - Search callback
   * - isLoading: boolean - Loading state
   * - results: SearchResult[] - Search results
   * - onSelectResult: (result: SearchResult) => void - Result selection callback
   */

  import { fade, slide } from 'svelte/transition';

  interface SearchFilters {
    query: string;
    fromDate?: Date;
    toDate?: Date;
    sender?: string;
  }

  interface SearchResult {
    id: string;
    messageId: string;
    content: string;
    senderName: string;
    createdAt: Date;
    conversationId: string;
  }

  interface Props {
    onSearch?: (query: string, filters: SearchFilters) => void;
    isLoading?: boolean;
    results?: SearchResult[];
    onSelectResult?: (result: SearchResult) => void;
  }

  let {
    onSearch = () => {},
    isLoading = false,
    results = [],
    onSelectResult = () => {}
  }: Props = $props();

  let searchQuery = $state('');
  let showFilters = $state(false);
  let fromDate = $state('');
  let toDate = $state('');
  let sender = $state('');

  function handleSearch() {
    if (!searchQuery.trim()) return;

    const filters: SearchFilters = {
      query: searchQuery,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      sender: sender || undefined
    };

    onSearch(searchQuery, filters);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }

  function clearFilters() {
    fromDate = '';
    toDate = '';
    sender = '';
  }

  function formatTime(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function highlightQuery(text: string, query: string): string {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
</script>

<div class="chat-search">
  <!-- Search Input -->
  <div class="search-input-container">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>

    <input
      type="text"
      placeholder="Search messages..."
      bind:value={searchQuery}
      on:keydown={handleKeyDown}
      aria-label="Search messages"
    />

    <button
      class="filter-btn"
      on:click={() => (showFilters = !showFilters)}
      aria-label="Toggle filters"
      title="Filters"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
    </button>

    <button
      class="search-btn"
      on:click={handleSearch}
      disabled={!searchQuery.trim() || isLoading}
      aria-label="Search"
    >
      {#if isLoading}
        <div class="spinner"></div>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      {/if}
    </button>
  </div>

  <!-- Filters -->
  {#if showFilters}
    <div class="filters" transition:slide={{ duration: 200 }}>
      <div class="filter-group">
        <label for="from-date">From Date</label>
        <input type="date" id="from-date" bind:value={fromDate} />
      </div>

      <div class="filter-group">
        <label for="to-date">To Date</label>
        <input type="date" id="to-date" bind:value={toDate} />
      </div>

      <div class="filter-group">
        <label for="sender">Sender</label>
        <input type="text" id="sender" placeholder="Sender name" bind:value={sender} />
      </div>

      <button class="clear-filters-btn" on:click={clearFilters}>Clear Filters</button>
    </div>
  {/if}

  <!-- Results -->
  {#if results.length > 0}
    <div class="search-results" transition:fade={{ duration: 200 }}>
      <div class="results-header">
        <span class="results-count">{results.length} result{results.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="results-list">
        {#each results as result (result.id)}
          <button
            class="result-item"
            on:click={() => onSelectResult(result)}
            transition:slide={{ duration: 200 }}
          >
            <div class="result-sender">{result.senderName}</div>
            <div class="result-content">
              {@html highlightQuery(result.content, searchQuery)}
            </div>
            <div class="result-time">{formatTime(result.createdAt)}</div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-search {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--bg-2);
    border-radius: 8px;
  }

  .search-input-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    transition: all 200ms ease;
  }

  .search-input-container:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
  }

  .search-input-container svg {
    width: 16px;
    height: 16px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  input[type='text'],
  input[type='date'] {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-1);
    font-size: 14px;
    outline: none;
  }

  input[type='text']::placeholder {
    color: var(--text-4);
  }

  .filter-btn,
  .search-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid var(--border-1);
    cursor: pointer;
    color: var(--text-2);
    display: grid;
    place-items: center;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .filter-btn:hover,
  .search-btn:hover {
    background: var(--bg-2);
    border-color: var(--border-2);
  }

  .search-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-1);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg-1);
    border-radius: 6px;
    border: 1px solid var(--border-1);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
  }

  .filter-group input {
    padding: 6px 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 4px;
    color: var(--text-1);
    font-size: 13px;
  }

  .clear-filters-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: 4px;
    color: var(--text-2);
    font-size: 12px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .clear-filters-btn:hover {
    background: var(--bg-2);
    border-color: var(--border-2);
  }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .results-header {
    padding: 8px 0;
    border-bottom: 1px solid var(--border-1);
  }

  .results-count {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 500;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 150ms ease;
  }

  .result-item:hover {
    background: var(--bg-2);
    border-color: var(--border-2);
  }

  .result-sender {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
  }

  .result-content {
    font-size: 13px;
    color: var(--text-1);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  :global(.result-content mark) {
    background: rgba(34, 197, 94, 0.3);
    color: inherit;
    font-weight: 600;
    border-radius: 2px;
  }

  .result-time {
    font-size: 11px;
    color: var(--text-4);
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .chat-search {
      gap: 8px;
      padding: 8px;
    }

    .search-input-container {
      padding: 6px 8px;
      gap: 6px;
    }

    .filter-btn,
    .search-btn {
      width: 28px;
      height: 28px;
    }

    .filters {
      gap: 6px;
      padding: 8px;
    }

    .search-results {
      max-height: 250px;
    }

    .result-item {
      padding: 6px;
      gap: 3px;
    }

    .result-sender {
      font-size: 11px;
    }

    .result-content {
      font-size: 12px;
    }

    .result-time {
      font-size: 10px;
    }
  }
</style>
