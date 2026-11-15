<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { shareOrder } from '$lib/model/actionArea.js'
    import { isInFullScreen } from '$lib/model/fullScreenContext.js'
    import { shareButtons, shownRailroadCards } from '$lib/model/railroadCards.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import { SHARE_BUTTON_ROW, fittedPileUnit, pileFootprint } from '$lib/utils/supplyPile.js'
    import SupplyPile from '../board/SupplyPile.svelte'

    const gameSession = getGameSession()
    const inFullScreen = isInFullScreen()

    const playerId = $derived(gameSession.myPlayerId)
    const buttons = $derived(shareButtons(shownRailroadCards(gameSession), gameSession))
    const dotColour = $derived(
        playerId ? gameSession.colors.getPlayerBgColorValue(playerId) : undefined
    )

    // The row's inner width: the piles are drawn as large as lets every button fit it.
    let room = $state(0)
    const unit = $derived(
        fittedPileUnit(
            buttons.map((button) => pileFootprint('follow', button.supply).width),
            room,
            SHARE_BUTTON_ROW
        )
    )

    // R-2.2: "phase 1 goes in reverse turn order: you first, then Ezra, Silas, Hattie".
    const orderText = $derived.by(() => {
        const names = shareOrder(gameSession.gameState).map((id) =>
            id === playerId ? 'you' : gameSession.getPlayerName(id)
        )
        const [first, ...rest] = names
        return rest.length > 0 ? `${first} first, then ${rest.join(', ')}` : first
    })
</script>

<div class="flex flex-wrap items-baseline gap-x-3">
    <h2 class="text-base font-bold">Take a share</h2>
    <span class="text-sm text-rtr-ink-muted max-sm:hidden"
        >phase 1 goes in reverse turn order: {orderText}</span
    >
</div>
<!-- Contract, Take a share: on a phone the piles are the buttons, one per railroad available this
     round (R-1.4), with no words: the viewer's shares are dots, and an empty supply is a dashed
     ghost, disabled. On wider screens the railroad cards above the board are the buttons, except
     in full screen, whose dialog leaves the cards out of reach: there the piles are the buttons at
     every width. The panel shows once a round has stepped, so a railroad that round adds is simply
     among them. -->
{#if isPhoneWidth() || inFullScreen}
    <div class="share-row" role="group" aria-label="Railroads" bind:clientWidth={room}>
        {#each buttons as button (button.railroadId)}
            <button
                type="button"
                class="share hover:enabled:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent"
                class:empty={button.supply === 0}
                disabled={!button.enabled}
                aria-label={button.shareLabel}
                onclick={() => gameSession.takeShare(button.railroadId)}
            >
                <SupplyPile
                    railroadId={button.railroadId}
                    supply={button.supply}
                    fit="follow"
                    {unit}
                />
                <span class="dots">
                    {#each { length: button.held }, index (index)}
                        <span class="dot" style:background-color={dotColour}></span>
                    {/each}
                </span>
            </button>
        {/each}
    </div>
{/if}

<style>
    .share-row {
        display: flex;
        gap: 5px;
        margin-top: 6px;
    }

    .share {
        min-width: 40px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 3px;
        padding: 5px 5px 4px;
        border: 1.5px solid var(--rtr-line);
        border-radius: 9px;
        background: var(--rtr-panel-raised);
        box-shadow: 0 1.5px 0 var(--rtr-line);
    }

    .share:disabled {
        opacity: 0.55;
    }

    .share.empty {
        border-style: dashed;
        box-shadow: none;
    }

    .dots {
        display: flex;
        gap: 2px;
        height: 6px;
    }

    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }
</style>
