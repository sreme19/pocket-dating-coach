<script lang="ts">
  import { ChevronRight } from 'lucide-svelte';
  import type { ArchetypeDefinition } from '../types';

  interface Props {
    archetype: ArchetypeDefinition;
    onOpen?: () => void;
  }

  let { archetype, onOpen }: Props = $props();
</script>

<button class="card" onclick={onOpen} aria-label="View {archetype.name} details">
  <div class="card-icon">{archetype.emoji}</div>
  <div class="card-text">
    <span class="card-name">{archetype.name}</span>
    <span class="card-tag">{archetype.tag}</span>
  </div>
  <div class="card-chevron">
    <ChevronRight size={20} />
  </div>
</button>

<style>
  .card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 16px;
    cursor: pointer;
    transition: border-color 200ms, background 200ms;
    text-align: left;
    font-family: inherit;
    color: inherit;
    min-height: 76px;
  }

  .card:active {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  @media (hover: hover) {
    .card:hover {
      border-color: var(--border-3);
    }
  }

  .card-icon {
    width: 52px;
    height: 52px;
    background: var(--bg-3);
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-size: 26px;
    flex-shrink: 0;
  }

  .card-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-name {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-1);
    line-height: 1.2;
  }

  .card-tag {
    font-size: 13px;
    color: var(--text-3);
    line-height: 1.3;
  }

  .card-chevron {
    color: var(--text-3);
    flex-shrink: 0;
  }
</style>
