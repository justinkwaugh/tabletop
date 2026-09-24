<script lang="ts">
    import { PoliticsCardDeck } from '@tabletop/lowenherz'
    import { gsap } from 'gsap'
    import { onDestroy } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'
    import Numeral from './Numeral.svelte'
    import { preloadPoliticsCardFace, preloadPoliticsCardBack } from '$lib/model/politicsCardImages'
    import { deckSlotCenterX, responsiveCardWidth } from '$lib/model/politicsCardLayout'

    const gameSession = getGameSession()

    // choosePile's own timeline owns cancellation: if this component goes away mid-flight (its
    // {#if choosingPolitics} host in PoliticsSection unmounted, say, because a concurrent server
    // update changed whose turn it is), kill the tween and resolve its awaiter rather than leaving
    // it to finish - or hang - against elements and a session that are no longer there.
    let destroyed = false
    let activeTimeline: gsap.core.Timeline | undefined
    let activeResolve: (() => void) | undefined
    onDestroy(() => {
        destroyed = true
        endExit()
        gameSession.abandonPoliticsPileOrigin()
    })

    // Also the deck row's own teardown (see the attachment in the template): the row can leave
    // while this component stays - opening the history view mid-exit flips choosingPolitics - and
    // a timeline must not outlive its nodes.
    function endExit() {
        activeTimeline?.kill()
        activeTimeline = undefined
        activeResolve?.()
        activeResolve = undefined
    }

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
    const pileACount = $derived(gameSession.gameState.getPoliticsPileCount('A'))
    const pileBCount = $derived(gameSession.gameState.getPoliticsPileCount('B'))

    // This component renders nothing at all once this is false - either nobody needs to choose
    // right now, or a pile has already been picked and PoliticsPileReveal has taken over the same
    // spot above the board.
    const choosingPolitics = $derived(
        gameSession.canTakePoliticsCard && !gameSession.selectedPoliticsPile
    )

    // Warms the browser's image cache for every card in both piles as soon as there's a real
    // choice to make - well before PoliticsPileReveal deals any of them in. This is the best
    // case for that component's own preloadPoliticsCardFace wait (see its dealIn): by the time a
    // card is actually dealt, its face art has usually had as long as the player took to look at
    // the decks and click one to finish decoding, so that wait resolves immediately and the deal
    // plays at full speed with nothing to show white for.
    //
    // A genuine $effect, not derived state, because this isn't clearing local UI state back to
    // some default (the pattern this codebase's Svelte rule reserves $effect against) - it's a
    // real external side effect (kicking off browser image decoding) with no value to compute and
    // no single element's mount to attach it to; it just needs to re-run whenever the pile
    // contents this player could look through change while there's an actual choice on the table.
    $effect(() => {
        if (!choosingPolitics) return
        for (const card of PoliticsCardDeck) {
            preloadPoliticsCardFace(card)
        }
    })

    // Which pile is currently being taken, tagged against the gameState object it was set under
    // rather than kept as a plain value, because `choosingPolitics` alone can't tell a fresh
    // choosing opportunity from a stale one: this component never unmounts (only its {#if
    // choosingPolitics} content does), and choosingPolitics reads true again for BOTH a later
    // round of politics-taking later in the same game AND for Undo landing back on this same
    // step - in either case with nothing to reset takingPileTag by hand, since gameState only
    // changes AFTER the shared timeline finishes (see waitForVisibleTransitionSettled below),
    // well past where an $effect watching choosingPolitics could safely clear anything.
    // Compared by object identity, not actionCount: undoing exactly the pick this attempt was
    // for brings actionCount back to the very value it was captured at, so a count comparison
    // reads that as "still this attempt" and leaves the chooser hidden - gameState itself is a
    // freshly hydrated object on every transition, forward or back, so identity can't collide
    // that way (same trick as PoliticsPileReveal's comparison of the origin handle).
    let takingPileTag: 'A' | 'B' | undefined = $state(undefined)
    let attemptGameState: unknown = $state(undefined)
    const attemptIsCurrent = $derived(attemptGameState === gameSession.gameState)
    const takingPile = $derived(choosingPolitics && attemptIsCurrent ? takingPileTag : undefined)

    // Hidden only once PoliticsPileReveal has something on screen, so the clicked deck holds the
    // slot through the server round trip that opening a pile needs (see
    // GameSession.politicsRevealShowing) - it is already sitting where the reveal draws its own.
    const committed = $derived(takingPile !== undefined && gameSession.politicsRevealShowing)

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
    // away first, then the clicked one slides to wherever PoliticsPileReveal's own row is going
    // to seat it - slot 0, the deck's own permanent spot in that row (see that component's
    // slotRows) - by running the exact same rowSizes split over the exact same (totalCount + 1)
    // slot count, rather than separately sizing a row of just the cards and then trying to back
    // out from its edge how much room the deck itself needs beside it. That separate calculation
    // used to drift at higher card counts: a row centered around the cards alone sits at a
    // different center than one that already has the deck sharing it. Only once the slide lands
    // is the deck element handed over as the deal-in origin, and the pick actually dispatched.
    // Mirrors PoliticsPileReveal's own chooseCard, which plays its exit before dispatching too,
    // for the same reason.
    async function choosePile(pile: 'A' | 'B', event: MouseEvent) {
        if (takingPile) return
        const clickedEl = event.currentTarget as HTMLElement
        const otherEl = pile === 'A' ? pileBEl : pileAEl
        const totalCount = pile === 'A' ? pileACount : pileBCount
        takingPileTag = pile
        attemptGameState = gameSession.gameState

        const areaRect = rowEl?.getBoundingClientRect()
        const clickedRect = clickedEl.getBoundingClientRect()
        const clickedCenterX = clickedRect.left + clickedRect.width / 2
        // Where the slide below is aimed: slot 0, the deck's own permanent spot in the row
        // PoliticsPileReveal is about to lay out.
        const slideTargetCenterX = areaRect
            ? deckSlotCenterX(areaRect.left, areaRect.width, totalCount, cardWidth)
            : undefined

        const tl = gsap.timeline()
        activeTimeline = tl
        if (otherEl) {
            // No explicit position argument - GSAP timelines append sequentially by default,
            // which is exactly "once it's gone" ordering: the slide below only starts once this
            // fade actually finishes.
            tl.to(otherEl, {
                opacity: 0,
                scale: 0.85,
                duration: FADE_OUT_DURATION / 1000,
                ease: 'power1.in'
            })
        }

        if (slideTargetCenterX !== undefined) {
            tl.to(clickedEl, {
                x: slideTargetCenterX - clickedCenterX,
                duration: SLIDE_DURATION / 1000,
                ease: 'power2.inOut'
            })
        }

        if (tl.duration() > 0) {
            await new Promise<void>((resolve) => {
                activeResolve = resolve
                tl.eventCallback('onComplete', resolve)
            })
        }
        activeTimeline = undefined
        activeResolve = undefined
        if (destroyed) return

        // The element rather than its rect: the deck holds this slot until the deal starts, which
        // is when its position is read (see GameSession.politicsPileOrigin).
        gameSession.setPoliticsPileOriginElement(clickedEl)
        gameSession.politicsRowWidth = rowEl?.getBoundingClientRect().width

        // After the exit, not alongside it: LookAtPoliticsPile reveals information, so it is never
        // applied optimistically (see GameSession.requiresServerAuthoritativeProcessing), and
        // overlapping its round trip with the slide let the reveal take the slot mid-slide.
        await gameSession.selectPoliticsPile(pile)

        // selectPoliticsPile's own await settles once the action is applied/sent, but
        // selectedPoliticsPile (real gameState) only updates once the resulting state-change
        // animation cycle finishes - now a real ~380ms+ deal, not the instant no-op it was before
        // PoliticsPileReveal's dealIn became a state-change animator. Checking right away read
        // that legitimate delay as failure essentially every time. waitForVisibleTransitionSettled
        // is the same primitive history navigation uses to wait out exactly this.
        await gameSession.waitForVisibleTransitionSettled()

        // selectPoliticsPile can come back without ever setting selectedPoliticsPile - it
        // returns early (no error) if canTakePoliticsCard/the pile turned out already spoken for
        // by the time this landed, and sets errorMessage rather than throwing if the server
        // itself rejected it. None of that tells this function it didn't land other than
        // selectedPoliticsPile simply not being `pile` afterward - without checking, takingPileTag
        // stayed set forever and choosingPolitics stayed true throughout (never having a reason to
        // change), leaving both decks disabled with no way to retry a choice the player still has
        // to make. The decks are still mounted on this path - the reveal never appeared to hide
        // them - so the exit is undone here; clearProps rather than a list of the properties the
        // tweens above happen to set, so adding one to either can't leave a deck half-faded.
        if (gameSession.selectedPoliticsPile !== pile) {
            const stuck = [clickedEl, otherEl].filter((el) => el?.isConnected)
            if (stuck.length > 0) gsap.set(stuck, { clearProps: 'transform,opacity' })
            gameSession.abandonPoliticsPileOrigin()
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
            class="flex items-center justify-center gap-3"
            bind:this={rowEl}
            bind:clientWidth={rowWidth}
            {@attach () => endExit}
        >
            {#if pileACount > 0}
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
                    <PoliticsCard faceDown />
                    {@render countBadge(pileACount)}
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
            {#if pileBCount > 0}
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
                    <PoliticsCard faceDown />
                    {@render countBadge(pileBCount)}
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
