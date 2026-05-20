<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ShieldCheck } from 'lucide-svelte';

  let { children } = $props();

  const toolLinks: [string, string][] = [
    ['/chat', 'Ask Coach'],
    ['/profile-review', 'Analyze Profile'],
    ['/female-profile', 'For Her'],
    ['/chat-analyzer', 'Chat Analyzer'],
    ['/reply-suggester', 'Reply Suggester'],
  ];

  let pathname = $derived($page.url.pathname);
  let isVV = $derived(pathname.startsWith('/verified-vibe'));
  let activeTool = $derived(toolLinks.find(([k]) => pathname.startsWith(k)));
  let isTool = $derived(!isVV && !!activeTool);
  let footerLinks = $derived(toolLinks.filter(([k]) => !pathname.startsWith(k)));
</script>

<svelte:head>
  <title>Pocket Dating Coach</title>
</svelte:head>

{#if isVV}
  {@render children()}
{:else if isTool}
  <div class="flex h-screen flex-col bg-[#0b1120] text-slate-100">
    <header class="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0d1522]/90 px-5 py-3 backdrop-blur">
      <button
        onclick={() => goto('/verified-vibe')}
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
      >
        <ShieldCheck class="h-4 w-4 text-emerald-500" />
        <span>Verified Vibe</span>
      </button>
      <span class="text-slate-700">/</span>
      <span class="text-sm font-medium text-slate-200">{activeTool?.[1]}</span>
    </header>
    <main class="flex flex-1 flex-col overflow-hidden">
      {@render children()}
    </main>
    <footer class="shrink-0 border-t border-white/[0.04] bg-[#080e1b] px-5 py-3">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span class="text-xs font-medium uppercase tracking-widest text-slate-700">Tools</span>
        {#each footerLinks as [href, name]}
          <a {href} class="text-xs text-slate-600 transition-colors hover:text-slate-400">{name}</a>
        {/each}
      </div>
    </footer>
  </div>
{:else}
  {@render children()}
{/if}
