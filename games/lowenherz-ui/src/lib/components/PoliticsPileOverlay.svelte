<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    const pileA = $derived(gameSession.gameState.politicsCardPileA)
    const pileB = $derived(gameSession.gameState.politicsCardPileB)

    // Only up while this player is actually the one taking a card. That's the whole
    // TakingPoliticsCard state, not just the instant before a pile is opened, which
    // matters: a player who opens a pile and then hides the fanned view (PoliticsHand)
    // needs something to click to bring it back, and this is now the only place the
    // piles exist. Committing to a pile doesn't dismiss the overlay - taking a card does.
    const showing = $derived(gameSession.canTakePoliticsCard)

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

    // Same rule the piles carried when they lived in the deck column: the rulebook has
    // you look through ONE pile, so opening one is a one-way commitment and the other
    // stops being clickable. The chosen pile stays clickable to re-show its contents.
    // An exhausted pile is never a choice - the engine refuses it outright, so better
    // for it to be visibly inert than to invite a click that can only error.
    function canSelectPile(pile: 'A' | 'B'): boolean {
        if (!gameSession.canTakePoliticsCard) return false
        if ((pile === 'A' ? pileA : pileB).length === 0) return false
        return !gameSession.selectedPoliticsPile || gameSession.selectedPoliticsPile === pile
    }

    // Feeds PoliticsHand's "deal" animation - the cards fly out from wherever the pile
    // actually is on screen, so it needs the real viewport position at click time.
    function onPileClick(pile: 'A' | 'B', event: MouseEvent) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

        if (gameSession.selectedPoliticsPile === pile) {
            gameSession.revealPoliticsHand(origin)
        } else {
            gameSession.selectPoliticsPile(pile, origin)
        }
    }
</script>

{#snippet pile(which: 'A' | 'B', cards: typeof pileA)}
    {@const selectable = canSelectPile(which)}
    {@const chosen = gameSession.selectedPoliticsPile === which}
    {@const dimmed = gameSession.selectedPoliticsPile !== undefined && !chosen}
    <button
        type="button"
        disabled={!selectable}
        onclick={(e) => onPileClick(which, e)}
        class="w-[150px] relative rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-transform {selectable
            ? 'cursor-pointer hover:-translate-y-1'
            : ''} {dimmed ? 'opacity-40 grayscale' : ''}"
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
                ? `left: ${boardCenter.x}px; top: ${boardCenter.y}px; transform: translate(-50%, -50%);`
                : ''}
        >
            <!-- w-fit mx-auto so the heading centres over the PILES: this column is positioned
                 from the board's centre point, and a full-width heading centred in it drifts off
                 the row of piles below, which is the widest thing in here. -->
            <div class="w-fit mx-auto text-center text-white text-2xl font-semibold mb-4 drop-shadow">
                {gameSession.selectedPoliticsPile
                    ? 'Click your pile to look through it again.'
                    : 'Choose a politics pile to look through.'}
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
            <div class="flex w-fit mx-auto items-start gap-10">
                {@render pile('A', pileA)}
                {@render pile('B', pileB)}
            </div>
        </div>
    </div>
{/if}
