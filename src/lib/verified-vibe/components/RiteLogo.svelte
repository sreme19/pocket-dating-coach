<script lang="ts">
  // riteangle brand lockup: the right-angle (∟) + heart mark and/or the
  // "rite<b>angle</b>" wordmark. Brand visual only — no behaviour.
  let {
    mark = true,
    word = true,
    inv = false,
    markSize = 32
  }: { mark?: boolean; word?: boolean; inv?: boolean; markSize?: number } = $props();
</script>

<span class="ra-logo" class:inv>
  {#if mark}
    <svg width={markSize} height={markSize} viewBox="0 0 100 100" aria-hidden="true" class="ra-mark">
      <g transform="rotate(-10 50 52)" fill="none" stroke-linecap="round">
        <path d="M37,26 L37,72" stroke={inv ? '#fff' : '#FF7A4D'} stroke-width="13" />
        <path d="M37,72 L80,72" stroke={inv ? '#fff' : '#FF3B6B'} stroke-width="13" />
      </g>
      <path
        d="M12,21 C12,21 3,14.6 3,8.6 C3,5.4 5.3,3.4 7.9,3.4 C9.8,3.4 11.3,4.6 12,5.9 C12.7,4.6 14.2,3.4 16.1,3.4 C18.7,3.4 21,5.4 21,8.6 C21,14.6 12,21 12,21 Z"
        fill={inv ? '#fff' : '#E11D54'}
        transform="translate(39.67,22.22) scale(1.778)"
      />
    </svg>
  {/if}
  {#if word}<span class="ra-word">rite<b>angle</b></span>{/if}
</span>

<style>
  .ra-logo { display: inline-flex; align-items: center; gap: 9px; }
  .ra-mark { display: block; flex: none; }
  .ra-word {
    font-family: 'Gabarito', system-ui, sans-serif;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1;
    color: var(--text-1, #1B1020);
  }
  .ra-logo.inv .ra-word { color: #fff; }
  .ra-word b { color: var(--accent, #FF3B6B); font-weight: 900; }
</style>
