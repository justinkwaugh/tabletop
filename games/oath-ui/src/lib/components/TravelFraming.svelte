<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { regionName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { openingRegion, regionCounts, type TravelFrame } from '$lib/model/travelOnTheMap.js'

    // Travel on a phone: the map is the menu, so the step frames it. Upright, one region at a
    // time, opening on the pawn's region (or the first with a destination), with a chip per
    // region naming its count; a chip reframes and chooses nothing. Sideways, every site at once.
    let {
        upright,
        framed,
        onframe,
        onrelease
    }: {
        upright: boolean
        framed: TravelFrame | undefined
        onframe: (frame: TravelFrame) => void
        onrelease: () => void
    } = $props()

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    let counts = $derived(
        regionCounts(
            gameSession.siteOffers
                .filter((offer) => offer.intent === 'travel')
                .map((offer) => offer.slotId),
            (slotId) => gameState.regionOf(slotId)
        )
    )

    function opening(): TravelFrame | undefined {
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

<div class="travel-framing" {@attach frameWhileOpen}>
    {#if upright}
        <div class="chips" role="group" aria-label="Frame the map on a region">
            {#each counts.filter(({ count }) => count > 0) as { region, count } (region)}
                <button
                    type="button"
                    class="chip"
                    class:chip--on={framed === region}
                    aria-pressed={framed === region}
                    aria-label="{regionName(region)}: {count} to travel to"
                    onclick={() => onframe(region)}
                >
                    {regionName(region)} <span class="chip__count">{count}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .travel-framing {
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
