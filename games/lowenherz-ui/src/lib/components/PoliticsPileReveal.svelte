<script lang="ts">
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'
    import { preloadPoliticsCardFace } from '$lib/model/politicsCardImages'

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

    // Same fixed size PlayerState uses for the cards in a player's own hand.
    const CARD_W = 66
    const CARD_WIDTH_CSS = `${CARD_W}px`
    const CARD_GAP = 8 // px, matches gap-2

    // How many cards actually fit across one row at the row's real measured width - a
    // plain flex-wrap left it up to the browser, which packs each row as full as it can
    // before wrapping (5 cards at 4-per-row read as 4 then 1, not 3 and 2). Falls back to
    // "everything fits" before the real width is known, on the first render.
    let rowWidth: number = $state(0)
    const perRow = $derived(
        rowWidth > 0 ? Math.max(1, Math.floor((rowWidth + CARD_GAP) / (CARD_W + CARD_GAP))) : cards.length
    )

    // Splits the hand into as many rows as it actually needs (per perRow above), sized as
    // evenly as possible rather than greedily - 5 cards needing 2 rows come out 3/2, not
    // 4/1. Each entry keeps the card's index in the full pile, not its row, since that's
    // what dealIn's stagger and the deal-order more generally are keyed to.
    const cardRows = $derived.by(() => {
        const count = cards.length
        if (count === 0) return []
        const rowCount = Math.max(1, Math.ceil(count / perRow))
        const base = Math.floor(count / rowCount)
        const remainder = count % rowCount
        const rows: { card: PoliticsCardData; index: number }[][] = []
        let index = 0
        for (let r = 0; r < rowCount; r++) {
            const size = base + (r < remainder ? 1 : 0)
            rows.push(
                Array.from({ length: size }, () => {
                    const entry = { card: cards[index], index }
                    index++
                    return entry
                })
            )
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

    // Set for the whole choreographed sequence below, once a card has been clicked - disables
    // further clicks until it finishes.
    let takingCardId: string | undefined = $state(undefined)
    let cardEls: Record<string, HTMLElement> = {}
    let rowsEl: HTMLElement | undefined = $state()

    const RETURN_DURATION = 300 // ms - the other cards flying back to the pile

    // Justin's idea: while the rest fly back to the pile, the chosen card gets its own moment -
    // flies to the center of the cards area and enlarges a bit, holds there, then scales down
    // and fades out without moving any further.
    const FOCUS_MOVE_DURATION = 350 // ms - flying to center and enlarging
    const FOCUS_HOLD_DURATION = 500 // ms - the pause once it's there
    const FOCUS_FADE_DURATION = 300 // ms - scaling/fading out in place, after the hold
    const FOCUS_SCALE = 1.17

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
        // the way to 0 with a power1.in ease, rather than the old power2.in-to-0.3 shrink -
        // while still moving toward the target, so these read as collapsing into the middle
        // rather than just sliding off.
        tl.to(el, { x: dx, y: dy, scale: 0, opacity: 0, duration, ease: 'power1.in' }, position)
    }

    function addChosenCardFocus(tl: gsap.core.Timeline, el: HTMLElement | undefined, position: number) {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const areaRect = rowsEl?.getBoundingClientRect()
        const centerX = areaRect ? areaRect.left + areaRect.width / 2 : rect.left + rect.width / 2
        const centerY = areaRect ? areaRect.top + areaRect.height / 2 : rect.top + rect.height / 2
        const dx = centerX - (rect.left + rect.width / 2)
        const dy = centerY - (rect.top + rect.height / 2)

        // Above the other (departing) cards for the whole sequence, since it travels over
        // them on its way to the center.
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
        const origin = gameSession.politicsPileOrigin
        if (origin) {
            const others = cards.filter((c) => c.id !== card.id)
            // All at once, not staggered like the deal-in was: collapsing toward the center
            // reads best as one simultaneous move, not a trailing riffle.
            others.forEach((c) => {
                addFlight(tl, cardEls[c.id], origin, RETURN_DURATION / 1000, 0)
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
             whatever the wrong first guess (see perRow) had just rendered, rather than the
             real available width, and every subsequent card - correct row split or not - was
             laid out against that self-fulfilling number. -->
        <div class="w-full flex flex-col gap-2" bind:this={rowsEl} bind:clientWidth={rowWidth}>
            {#if rowWidth > 0}
                <!-- Gated on having a real measurement rather than rendering immediately with
                     the "everything fits on one row" fallback perRow uses before rowWidth is
                     known: cards are keyed by id within their OWN row's {#each}, so correcting
                     perRow after the fact (once the real width comes in) can move a card into a
                     different row's block - a different keyed {#each} entirely, which Svelte
                     can't just reposition, so it tears the button down and remounts a fresh one
                     in the new spot. That remount is a fresh dealIn from scratch: the card's own
                     white background painted at its final resting spot for a frame before the
                     new attachment ran and hid it again. Waiting the one tick for a real width
                     means cards are only ever created once, already in their final row. -->
                {#each cardRows as row, rowIndex (rowIndex)}
                    <div class="flex items-start justify-center gap-2">
                        {#each row as { card, index } (card.id)}
                            <button
                                type="button"
                                bind:this={cardEls[card.id]}
                                {@attach dealIn(card, index)}
                                disabled={takingCardId !== undefined}
                                class="cursor-pointer opacity-90 hover:opacity-100 {takingCardId
                                    ? ''
                                    : 'transition-opacity duration-150'}"
                                style="width: {CARD_WIDTH_CSS};"
                                onclick={() => chooseCard(card)}
                            >
                                <PoliticsCard {card} />
                            </button>
                        {/each}
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}
