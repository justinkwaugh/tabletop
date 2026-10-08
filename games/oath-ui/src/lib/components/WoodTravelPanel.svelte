<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { regionName } from '$lib/model/names.js'
    import {
        woodCommonCost,
        woodCostNote,
        woodCostNoteShort,
        type WoodRegion
    } from '$lib/model/woodTravel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-11.7 — the ruler picks the site and the traveller pays then; only the regions the ruler can pick are priced.
    let { ruler, regions }: { ruler: string; regions: WoodRegion[] } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let reason = $derived(gameSession.woodTravelReason)
    let free = $derived(gameSession.woodTravelIsFree)
    let common = $derived(woodCommonCost(regions))
</script>

<div class="text-sm">
    <p class="mb-2.5">
        {ruler} rules this Shrouded Wood: {ruler} picks where you go, and you pay when {ruler} picks.
    </p>
    {#if free}
        <p class="mb-3">
            Your free Travel: you pay <span class="font-bold text-oath-accent">no</span> Supply,
            wherever {ruler} picks.
        </p>
    {:else if common !== undefined}
        <p class="mb-3">
            You pay <span class="font-bold text-oath-accent">{common}</span> Supply when {ruler} picks,
            wherever it is.
        </p>
    {:else}
        <div
            class="mb-3 inline-grid auto-cols-fr grid-flow-col gap-1.5 max-sm:grid max-sm:w-full"
            role="list"
            aria-label="What you pay, by region"
        >
            {#each regions as row (`${row.region}:${row.cost}`)}
                <div
                    role="listitem"
                    class="rounded-md border border-oath-divider bg-oath-surface-raised px-3 py-1.5 whitespace-nowrap
                           max-sm:px-2 max-sm:py-1 max-sm:whitespace-normal"
                >
                    <span
                        class="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-oath-heading"
                        >{regionName(row.region)}</span
                    >
                    <span class="block text-[15px] max-sm:text-sm"
                        ><span class="font-bold text-oath-accent">{row.cost}</span> Supply</span
                    >
                    <span class="block text-xs text-oath-text-muted"
                        ><span class="max-sm:hidden">{woodCostNote(row)}</span><span
                            class="sm:hidden">{woodCostNoteShort(row) || ' '}</span
                        ></span
                    >
                </div>
            {/each}
        </div>
    {/if}
    {#if reason}
        <p class="mb-2 text-[11px] text-oath-danger">
            <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
        </p>
    {/if}
    <button
        class="block rounded-md bg-oath-primary px-4 py-2.5 text-[15px] leading-none font-semibold whitespace-nowrap
               text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 max-sm:w-full"
        disabled={busy || !!reason}
        onclick={() => gameSession.travelFromShroudedWood()}
    >
        Travel: {ruler} picks where
    </button>
</div>
