<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ShieldCheck } from 'lucide-svelte';
  import { Toaster } from 'svelte-sonner';

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
  <title>riteangle</title>
</svelte:head>

{#if isVV}
  {@render children()}
{:else if isTool}
  <div class="flex h-screen flex-col bg-[#FFF3F0] text-[#1B1020]">
    <header class="flex shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white/90 px-5 py-3 backdrop-blur">
      <button
        onclick={() => goto('/verified-vibe')}
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[#6E5F64] transition-colors hover:bg-[#FF3B6B]/10 hover:text-[#E11D54]"
      >
        <ShieldCheck class="h-4 w-4 text-[#FF3B6B]" />
        <span>riteangle</span>
      </button>
      <span class="text-[#C2B0B5]">/</span>
      <span class="text-sm font-medium text-[#1B1020]">{activeTool?.[1]}</span>
    </header>
    <main class="flex flex-1 flex-col overflow-hidden">
      {@render children()}
    </main>
    <footer class="shrink-0 border-t border-black/[0.05] bg-[#FBE9E6] px-5 py-3">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span class="text-xs font-medium uppercase tracking-widest text-[#A08B91]">Tools</span>
        {#each footerLinks as [href, name]}
          <a {href} class="text-xs text-[#6E5F64] transition-colors hover:text-[#E11D54]">{name}</a>
        {/each}
      </div>
    </footer>
  </div>
{:else}
  {@render children()}
{/if}

<Toaster position="top-center" richColors />
