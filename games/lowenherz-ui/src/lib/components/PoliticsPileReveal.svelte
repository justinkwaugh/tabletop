<script lang="ts">
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'
    import { preloadPoliticsCardFace } from '$lib/model/politicsCardImages'
    import { rowSizes, responsiveCardWidth } from '$lib/model/politicsCardLayout'

    const gameSession = getGameSession()

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

    // How many cards have actually finished dealing out - drives the leftover "deck" placeholder
    // (see the slotRows/template below): it fades away once dealtCount reaches every card in the
    // pile, the last card's own arrival being what "empties" it. Reset whenever a NEW pile is
    // chosen - not on every render while the same one is still dealing - since this only reads
    // `pile`, which only changes value on an actual new selection.
    let dealtCount = $state(0)
    $effect(() => {
        if (pile) dealtCount = 0
    })

    // measuredWidth is this component's OWN fallback measurement, for the one case
    // politicsRowWidth can't cover: a page reload (or similar) landing mid-reveal, with no
    // PoliticsDeckChooser having run yet this session to have set it. Normally, though,
    // politicsRowWidth wins outright - see its own comment on GameSession for why relying on
    // bind:clientWidth here caused a real bug: it's ResizeObserver-backed, so its first callback
    // only fires a frame or more after mount, by which point cards had already rendered against
    // whatever guess rowSizes uses before a width is known at all - and correcting that guess
    // once the real number arrived could move a card into a different row's own {#each} block,
    // which Svelte can't just reposition, so it tore the button down and remounted a fresh one -
    // the white flash at the cards' own final resting spots. politicsRowWidth is already measured
    // and handed off before this component even mounts, so there's no guess to correct.
    let measuredWidth: number = $state(0)
    const rowWidth = $derived(gameSession.politicsRowWidth ?? measuredWidth)

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
    // that already accounts for the deck sharing it.
    type Slot = { kind: 'deck' } | { kind: 'card'; card: PoliticsCardData; index: number }

    // Splits (cards.length + 1) slots into as many rows as they actually need, sized as evenly as
    // possible rather than greedily - see politicsCardLayout's own rowSizes for the split itself.
    // Each card slot keeps its index in the full pile, not its row, since that's what dealIn's
    // stagger and the deal-order more generally are keyed to.
    const slotRows = $derived.by(() => {
        const rows: Slot[][] = []
        let cardIndex = 0
        let slotsPlaced = 0
        for (const size of rowSizes(cards.length + 1, rowWidth, cardWidth)) {
            const row: Slot[] = []
            for (let i = 0; i < size; i++) {
                if (slotsPlaced === 0) {
                    row.push({ kind: 'deck' })
                } else {
                    row.push({ kind: 'card', card: cards[cardIndex], index: cardIndex })
                    cardIndex++
                }
                slotsPlaced++
            }
            rows.push(row)
        }
        return rows
    })

    // Tiled "deal" animation: each card slides in from the pile's origin (the count pill that
    // was clicked - see SummaryStrip.choosePile), staggered like a quick riffle deal - the same
    // shape Sol uses when you inspect its card deck (a plain slide, no spin). Plain GSAP tweens
    // against a measured rect rather than porting GSAP's Flip plugin, to stay consistent with how
    // every other animation in this codebase is built. An attachment rather than an effect, so it
    // plays exactly once per card, right as it mounts (see ANIMATION_PATTERN.md and PoliticsHand's
    // own dealIn, which this mirrors).
    const DEAL_DURATION = 380 // ms
    const DEAL_STAGGER = 45 // ms between each successive card starting its flight

    function dealIn(card: PoliticsCardData, index: number) {
        return (el: HTMLElement) => {
            const origin = gameSession.politicsPileOrigin
            if (!origin) return
            const rect = el.getBoundingClientRect()
            const dx = origin.x - (rect.left + rect.width / 2)
            const dy = origin.y - (rect.top + rect.height / 2)

            // Hidden immediately, before anything below - PoliticsDeckChooser already warms
            // every card's face art while the player is still choosing a deck (see its own
            // comment), but that's a best effort, not a guarantee. Without waiting on the real
            // decode here too, a card whose specific value/type had never been shown face-up
            // yet (network hiccup, or dealt fast enough after choosing that the warm-up hadn't
            // finished) painted its own white background for whatever was left of the tween
            // once the image finally did decode - "resizing" into a blank card instead of
            // itself.
            gsap.set(el, { opacity: 0 })
            let cancelled = false
            let tl: gsap.core.Timeline | undefined

            preloadPoliticsCardFace(card).then(() => {
                if (cancelled) return
                gsap.set(el, { x: dx, y: dy, scale: 0.3, opacity: 0 })

                tl = gsap.timeline({
                    delay: (index * DEAL_STAGGER) / 1000,
                    onComplete: () => {
                        // Named properties only, not 'all' - clearing the whole inline style
                        // would also wipe the Svelte-set width, collapsing the card (see
                        // PoliticsHand's own note on this exact bug).
                        gsap.set(el, { clearProps: 'x,y,scale,opacity' })
                        // The last card's own arrival is what empties the deck (see deckEl) -
                        // this counts every card's landing, in whatever order their staggered
                        // flights actually finish in.
                        dealtCount++
                    }
                })
                tl.to(el, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0)
                tl.to(el, { x: 0, y: 0, scale: 1, duration: DEAL_DURATION / 1000, ease: 'power2.out' }, 0)
            })

            // cancelled guards the case where decode is still pending when this card is torn
            // down (nothing to kill yet - the .then() above simply no-ops when it does resolve);
            // tl?.kill() covers the case where it's already animating.
            return () => {
                cancelled = true
                tl?.kill()
            }
        }
    }

    // The leftover "deck" the cards above are dealt out of - a plain face-down card standing in
    // for it, occupying slot 0 of the row (see slotRows above) rather than being positioned
    // separately, so it picks up exactly where PoliticsDeckChooser's own exit animation left the
    // chosen deck sitting without either component having to calculate that position by hand.
    // Stays in the flex flow even once faded (see the effect below), rather than being removed -
    // that's what keeps every card after it from shifting once the deck disappears. Faded away
    // once dealtCount reaches every card in the pile - the last card's own arrival is what
    // "empties" it, same idea as PoliticsDeckChooser fading the OTHER deck, so a plain GSAP tween
    // rather than a Svelte transition keeps that consistent.
    let deckEl: HTMLElement | undefined = $state()
    $effect(() => {
        if (cards.length > 0 && dealtCount >= cards.length && deckEl) {
            gsap.to(deckEl, { opacity: 0, scale: 0.8, duration: 0.25, ease: 'power1.in' })
        }
    })

    // Set for the whole choreographed sequence below, once a card has been clicked - disables
    // further clicks until it finishes.
    let takingCardId: string | undefined = $state(undefined)
    let cardEls: Record<string, HTMLElement> = {}
    let rowsEl: HTMLElement | undefined = $state()

    const RETURN_DURATION = 300 // ms - the other cards collapsing under the chosen one

    // Justin's idea: while the rest collapse away, the chosen card gets its own moment - flies
    // to the center of the cards area and enlarges a bit, holds there, then scales down and
    // fades out without moving any further.
    const FOCUS_MOVE_DURATION = 350 // ms - flying to center and enlarging
    const FOCUS_HOLD_DURATION = 500 // ms - the pause once it's there
    const FOCUS_FADE_DURATION = 300 // ms - scaling/fading out in place, after the hold
    const FOCUS_SCALE = 1.17

    // Where the chosen card ends up, and now also where the others collapse to (see chooseCard) -
    // the middle of the cards area itself, not any one card's own rect, so both moves agree on
    // the same point regardless of which row or column either card started in.
    function getAreaCenter(): { x: number; y: number } | undefined {
        const areaRect = rowsEl?.getBoundingClientRect()
        if (!areaRect) return undefined
        return { x: areaRect.left + areaRect.width / 2, y: areaRect.top + areaRect.height / 2 }
    }

    function addFlight(
        tl: gsap.core.Timeline,
        el: HTMLElement | undefined,
        target: { x: number; y: number },
        duration: number,
        position: number
    ) {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const dx = target.x - (rect.left + rect.width / 2)
        const dy = target.y - (rect.top + rect.height / 2)
        // Same fade curve as the chosen card's own fade-out (addChosenCardFocus) - scaling all
        // the way to 0 with a power1.in ease, rather than the old power2.in-to-0.3 shrink - while
        // still moving toward the target, so these read as collapsing under the chosen card
        // rather than just sliding off.
        tl.to(el, { x: dx, y: dy, scale: 0, opacity: 0, duration, ease: 'power1.in' }, position)
    }

    function addChosenCardFocus(tl: gsap.core.Timeline, el: HTMLElement | undefined, position: number) {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const center = getAreaCenter() ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        const dx = center.x - (rect.left + rect.width / 2)
        const dy = center.y - (rect.top + rect.height / 2)

        // Above the other (departing) cards for the whole sequence, since it travels over
        // (and the others end up sliding under) it on the way to the center.
        gsap.set(el, { zIndex: 10 })
        tl.to(el, { x: dx, y: dy, scale: FOCUS_SCALE, duration: FOCUS_MOVE_DURATION / 1000, ease: 'power2.out' }, position)
        // The hold is just empty timeline space - nothing to tween, so nothing is added for it;
        // the fade-out below simply starts later.
        tl.to(
            el,
            { scale: 0, opacity: 0, duration: FOCUS_FADE_DURATION / 1000, ease: 'power1.in' },
            position + (FOCUS_MOVE_DURATION + FOCUS_HOLD_DURATION) / 1000
        )
    }

    // Rather than taking the card immediately, plays it out visually first: every OTHER card
    // flies back to the pile while the chosen one gets its own center-stage moment (see
    // addChosenCardFocus) - only once that's finished do we actually dispatch TakePoliticsCard.
    // See PoliticsHand's own chooseCard, which this mirrors, for why this is one shared GSAP
    // timeline kept local rather than registered on the AnimationContext.
    async function chooseCard(card: PoliticsCardData) {
        const takingPile = pile
        if (takingCardId || !takingPile) return
        takingCardId = card.id

        const tl = gsap.timeline()
        const center = getAreaCenter()
        if (center) {
            const others = cards.filter((c) => c.id !== card.id)
            // All at once, not staggered like the deal-in was: collapsing under the chosen card
            // reads best as one simultaneous move, not a trailing riffle. Same target point
            // addChosenCardFocus sends the chosen card to, so the others end up sliding under it
            // rather than off toward the leftover deck to the side.
            others.forEach((c) => {
                addFlight(tl, cardEls[c.id], center, RETURN_DURATION / 1000, 0)
            })
        }
        addChosenCardFocus(tl, cardEls[card.id], 0)

        if (tl.duration() > 0) {
            await new Promise<void>((resolve) => tl.eventCallback('onComplete', resolve))
        }

        await gameSession.takePoliticsCard(takingPile, card.id)
        takingCardId = undefined
    }
</script>

{#if pile}
    <div class="px-3 py-2 flex flex-col items-center gap-2">
        <div class="text-black text-base font-semibold text-center">Choose a card to take it.</div>
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
        <div class="w-full flex flex-col gap-2" bind:this={rowsEl} bind:clientWidth={measuredWidth}>
            {#if rowWidth > 0}
                <!-- Gated on having a real measurement rather than rendering immediately with
                     the "everything fits on one row" fallback rowSizes uses before rowWidth is
                     known: slots are keyed within their OWN row's {#each}, so correcting the
                     split after the fact (once the real width comes in) can move one into a
                     different row's block - a different keyed {#each} entirely, which Svelte
                     can't just reposition, so it tears the element down and remounts a fresh one
                     in the new spot. That remount is a fresh dealIn from scratch: a card's own
                     white background painted at its final resting spot for a frame before the
                     new attachment ran and hid it again. Waiting the one tick for a real width
                     means every slot is only ever created once, already in its final row. -->
                {#each slotRows as row, rowIndex (rowIndex)}
                    <div class="flex items-start justify-center gap-2">
                        {#each row as slot (slot.kind === 'deck' ? 'deck' : slot.card.id)}
                            {#if slot.kind === 'deck'}
                                <div style="width: {cardWidthCss};" bind:this={deckEl}>
                                    <PoliticsCard card={cards[0]} faceDown />
                                </div>
                            {:else}
                                <button
                                    type="button"
                                    bind:this={cardEls[slot.card.id]}
                                    {@attach dealIn(slot.card, slot.index)}
                                    disabled={takingCardId !== undefined}
                                    class="cursor-pointer opacity-90 hover:opacity-100"
                                    style="width: {cardWidthCss};"
                                    onclick={() => chooseCard(slot.card)}
                                >
                                    <PoliticsCard card={slot.card} />
                                </button>
                            {/if}
                        {/each}
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}
