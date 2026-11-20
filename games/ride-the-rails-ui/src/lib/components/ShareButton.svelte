<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import type { ShareButton } from '$lib/model/railroadCards.js'
    import { shareButtonHandlers } from '$lib/model/railroadSpotlight.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SupplyCount from './SupplyCount.svelte'

    /** `dots`: the viewer's shares under the count; the desktop row leaves them to the seat cards. */
    let { button, dots = true }: { button: ShareButton; dots?: boolean } = $props()

    const gameSession = getGameSession()

    const dotColour = $derived(
        gameSession.myPlayerId
            ? gameSession.colors.getPlayerBgColorValue(gameSession.myPlayerId)
            : undefined
    )

    // The row's buttons are made again whenever a card's count moves; the handlers, and the hover
    // they hold, follow only the railroad and whether it can be taken.
    const railroadId = $derived(button.railroadId)
    const enabled = $derived(button.enabled)
    const handlers = $derived(shareButtonHandlers(gameSession, railroadId, enabled))
    const spotlit = $derived(enabled && gameSession.spotlightRailroadId === railroadId)

    // A hover ends with the handlers that began it: when the button is disabled or leaves the page.
    const releaseHover: Attachment = () => handlers.release
</script>

<!-- Contract, Take a share: one railroad's share button, the same on the desktop cards and the
     phone panel: its supply as a cube and the number left, the viewer's shares as a row of dots
     under it; an empty supply is a dashed card, disabled. It fills the width its parent gives it, its count smaller when that is narrow.
     Enabled, it shows the pointer, and a mouse over it spotlights its railroad and rings it in the
     accent colour, as a railroad card does off turn (Look: railroad spotlight); a press only takes
     the share. -->
<button
    type="button"
    class="share focus-visible:outline-2 focus-visible:outline-rtr-accent"
    class:empty={button.supply === 0}
    class:spotlit
    disabled={!enabled}
    aria-label={button.shareLabel}
    onclick={handlers.onclick}
    onpointerenter={handlers.onpointerenter}
    onpointerleave={handlers.onpointerleave}
    {@attach releaseHover}
>
    <span class="count"><SupplyCount railroadId={button.railroadId} supply={button.supply} /></span>
    {#if dots}
        <span class="dots">
            {#each { length: button.held }, index (index)}
                <span class="dot" style:background-color={dotColour}></span>
            {/each}
        </span>
    {/if}
</button>

<style>
    .share {
        position: relative;
        flex: 1;
        min-width: 0;
        height: 34px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        overflow: hidden;
        border-radius: 6px;
        border: 1.5px solid var(--rtr-line);
        background: var(--rtr-panel-raised);
        box-shadow: 0 2px 0 var(--rtr-line);
        color: var(--rtr-ink);
        container-type: inline-size;
    }

    /* Six railroads in a narrow phone's row: a smaller cube and figure, so the number never clips. */
    @container (max-width: 44px) {
        .count {
            --supply-cube: 10px;
            --supply-gap: 3px;
            --supply-figure: 17px;
        }
    }

    .share:enabled {
        cursor: pointer;
    }

    /* The off-turn card's spotlight ring, kept with the button's own shadow. Drawn here, since the
       unlayered border and shadow above win over a layered utility. */
    .share.spotlit {
        box-shadow:
            0 0 0 2px var(--rtr-accent),
            0 2px 0 var(--rtr-line);
    }

    .share:disabled {
        opacity: 0.55;
    }

    .share.empty {
        border-style: dashed;
        box-shadow: none;
    }

    /* Always there, empty or not, so every button's count sits at the same height. */
    .dots {
        display: flex;
        gap: 2px;
        height: 5px;
    }

    .dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
    }
</style>
