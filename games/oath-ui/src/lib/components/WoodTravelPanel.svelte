<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import { regionName } from '$lib/model/names.js'
    import { woodCommonCost, woodCostNoteShort, type WoodRegion } from '$lib/model/woodTravel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-11.7 — the ruler picks the site and the traveller pays then; the button names the ruler,
    // the History says the rest. In a game before the ruler's pick paid (R-X.4) `regions` is absent
    // and the Wood's own price is paid with the Travel.
    let { rulerId, regions }: { rulerId: string; regions?: WoodRegion[] } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let refusal = $derived(gameSession.woodTravelRefusal)
    let free = $derived(gameSession.woodTravelIsFree)
    let common = $derived(regions ? woodCommonCost(regions) : 2)
</script>

<div class="text-sm">
    {#if free}
        <p class="mb-3">Free.</p>
    {:else if common !== undefined}
        <p class="mb-3"><span class="font-bold text-oath-accent">{common}</span> Supply.</p>
    {:else if regions}
        <!-- Each price as wide as its content, the cells sharing the widest one's width. -->
        <div
            class="mb-3 grid w-max auto-cols-fr grid-flow-col gap-1.5"
            role="list"
            aria-label="What you pay, by region"
        >
            {#each regions as row (`${row.region}:${row.cost}`)}
                <div
                    role="listitem"
                    class="rounded-md border border-oath-divider bg-oath-surface-raised px-3 py-1.5 whitespace-nowrap"
                >
                    <span
                        class="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-oath-heading"
                        >{regionName(row.region)}</span
                    >
                    <span class="block text-[15px]"
                        ><span class="font-bold text-oath-accent">{row.cost}</span> Supply</span
                    >
                    <!-- A card that changed the price is named; the Wood's own price has no note. -->
                    <span class="block text-xs text-oath-text-muted"
                        >{woodCostNoteShort(row) || ' '}</span
                    >
                </div>
            {/each}
        </div>
    {/if}
    {#if refusal}
        <p class="mb-2 text-[11px] text-oath-danger">
            <TokenText text={refusal} />
        </p>
    {/if}
    <button
        class="inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-oath-primary-border bg-oath-primary
               px-4 py-2 text-[15px] font-semibold whitespace-nowrap text-oath-primary-text
               hover:bg-oath-primary-hover disabled:opacity-40 max-sm:min-h-11"
        disabled={busy || !!refusal}
        onclick={() => gameSession.travelFromShroudedWood()}
    >
        Travel: <PlayerName playerId={rulerId} /> picks where
    </button>
</div>
