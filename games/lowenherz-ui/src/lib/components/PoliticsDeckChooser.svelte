<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'
    import Numeral from './Numeral.svelte'

    const gameSession = getGameSession()

    // Same fixed card size PoliticsPileReveal deals out, so the deck you're choosing between
    // visually matches what it turns into once you pick one.
    const CARD_W = 66
    const CARD_WIDTH_CSS = `${CARD_W}px`

    // The actual pile contents - already on the client (see PoliticsPileReveal's own comment on
    // this), just never shown face-up until a pile is taken. Only the first card of each pile is
    // ever read here, and only for its id (PoliticsCard ignores a face-down card's own content) -
    // this is a deck back, not a peek at what's in it.
    const pileACards = $derived(gameSession.gameState.politicsCardPileA)
    const pileBCards = $derived(gameSession.gameState.politicsCardPileB)

    // This component renders nothing at all once this is false - either nobody needs to choose
    // right now, or a pile has already been picked and PoliticsPileReveal has taken over the same
    // spot above the board.
    const choosingPolitics = $derived(gameSession.canTakePoliticsCard && !gameSession.selectedPoliticsPile)

    // Feeds PoliticsPileReveal's deal-in animation - the cards fly out from wherever this deck
    // actually is on screen, so it needs the real viewport position at click time.
    function choosePile(pile: 'A' | 'B', event: MouseEvent) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        gameSession.politicsPileOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        gameSession.selectPoliticsPile(pile)
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

{#if choosingPolitics}
    <!-- No separate instructions here - StatusMessages already says "Click one of the politics
         decks." right above this. -->
    <div class="px-3 py-2 flex items-center justify-center gap-3">
        {#if pileACards.length > 0}
            <button
                type="button"
                onclick={(e) => choosePile('A', e)}
                class="relative cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-150"
                style="width: {CARD_WIDTH_CSS};"
            >
                <PoliticsCard card={pileACards[0]} faceDown />
                {@render countBadge(pileACards.length)}
            </button>
        {:else}
            <div
                class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                style="width: {CARD_WIDTH_CSS};"
            >
                empty
            </div>
        {/if}
        {#if pileBCards.length > 0}
            <button
                type="button"
                onclick={(e) => choosePile('B', e)}
                class="relative cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-150"
                style="width: {CARD_WIDTH_CSS};"
            >
                <PoliticsCard card={pileBCards[0]} faceDown />
                {@render countBadge(pileBCards.length)}
            </button>
        {:else}
            <div
                class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                style="width: {CARD_WIDTH_CSS};"
            >
                empty
            </div>
        {/if}
    </div>
{/if}
