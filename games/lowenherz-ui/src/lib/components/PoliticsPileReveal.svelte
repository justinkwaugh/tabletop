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

    // The cards flying in when a pile first opens, and the leftover deck sliding in alongside
    // them, are a state-change animator now (see politicsPileDealAnimator.svelte.ts) rather than
    // mount-triggered local tweens - so they get a real actionless fallback and don't play at all
    // during silent restoration, the same as every other cinematic in this codebase. Taking a
    // card is the same: dispatched immediately on click, with the collapse-and-focus choreography
    // driven off the committed TakePoliticsCard action (see politicsPileTakeAnimator.svelte.ts)
    // rather than played locally beforehand.
    const dealAnimator = new PoliticsPileDealAnimator(gameSession)
    const takeAnimator = new PoliticsPileTakeAnimator(gameSession)

    // Real server state (LookAtPoliticsPile), not local UI state - survives reload/undo. See
    // GameSession.selectedPoliticsPile's own comment for why that matters. Rendered above the
    // board (see GameTable.svelte), right where PoliticsDeckChooser sat before a deck was picked -
    // politicsPileOrigin (below) is whichever deck card in that chooser was clicked, so the deal
    // reads as that same deck flying open in place.
    const pile = $derived(gameSession.selectedPoliticsPile)
    const cards = $derived(
        pile === 'A'
            ? gameSession.gameState.politicsCardPileA
            : pile === 'B'
              ? gameSession.gameState.politicsCardPileB
              : []
    )

    // measuredWidth is this component's OWN live measurement - the authority once it has one FOR
    // THIS reveal, so a real resize while cards are already dealt (a phone rotating, say) still
    // reflows them, which politicsRowWidth's one-time handoff value on its own never would.
    // measuredWidthOrigin is what makes "for THIS reveal" checkable at all: this component never
    // unmounts (only the {#if pile} content below does), so measuredWidth simply keeps whatever
    // it was last set to across a `pile` transition - and since `pile` is only ever 'A' or
    // 'undefined' or 'B', a stale measurement from a PREVIOUS 'A' reveal would satisfy an
    // `=== pile` check just as well as a fresh one for a new 'A' reveal, without actually being
    // one. politicsPileOrigin is a fresh object every single time PoliticsDeckChooser hands off a
    // new choice (see that component's own choosePile), so comparing THAT by reference is what
    // actually tells two reveals of the same letter apart.
    //
    // Measured with a plain ResizeObserver in an attachment rather than bind:clientWidth for the
    // same reason: bind:clientWidth's first callback only fires a frame or more after mount, by
    // which point cards had already rendered against whatever guess rowSizes uses before a width
    // is known at all - and correcting that guess once the real number arrived could move a card
    // into a different row's own {#each} block, which Svelte can't just reposition, so it tore
    // the button down and remounted a fresh one - the white flash at the cards' own final resting
    // spots. politicsRowWidth is already measured and handed off before this component even
    // mounts, so there's no guess to correct on the very first render; measuredWidth only needs
    // to take over once it's confirmed fresh, which the origin check above establishes without an
    // effect or any other reset-by-hand.
    let measuredWidth: number = $state(0)
    let measuredWidthOrigin: { x: number; y: number } | undefined = $state(undefined)

    function measureWidth(el: HTMLElement) {
        const origin = gameSession.politicsPileOrigin
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            measuredWidth = entry.contentRect.width
            measuredWidthOrigin = origin
        })
        observer.observe(el)
        return () => observer.disconnect()
    }

    const rowWidth = $derived(
        measuredWidthOrigin === gameSession.politicsPileOrigin && measuredWidth > 0
            ? measuredWidth
            : (gameSession.politicsRowWidth ?? 0)
    )

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
    let takingCardId: string | undefined = $state(undefined)

    // Dispatches immediately; the collapse-and-focus choreography plays off the committed
    // action via takeAnimator, not beforehand (see politicsPileTakeAnimator.svelte.ts).
    async function chooseCard(card: PoliticsCardData) {
        const takingPile = pile
        if (takingCardId || !takingPile) return
        takingCardId = card.id
        await gameSession.takePoliticsCard(takingPile, card.id)
        takingCardId = undefined
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
    <div class="px-3 py-2 flex flex-col items-center gap-2">
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
            class="w-full flex flex-col gap-2"
            {@attach measureWidth}
            {@attach (el) => {
                takeAnimator.setRowsEl(el)
                return () => takeAnimator.setRowsEl(undefined)
            }}
        >
            {#if dealAnimator.dealing}
                <!-- The transient deal: same slot layout the real row below will use, so the
                     handoff at afterAnimations (when `dealing` clears and gameState has just
                     been assigned) lands in the exact same positions with nothing to jump. -->
                {#each dealAnimator.slotRows as row, rowIndex (rowIndex)}
                    <div class="flex items-start justify-center gap-2">
                        {#each row as slot (slot.kind === 'deck' ? 'deck' : slot.card.id)}
                            {#if slot.kind === 'deck'}
                                <div
                                    style="width: {cardWidthCss};"
                                    {@attach (el) => {
                                        dealAnimator.setNode('deck', el)
                                        return () => dealAnimator.setNode('deck', undefined)
                                    }}
                                >
                                    <PoliticsCard card={slot.card} faceDown />
                                </div>
                            {:else}
                                <div
                                    style="width: {cardWidthCss};"
                                    {@attach (el) => {
                                        dealAnimator.setNode(slot.card.id, el)
                                        return () => dealAnimator.setNode(slot.card.id, undefined)
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
                        {#each row as slot (slot.kind === 'deck' ? 'deck' : slot.card.id)}
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
                                    disabled={takingCardId !== undefined}
                                    class="cursor-pointer opacity-90 hover:opacity-100"
                                    style="width: {cardWidthCss};"
                                    onclick={() => chooseCard(slot.card)}
                                    {@attach (el) => {
                                        takeAnimator.setNode(slot.card.id, el)
                                        return () => takeAnimator.setNode(slot.card.id, undefined)
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
