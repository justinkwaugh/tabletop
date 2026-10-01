<script lang="ts">
    import { humanizeReason } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { yes, no }: { yes: string; no: string } = $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let blockedBecause = $derived(draft.acceptBlockedBecause)
</script>

{#if blockedBecause}
    <p class="mb-2 text-[11px] text-rose-300">{humanizeReason(blockedBecause)}</p>
{/if}
<div class="flex gap-2">
    <button
        class="grow rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!blockedBecause}
        onclick={() => draft.accept()}
    >
        {yes}
    </button>
    <button
        class="grow rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy}
        onclick={() => draft.decline()}
    >
        {no}
    </button>
</div>
