<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { humanizeReason } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { yes, no }: { yes: string; no: string } = $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let blockedBecause = $derived(draft.acceptBlockedBecause)
</script>

{#if blockedBecause}
    <p class="mb-2 text-[11px] text-oath-danger">
        <TokenText text={humanizeReason(blockedBecause) ?? ''} />
    </p>
{/if}
<div class="flex gap-2">
    <button
        class="grow rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!blockedBecause}
        onclick={() => draft.accept()}
    >
        <TokenText text={yes} />
    </button>
    <button
        class="grow rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy}
        onclick={() => draft.decline()}
    >
        <TokenText text={no} />
    </button>
</div>
