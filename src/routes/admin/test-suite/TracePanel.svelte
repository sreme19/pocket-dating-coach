<script lang="ts">
	import Icon from './Icon.svelte';
	import TSection from './TSection.svelte';
	import { AGENT_LABEL, highlightJson, highlightPrompt, type AgentTrace } from './lib';

	let { trace = null }: { trace?: AgentTrace | null } = $props();

	let copied = $state(false);
	function copy() {
		try {
			navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
		} catch {
			/* clipboard unavailable */
		}
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	let maxT = $derived(trace ? Math.max(trace.timing.claudeMs, trace.timing.totalMs, 1) : 1);
	function timeColor(v: number) {
		return v > 2800 ? 'var(--rose-strong)' : v > 1800 ? 'var(--amber)' : 'var(--emerald)';
	}
	function flagColor(c: string) {
		return c === 'green' ? 'var(--emerald)' : c === 'yellow' ? 'var(--amber)' : 'var(--rose-strong)';
	}
</script>

{#snippet timingRow(name: string, val: number)}
	<div>
		<div class="timing-top">
			<span class="timing-name">{name}</span>
			<span class="timing-val" style="color:{timeColor(val)}">{val.toLocaleString()} ms</span>
		</div>
		<div class="timing-track">
			<div class="timing-fill" style="width:{Math.min(100, (val / maxT) * 100)}%; background:{timeColor(val)}"></div>
		</div>
	</div>
{/snippet}

{#if !trace}
	<div class="card trace">
		<div class="trace-head">
			<div class="ic"><Icon name="cpu" size={16} /></div>
			<div>
				<h3>Observability trace</h3>
				<div class="sub">AgentTrace · src/lib/server/agent-trace.ts</div>
			</div>
		</div>
		<div class="trace-empty">
			<Icon name="cpu" size={40} />
			<div style="font-size:13px; color:var(--text-3); font-weight:500;">No run yet</div>
			<div style="font-size:12px; margin-top:6px; line-height:1.5;">
				Drive the agent on the left.<br />Every background step it takes will appear here.
			</div>
		</div>
	</div>
{:else}
	<div class="card trace fade-in">
		<div class="trace-head">
			<div class="ic"><Icon name="cpu" size={16} /></div>
			<div style="min-width:0">
				<h3>Observability trace</h3>
				<div class="sub">{AGENT_LABEL[trace.agent]} · {new Date(trace.startedAt).toLocaleTimeString()}</div>
			</div>
			<button class="copy-btn {copied ? 'done' : ''}" onclick={copy}>
				<Icon name={copied ? 'check' : 'copy'} size={13} />{copied ? 'Copied' : 'Copy JSON'}
			</button>
		</div>

		<div class="trace-body">
			<!-- 1. Routing & subject -->
			<TSection num="01" icon="route" title="Routing & subject" meta={trace.routing.resolvedAssistant} open>
				<dl class="kv">
					<dt>Subject</dt><dd>{trace.subject.name}</dd>
					<dt>User ID</dt><dd class="mono">{trace.subject.userId}</dd>
					<dt>Gender</dt><dd>{trace.subject.gender}</dd>
					<dt>Archetype</dt><dd>{trace.subject.archetype ?? '—'}</dd>
					<dt>Assistant</dt>
					<dd><span class="badge {trace.routing.resolvedAssistant === 'bestie' ? 'rose' : 'indigo'}">{trace.routing.resolvedAssistant}</span></dd>
					<dt>Reason</dt><dd class="mono" style="font-size:11px">{trace.routing.reason}</dd>
				</dl>
			</TSection>

			<!-- 2. Profile loaded -->
			<TSection num="02" icon="user" title="Profile loaded" meta={trace.profile.version != null ? `v${trace.profile.version}` : trace.profile.source}>
				<dl class="kv" style="margin-bottom:12px">
					<dt>Type</dt><dd>{trace.profile.type ?? '—'}</dd>
					<dt>Version</dt><dd class="mono">{trace.profile.version ?? '—'}</dd>
					<dt>Source</dt><dd class="mono">{trace.profile.source}</dd>
				</dl>
				<div class="field-label">injected data (JSONB)</div>
				<pre class="json">{@html highlightJson(trace.profile.data)}</pre>
			</TSection>

			<!-- 3. Match context -->
			{#if trace.matchContext}
				<TSection num="03" icon="link2" title="Match context" meta="abstracted">
					<pre class="json">{@html highlightJson(trace.matchContext)}</pre>
				</TSection>
			{/if}

			<!-- 4. Knowledge base -->
			{#if trace.kb}
				<TSection num="04" icon="book" title="Knowledge base" meta={`top-${trace.kb.topK}`}>
					<dl class="kv" style="margin-bottom:12px">
						<dt>Query</dt>
						<dd style="font-style:italic">"{trace.kb.query.length > 70 ? trace.kb.query.slice(0, 70) + '…' : trace.kb.query}"</dd>
						<dt>Embedding</dt><dd class="mono">{trace.kb.embeddingModel}</dd>
					</dl>
					{#if trace.kb.chunks.length}
						<table class="kbtable">
							<thead><tr><th>Chapter</th><th style="width:84px">Similarity</th></tr></thead>
							<tbody>
								{#each trace.kb.chunks as c}
									<tr>
										<td><div class="ch">{c.chapter}</div><div class="pv">{c.preview}</div></td>
										<td>
											<span class="simbar">
												<span class="simbar-track"><span class="simbar-fill" style="width:{c.similarity * 100}%"></span></span>
												<span class="simbar-val">{Math.round(c.similarity * 100)}%</span>
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div style="font-size:12.5px; color:var(--text-4)">No chunks returned for this query.</div>
					{/if}
				</TSection>
			{/if}

			<!-- 5. Claude call -->
			<TSection num="05" icon="cpu" title="Claude call" meta={trace.claude.model.replace('claude-', '').replace('-20250929', '')}>
				<dl class="kv" style="margin-bottom:12px">
					<dt>Model</dt><dd class="mono" style="font-size:11px">{trace.claude.model}</dd>
					<dt>Max tokens</dt><dd class="mono">{trace.claude.maxTokens}</dd>
					{#if trace.claude.usage}
						<dt>Token usage</dt>
						<dd class="mono" style="font-size:11px">in {trace.claude.usage.inputTokens ?? '—'} · out {trace.claude.usage.outputTokens ?? '—'}</dd>
					{/if}
				</dl>
				<div class="field-label"><Icon name="cpu" size={11} /> full system prompt</div>
				<pre class="codeblock">{@html highlightPrompt(trace.claude.systemPrompt)}</pre>
				<div class="field-label">user message</div>
				<pre class="codeblock">{@html highlightPrompt(trace.claude.userMessage)}</pre>
				<div class="field-label">raw output (pre-processing)</div>
				<pre class="codeblock">{@html highlightPrompt(trace.claude.rawOutput)}</pre>
			</TSection>

			<!-- 6. Post-processing -->
			<TSection num="06" icon="sliders" title="Post-processing" meta={`${trace.output.citations.length} cites`}>
				{#if trace.output.citations.length}
					<div class="field-label">citations parsed</div>
					<div style="display:flex; flex-wrap:wrap; gap:7px">
						{#each trace.output.citations as c}<span class="badge indigo"><Icon name="book" size={11} />{c}</span>{/each}
					</div>
				{/if}
				{#if trace.output.suggestions}
					<div class="field-label">suggestions</div>
					<div style="display:flex; flex-direction:column; gap:7px">
						{#each trace.output.suggestions as s}
							<div style="font-size:12.5px; color:var(--text-2); padding:8px 11px; background:var(--bg-2); border:1px solid var(--border); border-radius:9px; line-height:1.5">{s}</div>
						{/each}
					</div>
				{/if}
				{#if trace.output.coachingSignal}
					<div class="field-label">coaching signal (private)</div>
					<div class="coaching {trace.output.coachingSignal.color}" style="margin-top:0">
						<span class="coaching-dot"></span>
						<span><span class="coaching-label">{trace.output.coachingSignal.color}</span> — {trace.output.coachingSignal.text}</span>
					</div>
				{/if}
				{#if !trace.output.citations.length && !trace.output.suggestions && !trace.output.coachingSignal}
					<div style="font-size:12.5px; color:var(--text-4)">No post-processing for this agent (structured JSON returned directly).</div>
				{/if}
			</TSection>

			<!-- 7. Side-effects -->
			<TSection num="07" icon="shield" title="Background side-effects" meta={`${trace.sideEffects.length} skipped`}>
				<div class="sfx">
					{#each trace.sideEffects as s}
						<div class="sfx-item">
							<div class="sfx-ic"><Icon name="ban" size={14} /></div>
							<div class="sfx-main">
								<div class="sfx-name">{s.name}<span class="badge amber">skipped · test mode</span></div>
								<div class="sfx-detail">
									{#if typeof s.detail === 'string'}{s.detail}{:else}<pre class="json">{@html highlightJson(s.detail)}</pre>{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</TSection>

			<!-- 8. Timing -->
			<TSection num="08" icon="clock" title="Timing" meta={`${trace.timing.totalMs.toLocaleString()} ms`}>
				<div class="timing">
					{@render timingRow('Total (end-to-end)', trace.timing.totalMs)}
					{@render timingRow('Claude generation', trace.timing.claudeMs)}
					{#if trace.timing.embeddingMs != null}{@render timingRow('Embedding (Voyage)', trace.timing.embeddingMs)}{/if}
					{#if trace.timing.kbMs != null}{@render timingRow('KB retrieval (Supabase RPC)', trace.timing.kbMs)}{/if}
				</div>
				<div style="font-size:11px; color:var(--text-4); margin-top:12px; display:flex; align-items:center; gap:6px">
					<Icon name="alert" size={11} />Mirrors vv_ai_response_timings · thresholds amber &gt;1.8s, red &gt;2.8s · not persisted in test mode.
				</div>
			</TSection>
		</div>
	</div>
{/if}
