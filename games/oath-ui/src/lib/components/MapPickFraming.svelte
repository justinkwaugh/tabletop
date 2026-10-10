<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import type { Region } from '@tabletop/oath'
    import type { MapPick } from '$lib/model/actionOffers.js'
    import { regionName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { openingRegion, regionCounts, type MapFrame } from '$lib/model/travelOnTheMap.js'

    // A pick on the map on a phone (Travel, Setup's start site): the map is the menu, so the step
    // frames it. Upright, one region at a time, opening on the pawn's region (or the first with a
    // lit site), with a chip per region naming its count; a chip reframes and chooses nothing.
    // Setup's one legal site (the Chancellor's) is framed with no chips. Sideways, the lit map at
    // once, with no chips.
    let {
        pick,
        upright,
        framed,
        onframe,
        onrelease
    }: {
        pick: MapPick
        upright: boolean
        framed: MapFrame | undefined
        onframe: (frame: MapFrame) => void
        onrelease: () => void
    } = $props()

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    let counts = $derived(regionCounts(pick.sites, (slotId) => gameState.regionOf(slotId)))

    function chipLabel(region: Region, count: number): string {
        const name = regionName(region)
        if (pick.kind === 'travel') return `${name}: ${count} to travel to`
        return `${name}: ${count} start ${count === 1 ? 'site' : 'sites'}`
    }

    function opening(): MapFrame | undefined {
        if (!upright) return 'all'
        const seatId = gameSession.liveTurnSeatId
        const siteId = seatId ? gameState.getPlayerState(seatId).siteId : undefined
        return openingRegion(siteId ? gameState.regionOf(siteId) : undefined, counts)
    }

    // Once, as the step opens; the view the step found comes back when it closes.
    const frameWhileOpen: Attachment = () => {
        const frame = untrack(opening)
        if (frame !== undefined) untrack(() => onframe(frame))
        return () => untrack(onrelease)
    }
</script>

<div class="map-pick-framing" {@attach frameWhileOpen}>
    {#if upright && pick.choosing}
        <div class="chips" role="group" aria-label="Frame the map on a region">
            {#each counts.filter(({ count }) => count > 0) as { region, count } (region)}
                <button
                    type="button"
                    class="chip"
                    class:chip--on={framed === region}
                    aria-pressed={framed === region}
                    aria-label={chipLabel(region, count)}
                    onclick={() => onframe(region)}
                >
                    {regionName(region)} <span class="chip__count">{count}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .map-pick-framing {
        display: contents;
    }
    /* Along the map's top edge, clear of the framed sites, as the desktop's focus views sit. */
    .chips {
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-wrap: nowrap;
        gap: 2px;
        max-width: calc(100% - 8px);
        padding: 2px;
        border-radius: 9px;
        border: 1px solid var(--oath-divider);
        background: rgb(0 0 0 / 0.6);
        pointer-events: auto;
    }
    .chip {
        padding: 2px 8px;
        border-radius: 7px;
        border: 1.5px solid transparent;
        color: var(--oath-text);
        font-size: 15px;
        font-weight: 700;
        line-height: 1.6;
        white-space: nowrap;
    }
    .chip__count {
        color: var(--oath-accent);
    }
    .chip--on {
        border-color: var(--oath-accent);
        background: var(--oath-accent-soft);
        color: var(--oath-accent);
    }
</style>
