<script lang="ts">
  import { ARCHETYPES } from '$lib/verified-vibe/constants';
  import type { Archetype } from '$lib/verified-vibe/types';
  import TraitsList from './TraitsList.svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    archetype: Archetype;
    onClose?: () => void;
  }

  let { archetype, onClose } = $props();

  const archetypeData = ARCHETYPES[archetype];

  // Extract match traits (those with lead: true first)
  const leadTraits = archetypeData.matchTraits.filter(t => t.lead).map(t => t.label);
  const otherTraits = archetypeData.matchTraits.filter(t => !t.lead).map(t => t.label);
  const allMatchTraits = [...leadTraits, ...otherTraits];

  const avoidTraits = archetypeData.avoidTraits.map(t => t.label);
  const brings = archetypeData.brings;
</script>

<div class="profile-summary-card">
  <div class="card-header">
    <div class="card-title-section">
      <div class="archetype-emoji">{archetypeData.emoji}</div>
      <div>
        <h2 class="card-title">{archetypeData.name}</h2>
        <p class="card-subtitle">{archetypeData.longTag}</p>
      </div>
    </div>
    {#if onClose}
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <X size={20} />
      </button>
    {/if}
  </div>

  <div class="card-content">
    <!-- You'll Match With -->
    <section class="summary-section">
      <h3 class="section-title">💚 You'll Match With</h3>
      <TraitsList traits={allMatchTraits} type="match" variant="pills" />
    </section>

    <!-- You Won't See -->
    <section class="summary-section">
      <h3 class="section-title">✕ You Won't See</h3>
      <TraitsList traits={avoidTraits} type="avoid" variant="pills" />
    </section>

    <!-- What You Bring -->
    <section class="summary-section">
      <h3 class="section-title">✨ What You Bring</h3>
      <TraitsList traits={brings} type="brings" variant="items" />
    </section>

    <!-- Verification Requirements -->
    <section class="summary-section">
      <h3 class="section-title">🔐 Verification (~{archetypeData.timeMins} min)</h3>
      <div class="needs-list">
        {#each archetypeData.needs as need}
          <div class="need-item">
            <span class="need-check">✓</span>
            <span class="need-text">{need}</span>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .profile-summary-card {
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: 16px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .card-title-section {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .archetype-emoji {
    font-size: 32px;
    flex-shrink: 0;
  }

  .card-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0 0 4px;
  }

  .card-subtitle {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
    line-height: 1.4;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    padding: 4px;
    display: grid;
    place-items: center;
    transition: color 200ms ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: var(--text-1);
  }

  .card-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .summary-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }

  .needs-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .need-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
  }

  .need-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-bright);
    color: var(--bg-1);
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .need-text {
    font-size: 14px;
    color: var(--text-1);
    line-height: 1.4;
  }
</style>
