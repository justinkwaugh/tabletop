<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { dragToPlay } from '$lib/utils/dragToPlay.js'
    import { cardWidthShare } from '$lib/utils/cardStyle.js'
    import { handMargins } from '$lib/utils/handSpacing.js'
    import Card from './Card.svelte'

    // One row of cards `cardWidth` wide across `width`; they overlap once they no longer fit side by
    // side, each keeping its left edge and index in view. The card reached with the keyboard, or
    // else the card picked to play, opens up past its numeral.
    let { cardWidth = 112, width = 1000 }: { cardWidth?: number; width?: number } = $props()

    const gameSession = getGameSession()

    // Laying away chooses cards; in play the first click picks a card and the second plays it.
    function choose(cardId: string) {
        if (gameSession.isLayingAway) {
            gameSession.toggleLayAway(cardId)
        } else {
            void gameSession.pickOrPlay(cardId)
        }
    }

    function isRaised(cardId: string): boolean {
        return gameSession.chosenToLayAway.includes(cardId) || gameSession.pickedCard === cardId
    }

    function isSelectable(cardId: string): boolean {
        return gameSession.isLayingAway
            ? gameSession.chosenToLayAway.includes(cardId) ||
                  gameSession.layAwayChoices.includes(cardId)
            : gameSession.playableCards.includes(cardId)
    }

    const choosing = $derived(gameSession.isLayingAway || gameSession.playableCards.length > 0)

    let focused: string | undefined = $state()
    const exposed = $derived(focused ?? gameSession.pickedCard)
    const margins = $derived(
        handMargins(
            gameSession.myHand.length,
            cardWidth * cardWidthShare(gameSession.cardStyle),
            width,
            exposed === undefined ? undefined : gameSession.myHand.indexOf(exposed)
        )
    )

    function cardAt(target: EventTarget | null): string | undefined {
        const slot = target instanceof Element ? target.closest<HTMLElement>('[data-card]') : null
        return slot?.dataset.card
    }

    function onFocusIn(event: FocusEvent) {
        focused =
            event.target instanceof Element && event.target.matches(':focus-visible')
                ? cardAt(event.target)
                : undefined
    }
</script>

<div class="hand" style:--card-w="{cardWidth}px" {@attach gameSession.cardPlaces.myHand()}>
    <div
        class="row"
        role="group"
        aria-label="Your hand"
        onfocusin={onFocusIn}
        onfocusout={() => (focused = undefined)}
    >
        {#each gameSession.myHand as cardId, index (cardId)}
            {@const selectable = isSelectable(cardId)}
            {@const playable = gameSession.playableCards.includes(cardId)}
            <div
                class="slot"
                class:draggable={playable}
                data-card={cardId}
                style:margin-left="{margins[index]}px"
                {@attach dragToPlay({
                    enabled: playable,
                    onDrop: () => gameSession.playCard(cardId)
                })}
                {@attach gameSession.cardPlaces.heldCard(cardId)}
            >
                <Card
                    {cardId}
                    style={gameSession.cardStyle}
                    {selectable}
                    chosen={isRaised(cardId)}
                    dimmed={choosing && !selectable}
                    onclick={() => choose(cardId)}
                />
            </div>
        {/each}
    </div>
</div>

<style>
    .hand {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 26px;
    }

    .row {
        display: flex;
        justify-content: center;
    }

    .slot {
        position: relative;
        transition:
            transform 160ms ease,
            margin-left 120ms ease;
    }

    .draggable {
        touch-action: none;
    }
</style>
