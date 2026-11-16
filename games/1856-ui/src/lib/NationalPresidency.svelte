<script lang="ts">
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import type { Session1856 } from './session.svelte.js'
    let { session, offers }: { session: Session1856; offers: { poolId: string; price: number }[] } =
        $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const source = (poolId: string) => session.presentation.poolName?.(poolId) ?? poolId
</script>

<TitlePrompt
    text="You hold the CGR’s president’s certificate for one share. Buy the second share now, selling other shares first if you must; you receive nothing more."
>
    {#each offers as offer (offer.poolId)}
        <button
            class="action-button inline-action"
            disabled={busy}
            onclick={() => session.completeNationalPresidency(offer.poolId, offer.price)}
            >Pay {money(offer.price)} ({source(offer.poolId).toLowerCase()})</button
        >
    {/each}
</TitlePrompt>
