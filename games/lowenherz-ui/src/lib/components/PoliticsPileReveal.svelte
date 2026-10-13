<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'
    import CardMagnifier from './CardMagnifier.svelte'
    import { buildSlotRows, responsiveCardWidth } from '$lib/model/politicsCardLayout'
    import { PoliticsPileDealAnimator } from '$lib/animators/politicsPileDealAnimator.svelte.js'
    import { PoliticsPileTakeAnimator } from '$lib/animators/politicsPileTakeAnimator.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'

    const gameSession = getGameSession()

    // Opening a pile (the losing deck fading, the chosen deck sliding to its seat, the cards
    // dealing out) and taking a card are both state-change animators, driven by the committed
    // action - see politicsPileDealAnimator.svelte.ts and politicsPileTakeAnimator.svelte.ts.
    const dealAnimator = new PoliticsPileDealAnimator(gameSession)
    const takeAnimator = new PoliticsPileTakeAnimator(gameSession)

    // Real server state (LookAtPoliticsPile), not local UI state - survives reload/undo. See
    // GameSession.selectedPoliticsPile's own comment for why that matters. Rendered above the
    // board (see GameTable.svelte), right where PoliticsDeckChooser sat before a deck was picked.
    const pile = $derived(gameSession.selectedPoliticsPile)
    const cards = $derived(
        gameSession.myPlayer
            ? (gameSession.gameState.inspectedPoliticsCards(gameSession.myPlayer.id) ?? [])
            : []
    )

    // The row's own live measurement, so a resize while cards are dealt reflows them. Measured
    // with a ResizeObserver in an attachment, and reset when the row leaves, so a new reveal starts
    // from the width the deal measured instead of a stale one: correcting a wrong first guess can
    // move a card into another row's keyed {#each}, which remounts it - a white flash.
    // PoliticsDeckChooser keeps its decks in place until this block is really on screen - see
    // GameSession.politicsRevealShowing.
    function holdPoliticsSlot() {
        gameSession.politicsRevealShowing = true
        return () => {
            gameSession.politicsRevealShowing = false
        }
    }

    let measuredWidth: number = $state(0)

    function measureWidth(el: HTMLElement) {
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            measuredWidth = entry.contentRect.width
        })
        observer.observe(el)
        return () => {
            observer.disconnect()
            measuredWidth = 0
        }
    }

    const rowWidth = $derived(measuredWidth > 0 ? measuredWidth : dealAnimator.rowWidth)

    // Shrinks below CARD_W only once the row is too narrow for a few cards at that size - a
    // phone screen, mainly (see responsiveCardWidth's own comment) - rather than staying a fixed
    // size and just piling up into more, smaller-feeling rows. PoliticsDeckChooser computes this
    // exact same way, off the exact same measured width, so the two stay in visual agreement.
    const cardWidth = $derived(responsiveCardWidth(rowWidth))
    const cardWidthCss = $derived(`${cardWidth}px`)

    // The leftover deck is slot 0 of this same row/wrap split, not a separately-positioned
    // element - PoliticsDeckChooser's own slide target (see that component) is computed the exact
    // same way, treating the deck as the first of cards.length + 1 slots, so the wrapping
    // function places both in agreement automatically, at any card count or row width, instead of
    // PoliticsDeckChooser having to separately calculate "just to the left of the leftmost card"
    // and hope it matches what actually renders here. That hand-rolled version drifted off at
    // higher card counts - a first row sized to fit the CARDS alone centers differently than one
    // that already accounts for the deck sharing it. Shared with the deal animator's own transient
    // layout (buildSlotRows) so both land on the exact same positions.
    const slotRows = $derived(buildSlotRows(cards, rowWidth, cardWidth))

    // Set the moment a card is clicked - disables further clicks until the action resolves.
    let takingCardIndex: number | undefined = $state(undefined)

    // Dispatches immediately; the collapse-and-focus choreography plays off the committed
    // action via takeAnimator, not beforehand (see politicsPileTakeAnimator.svelte.ts).
    async function chooseCard(card: PoliticsCardData, index: number) {
        const takingPile = pile
        if (takingCardIndex !== undefined || gameSession.busy || !takingPile) return
        takingCardIndex = index
        takeAnimator.selectedIndex = index
        try {
            await gameSession.takePoliticsCard(takingPile, card)
        } finally {
            takingCardIndex = undefined
            takeAnimator.selectedIndex = undefined
        }
    }
</script>

<!-- Registered unconditionally (not inside {#if pile} below) so the animator sees every game
     state change regardless of whether this reveal currently has anything to show. -->
<div class="hidden" {@attach attachAnimator(dealAnimator)}></div>
<div class="hidden" {@attach attachAnimator(takeAnimator)}></div>

{#if pile || dealAnimator.dealing}
    <!-- No heading of our own here - StatusMessages says "Choose a politics card." right
         above this once a pile is opened, the same way it handles PoliticsDeckChooser's own
         instruction. Keeping it there means this row's own height never has to agree with
         that component's, which local, per-component headings kept drifting out of sync on. -->
    <div class="px-3 py-2 flex flex-col items-center gap-2" {@attach holdPoliticsSlot}>
        {#if gameSession.errorMessage}
            <div
                class="max-w-full rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-sm"
            >
                {gameSession.errorMessage}
            </div>
        {/if}
        <!-- w-full: without it, this being a flex item of an items-center parent means it
             shrinks to fit ITS OWN children on the cross axis instead of filling the space
             actually available - so its very first measurement (below) came out sized to
             whatever the wrong first guess (see rowSizes) had just rendered, rather than the
             real available width, and every subsequent card - correct row split or not - was
             laid out against that self-fulfilling number. -->
        <div
            class="relative w-full flex flex-col gap-2"
            {@attach measureWidth}
            {@attach (el) => {
                takeAnimator.setRowsEl(el)
                dealAnimator.setRowsEl(el)
                return () => {
                    takeAnimator.setRowsEl(undefined)
                    dealAnimator.setRowsEl(undefined)
                }
            }}
        >
            {#if dealAnimator.dealing}
                {@const dealCardWidthCss = `${dealAnimator.cardWidth}px`}
                {#if dealAnimator.losingDeck}
                    <!-- The deck that was not chosen, where PoliticsDeckChooser drew it. -->
                    <div
                        class="absolute top-0"
                        style="left: {dealAnimator.losingDeck.left}px; width: {dealCardWidthCss};"
                        {@attach (el) => {
                            dealAnimator.setNode('losing-deck', el)
                            return () => dealAnimator.setNode('losing-deck', undefined)
                        }}
                    >
                        {#if dealAnimator.losingDeck.empty}
                            <div
                                class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                            >
                                empty
                            </div>
                        {:else}
                            <PoliticsCard faceDown />
                        {/if}
                    </div>
                {/if}
                <!-- The transient deal: same slot layout the real row below will use, so the
                     handoff at afterAnimations (when `dealing` clears and gameState has just
                     been assigned) lands in the exact same positions with nothing to jump. -->
                {#each dealAnimator.slotRows as row, rowIndex (rowIndex)}
                    <div class="flex items-start justify-center gap-2">
                        {#each row as slot (slot.kind === 'deck' ? 'deck' : String(slot.index))}
                            {#if slot.kind === 'deck'}
                                <div
                                    style="width: {dealCardWidthCss};"
                                    {@attach (el) => {
                                        dealAnimator.setNode('deck', el)
                                        return () => dealAnimator.setNode('deck', undefined)
                                    }}
                                >
                                    <PoliticsCard card={slot.card} faceDown />
                                </div>
                            {:else}
                                <div
                                    style="width: {dealCardWidthCss};"
                                    {@attach (el) => {
                                        dealAnimator.setNode(String(slot.index), el)
                                        return () =>
                                            dealAnimator.setNode(String(slot.index), undefined)
                                    }}
                                >
                                    <PoliticsCard card={slot.card} />
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/each}
            {:else if rowWidth > 0}
                <!-- Gated on having a real measurement rather than rendering immediately with
                     the "everything fits on one row" fallback rowSizes uses before rowWidth is
                     known: slots are keyed within their OWN row's {#each}, so correcting the
                     split after the fact (once the real width comes in) can move one into a
                     different row's block - a different keyed {#each} entirely, which Svelte
                     can't just reposition, so it tears the element down and remounts a fresh one
                     in the new spot. Waiting for a real width means every slot is only ever
                     created once, already in its final row. -->
                {#each slotRows as row, rowIndex (rowIndex)}
                    <div class="flex items-start justify-center gap-2">
                        {#each row as slot (slot.kind === 'deck' ? 'deck' : String(slot.index))}
                            {#if slot.kind === 'deck'}
                                <!-- Always the dashed placeholder once the deal has landed - the
                                     deck's own face-down stand-in only exists during the transient
                                     phase above; per the rulebook exactly one card ever gets taken
                                     from an opened pile, so there's no separate "still has cards
                                     left" state for this slot to distinguish. -->
                                <div
                                    class="aspect-[534/832] rounded-md border border-dashed border-black/25"
                                    style="width: {cardWidthCss};"
                                ></div>
                            {:else}
                                <button
                                    type="button"
                                    disabled={takingCardIndex !== undefined || gameSession.busy}
                                    class="cursor-pointer opacity-90 hover:opacity-100"
                                    style="width: {cardWidthCss};"
                                    onclick={() => chooseCard(slot.card, slot.index)}
                                    {@attach (el) => {
                                        takeAnimator.setNode(String(slot.index), el)
                                        return () =>
                                            takeAnimator.setNode(String(slot.index), undefined)
                                    }}
                                >
                                    <CardMagnifier card={slot.card} />
                                </button>
                            {/if}
                        {/each}
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}
