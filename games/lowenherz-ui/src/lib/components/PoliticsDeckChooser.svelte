<script lang="ts">
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'
    import Numeral from './Numeral.svelte'
    import { preloadPoliticsCardFace, preloadPoliticsCardBack } from '$lib/model/politicsCardImages'
    import { CARD_GAP, rowSizes, rowContentWidth, responsiveCardWidth } from '$lib/model/politicsCardLayout'

    const gameSession = getGameSession()

    // Same card size PoliticsPileReveal deals out, so the deck you're choosing between visually
    // matches what it turns into once you pick one - responsiveCardWidth is what lets both
    // shrink together on a narrow (phone) row instead of staying a fixed size regardless of how
    // little room is actually available; see that function's own comment.
    let rowWidth: number = $state(0)
    const cardWidth = $derived(responsiveCardWidth(rowWidth))
    const cardWidthCss = $derived(`${cardWidth}px`)

    // Gates the deck rendering below (see the template) on the shared face-down art actually
    // being decoded - the same white-flash bug PoliticsPileReveal's own dealIn works around for
    // dealt cards (see its wait on preloadPoliticsCardFace) can happen here too, for the deck
    // backs themselves, the very first time a politics phase comes up in a session and this
    // image hasn't been decoded yet. Kicked off once, unconditionally, rather than inside an
    // effect keyed to choosingPolitics - it's one shared static image, not per-pile data, so
    // there's nothing to react to: it only ever needs to happen once, period.
    let backReady = $state(false)
    preloadPoliticsCardBack().then(() => {
        backReady = true
    })

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

    // Warms the browser's image cache for every card in both piles as soon as there's a real
    // choice to make - well before PoliticsPileReveal deals any of them in. This is the best
    // case for that component's own preloadPoliticsCardFace wait (see its dealIn): by the time a
    // card is actually dealt, its face art has usually had as long as the player took to look at
    // the decks and click one to finish decoding, so that wait resolves immediately and the deal
    // plays at full speed with nothing to show white for.
    $effect(() => {
        if (!choosingPolitics) return
        for (const card of [...pileACards, ...pileBCards]) {
            preloadPoliticsCardFace(card)
        }
    })

    // Set the moment a deck is clicked - disables both decks against further clicks, and keeps
    // this component rendering (and playing its own exit animation) for as long as
    // choosingPolitics stays true, which it does until selectPoliticsPile below actually lands.
    let takingPile: 'A' | 'B' | undefined = $state(undefined)

    // Undoing the pick brings choosingPolitics back to true without this component ever having
    // unmounted (only its {#if choosingPolitics} content did) - takingPile is declared up here at
    // the component level, so it survived that round trip untouched, still pointing at the pile
    // that got undone. Every click then hit choosePile's own `if (takingPile) return` guard and
    // did nothing at all. Resetting whenever choosing becomes possible again (not on every
    // render - this only reads choosingPolitics, so it only reruns when that value flips) covers
    // both a fresh choice and a return to one via Undo.
    $effect(() => {
        if (choosingPolitics) takingPile = undefined
    })

    // Whichever element is actually occupying each slot right now - the deck button, or the
    // empty/dashed placeholder if that pile's already spent. Bound from both branches of each
    // {#if} below, so the fade-the-loser step (see choosePile) has something to fade regardless
    // of which one is currently there.
    let pileAEl: HTMLElement | undefined = $state()
    let pileBEl: HTMLElement | undefined = $state()
    let rowEl: HTMLElement | undefined = $state()

    const FADE_OUT_DURATION = 220 // ms - the unclicked deck fading away
    const SLIDE_DURATION = 380 // ms - the clicked deck sliding beside the dealt row

    // Plays the deck-choosing exit before actually committing to a pile: the OTHER deck fades
    // away first, then the clicked one slides to just left of wherever the leftmost dealt card is
    // actually going to land - not just the row's own left edge, which (with a row centered via
    // justify-center) could leave a gap between the deck and the row it's supposedly dealing
    // into. rowSizes/rowContentWidth are the exact same split PoliticsPileReveal's own cardRows
    // will use for this same pile once it takes over, so the two agree on where that card ends
    // up. Only once the slide lands does the deck's own final position become the deal-in origin
    // (PoliticsPileReveal keeps its own placeholder there - see that component's deckEl - so the
    // handoff is seamless), and the pick is actually dispatched. Mirrors PoliticsPileReveal's own
    // chooseCard, which plays its exit before dispatching too, for the same reason.
    async function choosePile(pile: 'A' | 'B', event: MouseEvent) {
        if (takingPile) return
        const clickedEl = event.currentTarget as HTMLElement
        const otherEl = pile === 'A' ? pileBEl : pileAEl
        const totalCount = (pile === 'A' ? pileACards : pileBCards).length
        takingPile = pile

        const tl = gsap.timeline()
        if (otherEl) {
            // No explicit position argument - GSAP timelines append sequentially by default,
            // which is exactly "once it's gone" ordering: the slide below only starts once this
            // fade actually finishes.
            tl.to(otherEl, { opacity: 0, scale: 0.85, duration: FADE_OUT_DURATION / 1000, ease: 'power1.in' })
        }

        const areaRect = rowEl?.getBoundingClientRect()
        if (areaRect) {
            const firstRowSize = rowSizes(totalCount, areaRect.width, cardWidth)[0] ?? 0
            const leftmostCardLeft =
                areaRect.left + (areaRect.width - rowContentWidth(firstRowSize, cardWidth)) / 2
            const targetCenterX = leftmostCardLeft - CARD_GAP - cardWidth / 2

            const clickedRect = clickedEl.getBoundingClientRect()
            const dx = targetCenterX - (clickedRect.left + clickedRect.width / 2)
            tl.to(clickedEl, { x: dx, duration: SLIDE_DURATION / 1000, ease: 'power2.inOut' })
        }

        if (tl.duration() > 0) {
            await new Promise<void>((resolve) => tl.eventCallback('onComplete', resolve))
        }

        const finalRect = clickedEl.getBoundingClientRect()
        gameSession.politicsPileOrigin = {
            x: finalRect.left + finalRect.width / 2,
            y: finalRect.top + finalRect.height / 2
        }
        // Handed off so PoliticsPileReveal can use it immediately instead of waiting on its own
        // bind:clientWidth - see that field's own comment on why. The row itself doesn't resize
        // during the animation above (only the deck buttons inside it moved), so measuring again
        // here is just for a fresh, guaranteed-current rect rather than relying on the one from
        // before the fade/slide ran.
        gameSession.politicsRowWidth = rowEl?.getBoundingClientRect().width
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

{#if choosingPolitics && backReady}
    <!-- No separate instructions here - StatusMessages already says "Choose one of the politics
         decks." right above this. -->
    <div class="px-3 py-2">
        <!-- The inner, unpadded row is what's measured (see rowEl below) - matching
             PoliticsPileReveal's own two-level structure (padded outer wrapper, unpadded inner
             row) exactly, so choosePile's own slide-target math lands in the same viewport
             coordinate space that component's row will actually use, not offset from it by this
             wrapper's own padding. -->
        <div class="flex items-center justify-center gap-3" bind:this={rowEl} bind:clientWidth={rowWidth}>
            {#if pileACards.length > 0}
                <button
                    type="button"
                    bind:this={pileAEl}
                    disabled={takingPile !== undefined}
                    onclick={(e) => choosePile('A', e)}
                    class="relative cursor-pointer opacity-90 hover:opacity-100 {takingPile
                        ? ''
                        : 'transition-opacity duration-150'}"
                    style="width: {cardWidthCss};"
                >
                    <PoliticsCard card={pileACards[0]} faceDown />
                    {@render countBadge(pileACards.length)}
                </button>
            {:else}
                <div
                    bind:this={pileAEl}
                    class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                    style="width: {cardWidthCss};"
                >
                    empty
                </div>
            {/if}
            {#if pileBCards.length > 0}
                <button
                    type="button"
                    bind:this={pileBEl}
                    disabled={takingPile !== undefined}
                    onclick={(e) => choosePile('B', e)}
                    class="relative cursor-pointer opacity-90 hover:opacity-100 {takingPile
                        ? ''
                        : 'transition-opacity duration-150'}"
                    style="width: {cardWidthCss};"
                >
                    <PoliticsCard card={pileBCards[0]} faceDown />
                    {@render countBadge(pileBCards.length)}
                </button>
            {:else}
                <div
                    bind:this={pileBEl}
                    class="aspect-[534/832] rounded-md border border-dashed border-black/25 flex items-center justify-center text-black/40 text-xs"
                    style="width: {cardWidthCss};"
                >
                    empty
                </div>
            {/if}
        </div>
    </div>
{/if}
