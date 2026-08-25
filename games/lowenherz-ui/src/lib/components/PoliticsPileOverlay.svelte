<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    const pileA = $derived(gameSession.gameState.politicsCardPileA)
    const pileB = $derived(gameSession.gameState.politicsCardPileB)

    // Desktop width. On a phone, min() takes over: two piles plus the gap used to be a fixed
    // 340px (150px each + a 40px gap), which ran past both edges of a 320-375px viewport - the
    // same shrink PoliticsHand needed for its fanned cards (see that component's CARD_WIDTH_CSS).
    // The gap shrinks alongside it so the pair doesn't just end up touching at the smallest sizes.
    const CARD_WIDTH = 150
    const CARD_WIDTH_CSS = `min(${CARD_WIDTH}px, 38vw)`
    const PILE_GAP_CSS = 'clamp(0.75rem, 4vw, 2.5rem)'

    // Half the piles row's width (the widest thing in the centred column, per the heading
    // comment below) plus a margin, used to keep the whole column clamped inside the viewport
    // even when boardCenter sits close to an edge - which it does on the phone layout, where the
    // board pane is narrower than the viewport and can be scrolled off-centre.
    const HALF_ROW_CSS = `calc(${CARD_WIDTH_CSS} + (${PILE_GAP_CSS}) / 2 + 12px)`

    // Only up before a pile is chosen. Once one is, PoliticsHand's fan takes over (see its
    // isOpen) - and since both this and that use a translucent backdrop, leaving this mounted
    // underneath let it show through behind the fanned cards instead of actually going away.
    const showing = $derived(gameSession.canTakePoliticsCard && !gameSession.selectedPoliticsPile)

    // Centered on the board rather than the viewport: the table layout puts a sidebar
    // down one side, so viewport-centering lands this visibly off to one side of the
    // board it's meant to cover. Measured when the overlay goes up (and on resize),
    // falling back to viewport-centering if the frame can't be found - same approach as
    // the region-scoring aid in ActionToolbar.
    let boardCenter: { x: number; y: number } | undefined = $state(undefined)

    function measure() {
        const rect = document.getElementById('lowenherz-board-frame')?.getBoundingClientRect()
        boardCenter = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined
    }

    // An attachment rather than an effect keyed on `showing`: the node only exists while showing,
    // so its lifetime IS the condition, and the listener is registered and torn down with it.
    function trackBoardCentre() {
        measure()
        window.addEventListener('resize', measure)
        return () => {
            window.removeEventListener('resize', measure)
            boardCenter = undefined
        }
    }

    // The rulebook has you look through ONE pile, so opening one is a one-way commitment: once
    // selectedPoliticsPile is set, PoliticsHand's fan covers the whole screen (see its isOpen) and
    // this overlay is never seen again until a card is taken, so neither pile stays selectable. An
    // exhausted pile is never a choice either - the engine refuses it outright, so better for it to
    // be visibly inert than to invite a click that can only error.
    function canSelectPile(pile: 'A' | 'B'): boolean {
        if (!gameSession.canTakePoliticsCard || gameSession.selectedPoliticsPile) return false
        return (pile === 'A' ? pileA : pileB).length > 0
    }

    // Feeds PoliticsHand's "deal" animation - the cards fly out from wherever the pile
    // actually is on screen, so it needs the real viewport position at click time.
    function onPileClick(pile: 'A' | 'B', event: MouseEvent) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        gameSession.selectPoliticsPile(pile, origin)
    }
</script>

{#snippet pile(which: 'A' | 'B', cards: typeof pileA)}
    {@const selectable = canSelectPile(which)}
    <button
        type="button"
        disabled={!selectable}
        onclick={(e) => onPileClick(which, e)}
        style="width: {CARD_WIDTH_CSS};"
        class="relative rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-transform {selectable
            ? 'cursor-pointer hover:-translate-y-1'
            : ''}"
    >
        {#if cards.length > 0}
            <PoliticsCard card={cards[0]} faceDown />
        {:else}
            <div
                class="aspect-[534/832] rounded-md border border-dashed border-white/40 flex items-center justify-center text-white/60 text-sm"
            >
                empty
            </div>
        {/if}
        {#if cards.length > 0}
            <span
                class="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none"
                style="font-size: 84px; line-height: 1; text-shadow: 0 0 8px rgba(0, 0, 0, 0.85), 0 0 16px rgba(0, 0, 0, 0.6);"
            >
                {cards.length}
            </span>
        {/if}
    </button>
{/snippet}

{#if showing}
    <!-- Deliberately NOT click-to-dismiss: unlike the region-scoring aid, this is a
         required decision (the turn can't proceed until a card is taken), so a stray
         click on the backdrop shouldn't strand the player with no piles on screen. -->
    <div
        {@attach trackBoardCentre}
        class="fixed inset-0 z-40 bg-black/55 {boardCenter
            ? ''
            : 'flex items-center justify-center'}"
    >
        <div
            class={boardCenter ? 'absolute' : ''}
            style={boardCenter
                ? `left: clamp(${HALF_ROW_CSS}, ${boardCenter.x}px, calc(100vw - ${HALF_ROW_CSS})); top: ${boardCenter.y}px; transform: translate(-50%, -50%);`
                : ''}
        >
            <!-- Only ever seen before a pile is chosen: the instant one is, PoliticsHand's fan
                 covers the whole screen (see its isOpen) and stays up until a card is taken, so
                 there is no "reopen your pile" state here to word for.
                 w-fit mx-auto so the heading centres over the PILES: this column is positioned
                 from the board's centre point, and a full-width heading centred in it drifts off
                 the row of piles below, which is the widest thing in here. -->
            <div class="w-fit mx-auto text-center text-white text-2xl font-semibold mb-4 drop-shadow">
                Choose a politics deck.
            </div>
            <!-- The session's only error readout lives inside RealBoard, which this
                 overlay covers - so a refused click would explain itself somewhere the
                 player can't see, making a rejected pile and a dead button look exactly
                 alike. Repeat it here for as long as the overlay is up. -->
            {#if gameSession.errorMessage}
                <div
                    class="mb-4 mx-auto max-w-[420px] rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-base"
                >
                    {gameSession.errorMessage}
                </div>
            {/if}
            <div class="flex w-fit mx-auto items-start" style="gap: {PILE_GAP_CSS};">
                {@render pile('A', pileA)}
                {@render pile('B', pileB)}
            </div>
        </div>
    </div>
{/if}
