<script lang="ts">
    import { PoliticsCardDeck } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'
    import DeckShade from './DeckShade.svelte'
    import Numeral from './Numeral.svelte'
    import { preloadPoliticsCardFace, preloadPoliticsCardBack } from '$lib/model/politicsCardImages'
    import { CHOOSER_DECK_GAP, responsiveCardWidth } from '$lib/model/politicsCardLayout'

    const gameSession = getGameSession()

    // Same card size PoliticsPileReveal deals out, so the deck you're choosing between visually
    // matches what it turns into once you pick one.
    let rowWidth: number = $state(0)
    const cardWidth = $derived(responsiveCardWidth(rowWidth))
    const cardWidthCss = $derived(`${cardWidth}px`)

    // Gates the deck rendering below on the shared face-down art being decoded, so the decks do
    // not flash white the first time a politics phase comes up. One shared static image, so it is
    // started once.
    let backReady = $state(false)
    preloadPoliticsCardBack().then(() => {
        backReady = true
    })

    // Counts only - the decks are drawn face-down.
    const pileACount = $derived(gameSession.gameState.getPoliticsPileCount('A'))
    const pileBCount = $derived(gameSession.gameState.getPoliticsPileCount('B'))

    // Renders nothing once false - nobody needs to choose right now, or a pile has been picked
    // and PoliticsPileReveal has taken over the same spot above the board.
    const choosingPolitics = $derived(
        gameSession.canTakePoliticsCard && !gameSession.selectedPoliticsPile
    )

    // Warms the image cache for every face while the decks are on screen, so the deal rarely has
    // to wait on decoding by the time a pile is picked.
    function preloadPoliticsCardFaces() {
        for (const card of PoliticsCardDeck) {
            preloadPoliticsCardFace(card)
        }
    }

    // Which pile is being opened, tagged with the gameState it was picked under: choosingPolitics
    // reads true again both for a later politics turn and for Undo landing back on this step, and
    // gameState is a fresh object on every transition, so identity tells a stale pick apart.
    let takingPileTag: 'A' | 'B' | undefined = $state(undefined)
    let attemptGameState: unknown = $state(undefined)
    const attemptIsCurrent = $derived(attemptGameState === gameSession.gameState)
    const takingPile = $derived(choosingPolitics && attemptIsCurrent ? takingPileTag : undefined)

    // The decks hold the slot through the host round trip that opening a pile needs, and leave
    // once PoliticsPileReveal is on screen; the deal animator draws them from then on.
    const committed = $derived(takingPile !== undefined && gameSession.politicsRevealShowing)

    // Dispatched on click. The losing deck's fade and the chosen deck's slide belong to the
    // committed LookAtPoliticsPile, so PoliticsPileDealAnimator plays them.
    async function choosePile(pile: 'A' | 'B') {
        if (takingPile) return
        takingPileTag = pile
        attemptGameState = gameSession.gameState

        await gameSession.selectPoliticsPile(pile)
        await gameSession.waitForVisibleTransitionSettled()

        // selectPoliticsPile returns without opening the pile when the choice is no longer
        // available or the host rejects it; re-enable the decks so the player can choose again.
        if (gameSession.selectedPoliticsPile !== pile) {
            takingPileTag = undefined
        }
    }
</script>

{#snippet countBadge(count: number)}
    <!-- The pile's own remaining-card count, big and white across the whole face - same
         treatment PoliticsPileOverlay used to give it before that component went away, just
         scaled down to this smaller card (84px was sized for a 150px-wide card; 66/150 of that
         is ~37px). -->
    <span
        class="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none"
        style="font-size: 37px; line-height: 1; text-shadow: 0 0 4px rgba(0, 0, 0, 0.85), 0 0 7px rgba(0, 0, 0, 0.6);"
    >
        <Numeral value={count} />
    </span>
{/snippet}

{#if choosingPolitics && backReady && !committed}
    <!-- No heading here either - StatusMessages carries both this phase's instruction and
         PoliticsPileReveal's, so neither component needs to reserve space to agree with the
         other's layout. -->
    <div class="px-3 py-2">
        <div
            class="flex items-center justify-center"
            style="gap: {CHOOSER_DECK_GAP}px;"
            bind:clientWidth={rowWidth}
            {@attach preloadPoliticsCardFaces}
        >
            {#if pileACount > 0}
                <button
                    type="button"
                    disabled={takingPile !== undefined}
                    onclick={() => choosePile('A')}
                    class="relative cursor-pointer opacity-90 hover:opacity-100 {takingPile
                        ? ''
                        : 'transition-opacity duration-150'}"
                    style="width: {cardWidthCss};"
                >
                    <DeckShade deck="A" />
                    <PoliticsCard faceDown />
                    {@render countBadge(pileACount)}
                </button>
            {:else}
                <div
                    class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                    style="width: {cardWidthCss};"
                >
                    empty
                </div>
            {/if}
            {#if pileBCount > 0}
                <button
                    type="button"
                    disabled={takingPile !== undefined}
                    onclick={() => choosePile('B')}
                    class="relative cursor-pointer opacity-90 hover:opacity-100 {takingPile
                        ? ''
                        : 'transition-opacity duration-150'}"
                    style="width: {cardWidthCss};"
                >
                    <DeckShade deck="B" />
                    <PoliticsCard faceDown />
                    {@render countBadge(pileBCount)}
                </button>
            {:else}
                <div
                    class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                    style="width: {cardWidthCss};"
                >
                    empty
                </div>
            {/if}
        </div>
    </div>
{/if}
