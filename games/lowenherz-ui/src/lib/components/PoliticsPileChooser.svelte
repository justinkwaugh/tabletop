<script lang="ts">
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    const pileA = $derived(gameSession.gameState.politicsCardPileA)
    const pileB = $derived(gameSession.gameState.politicsCardPileB)

    // Real server state (LookAtPoliticsPile), not local UI state - survives reload/undo. See
    // GameSession.selectedPoliticsPile's own comment for why that matters.
    const chosenPile = $derived(gameSession.selectedPoliticsPile)

    // Card DATA is available client-side the moment a pile exists at all (see pileA/pileB above -
    // the choosing step shows cards[0] face down off this very same source), so the local,
    // optimistic slidingPile can drive the reveal immediately rather than waiting on
    // selectPoliticsPile's round trip. chosenPile only matters for surviving a reload mid-decision
    // (skips straight to the revealed phase, no slide to animate) or an undone TakePoliticsCard
    // (the pile stays open - see GameSession.selectedPoliticsPile).
    let slidingPile: 'A' | 'B' | undefined = $state(undefined)
    let slideDone = $state(false)

    const effectivePile = $derived(slidingPile ?? chosenPile)
    const cards = $derived(effectivePile === 'A' ? pileA : effectivePile === 'B' ? pileB : [])
    const revealed = $derived(slideDone || !!chosenPile)

    const showing = $derived(gameSession.canTakePoliticsCard)

    // Desktop width. On a phone, min() takes over - see the old overlay's own note on this,
    // which this component replaces.
    const CARD_WIDTH = 150
    const CARD_WIDTH_CSS = `min(${CARD_WIDTH}px, 38vw)`
    const PILE_GAP_CSS = 'clamp(0.75rem, 4vw, 2.5rem)'

    // Positioned against the real board frame - measured live, not a static layout slot, so this
    // tracks the board at any zoom/scroll. Unlike the overlay it replaces, there is no backdrop
    // and nothing else on screen is blocked: this sits visually above the board rather than
    // covering it. One fixed spot for the whole component (both phases share it): the slide below
    // is a pure horizontal move within this same band, not a move to some other part of the
    // screen, so nothing needs to jump vertically between phases.
    let boardRect: { left: number; bottom: number; width: number } | undefined = $state(undefined)

    function measure() {
        const rect = document.getElementById('lowenherz-board-frame')?.getBoundingClientRect()
        boardRect = rect ? { left: rect.left, bottom: rect.top - 16, width: rect.width } : undefined
    }

    function trackBoardRect() {
        measure()
        window.addEventListener('resize', measure)
        return () => {
            window.removeEventListener('resize', measure)
            boardRect = undefined
        }
    }

    function canSelectPile(pile: 'A' | 'B'): boolean {
        if (!showing || slidingPile || chosenPile) return false
        return (pile === 'A' ? pileA : pileB).length > 0
    }

    const SLIDE_DURATION = 450 // ms
    const FADE_DURATION = 200 // ms - the unchosen pile going away

    let pileElA: HTMLElement | undefined = $state()
    let pileElB: HTMLElement | undefined = $state()

    // Where the chosen pile's cards fly in from (and a declined one flies back to) - captured
    // from the pile element's own actual on-screen rect right after it finishes sliding, so the
    // deal-out originates from exactly where the pile visually landed rather than some
    // separately-computed point that could drift out of sync with it.
    let dealOrigin: { x: number; y: number } | undefined = $state(undefined)

    async function choosePile(pile: 'A' | 'B') {
        if (!canSelectPile(pile)) return
        const chosenEl = pile === 'A' ? pileElA : pileElB
        const otherEl = pile === 'A' ? pileElB : pileElA
        if (!chosenEl) return

        gameSession.errorMessage = undefined
        // Erases the instructions and the unchosen pile (see the template's {#if !slidingPile}
        // guards) while the chosen one slides - both fire the moment a pile is picked, not after.
        slidingPile = pile

        if (otherEl) gsap.to(otherEl, { opacity: 0, duration: FADE_DURATION / 1000, ease: 'power1.out' })

        // Purely horizontal: the pile is already sitting at the right height (above the board),
        // it only needs to move to this same band's left edge - not up, down, or diagonally.
        const startRect = chosenEl.getBoundingClientRect()
        const dx = (boardRect?.left ?? 12) - startRect.left

        await new Promise<void>((resolve) => {
            gsap.to(chosenEl, {
                x: dx,
                duration: SLIDE_DURATION / 1000,
                ease: 'power2.inOut',
                onComplete: resolve
            })
        })
        // Flips the template to the revealed branch (see `revealed`) - which mounts a fresh
        // "resting pile" element rather than reusing this one (an {#if}/{:else} always tears down
        // one branch and builds the other), so dealOrigin is captured from THAT element's own
        // attachment once it lands, not measured here on an element about to be destroyed.
        slideDone = true

        // Fires after the slide finishes rather than racing it - the terms it names
        // (LookAtPoliticsPile) are a one-way commitment, so there is nothing to visually
        // reconcile if this rejects; errorMessage surfaces that same as everywhere else.
        await gameSession.selectPoliticsPile(pile)
    }

    // Tiled "deal" animation: each card flies in from the pile's landing spot, staggered like a
    // quick riffle deal, with one full spin along the way - the same shape Sol's own deck-click
    // animation uses (fly off the deck, one rotation, land in a row), replicated here with plain
    // GSAP tweens against a measured rect rather than porting GSAP's Flip plugin, to stay
    // consistent with how every other animation in this codebase is built. An attachment rather
    // than an effect, so it plays exactly once per card, right as it mounts (see
    // ANIMATION_PATTERN.md and PoliticsHand's own dealIn, which this mirrors).
    const DEAL_DURATION = 420 // ms
    const DEAL_STAGGER = 60 // ms between each successive card starting its flight

    function dealIn(index: number) {
        return (el: HTMLElement) => {
            const origin = dealOrigin
            if (!origin) return
            const rect = el.getBoundingClientRect()
            const dx = origin.x - (rect.left + rect.width / 2)
            const dy = origin.y - (rect.top + rect.height / 2)

            gsap.set(el, { x: dx, y: dy, scale: 0.3, opacity: 0, rotate: -360 })

            const tl = gsap.timeline({
                delay: (index * DEAL_STAGGER) / 1000,
                onComplete: () => {
                    // Named properties only, not 'all' - clearing the whole inline style would
                    // also wipe the Svelte-set width, collapsing the card (see PoliticsHand's own
                    // note on this exact bug).
                    gsap.set(el, { clearProps: 'x,y,scale,rotate,opacity' })
                }
            })
            tl.to(el, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0)
            tl.to(el, { x: 0, y: 0, scale: 1, rotate: 0, duration: DEAL_DURATION / 1000, ease: 'power2.out' }, 0)

            return () => tl.kill()
        }
    }

    // Set for the whole choreographed sequence below, once a card has been clicked - disables
    // further clicks until it finishes.
    let takingCardId: string | undefined = $state(undefined)
    let cardEls: Record<string, HTMLElement> = {}

    const RETURN_DURATION = 300 // ms - the other cards flying back to the pile
    const RETURN_STAGGER = 35 // ms between each returning card starting its flight
    const DELIVER_DURATION = 420 // ms - the taken card flying away to be delivered
    const DELIVER_DISTANCE = 220 // px - purely horizontal, matches PoliticsHand's own
    // addDeliverFlight and its reasoning: a fixed horizontal offset never leaves this row, so it
    // always finishes fading before it could run into an edge (see that component's note on the
    // overflow-clipping bug this avoids).

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
        tl.to(el, { x: dx, y: dy, scale: 0.3, opacity: 0, duration, ease: 'power2.in' }, position)
    }

    function addDeliverFlight(tl: gsap.core.Timeline, el: HTMLElement | undefined, duration: number, position: number) {
        if (!el) return
        tl.to(el, { x: -DELIVER_DISTANCE, scale: 0.3, opacity: 0, duration, ease: 'power2.in' }, position)
    }

    // Rather than taking the card immediately, plays it out visually first: every OTHER card
    // flies back to the pile, then the chosen one flies on to be delivered - only once that's
    // finished do we actually dispatch TakePoliticsCard. See PoliticsHand's own chooseCard, which
    // this mirrors, for why this is one shared GSAP timeline kept local rather than registered on
    // the AnimationContext.
    async function chooseCard(card: PoliticsCardData) {
        const pile = effectivePile
        if (takingCardId || !pile) return
        takingCardId = card.id

        const tl = gsap.timeline()
        const origin = dealOrigin
        if (origin) {
            const others = cards.filter((c) => c.id !== card.id)
            others.forEach((c, i) => {
                addFlight(tl, cardEls[c.id], origin, RETURN_DURATION / 1000, (i * RETURN_STAGGER) / 1000)
            })
        }
        addDeliverFlight(tl, cardEls[card.id], DELIVER_DURATION / 1000, tl.duration())

        if (tl.duration() > 0) {
            await new Promise<void>((resolve) => tl.eventCallback('onComplete', resolve))
        }

        await gameSession.takePoliticsCard(pile, card.id)
        takingCardId = undefined
    }
</script>

{#snippet pileFace(pileCards: typeof pileA, showCount: boolean)}
    {#if pileCards.length > 0}
        <PoliticsCard card={pileCards[0]} faceDown />
    {:else}
        <div
            class="aspect-[534/832] rounded-md border border-dashed border-white/40 bg-black/70 flex items-center justify-center text-white/60 text-sm"
        >
            empty
        </div>
    {/if}
    {#if showCount && pileCards.length > 0}
        <span
            class="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none"
            style="font-size: 84px; line-height: 1; text-shadow: 0 0 8px rgba(0, 0, 0, 0.85), 0 0 16px rgba(0, 0, 0, 0.6);"
        >
            {pileCards.length}
        </span>
    {/if}
{/snippet}

{#if showing}
    <!-- Fixed, not inside ScalingWrapper's transformed subtree, same as the overlay this replaces
         - but measured against the board frame's live rect and anchored by its BOTTOM edge (see
         boardRect.bottom) so this sits just above the board's top edge at any zoom/scroll, growing
         upward as its content changes height, rather than the frame's top edge growing downward
         into the board. No backdrop: nothing else on screen dims or gets blocked. -->
    <div
        {@attach trackBoardRect}
        class="fixed z-40 pointer-events-none flex flex-col items-start"
        style="left: {boardRect?.left ?? 12}px; bottom: calc(100vh - {boardRect?.bottom ??
            120}px); width: {boardRect?.width ?? 340}px;"
    >
        {#if !revealed}
            <!-- Choosing step: both piles stay mounted throughout the slide (see choosePile) - the
                 unchosen one fades via GSAP rather than being removed, so the DOM node the chosen
                 one is mid-animation on never gets torn down out from under it. -->
            {#if !slidingPile}
                <div
                    class="pointer-events-auto self-center mb-2 rounded-full bg-black/70 px-3 py-1 text-white text-lg font-semibold drop-shadow"
                >
                    Choose a politics pile:
                </div>
            {/if}
            {#if gameSession.errorMessage}
                <div
                    class="pointer-events-auto self-center mb-2 max-w-[420px] rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-base"
                >
                    {gameSession.errorMessage}
                </div>
            {/if}
            <div class="pointer-events-auto self-center flex items-start" style="gap: {PILE_GAP_CSS};">
                <button
                    type="button"
                    disabled={!canSelectPile('A')}
                    bind:this={pileElA}
                    onclick={() => choosePile('A')}
                    style="width: {CARD_WIDTH_CSS};"
                    class="relative rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-transform {canSelectPile(
                        'A'
                    )
                        ? 'cursor-pointer hover:-translate-y-1'
                        : ''}"
                >
                    {@render pileFace(pileA, true)}
                </button>
                <button
                    type="button"
                    disabled={!canSelectPile('B')}
                    bind:this={pileElB}
                    onclick={() => choosePile('B')}
                    style="width: {CARD_WIDTH_CSS};"
                    class="relative rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-transform {canSelectPile(
                        'B'
                    )
                        ? 'cursor-pointer hover:-translate-y-1'
                        : ''}"
                >
                    {@render pileFace(pileB, true)}
                </button>
            </div>
        {:else}
            <!-- Revealed step: a fresh pile element (not the button that just slid - see the
                 note below), inert, sitting at the same left edge it landed on, with its cards
                 fanned out to the right. Its count badge drops off here: unlike the choosing
                 step, where it told you what you couldn't see yet, the count is just as visible
                 in the row itself now. -->
            <div class="pointer-events-auto flex flex-col gap-2">
                <div class="rounded-full bg-black/70 px-3 py-1 text-white text-lg font-semibold drop-shadow w-fit">
                    Click a card to take it.
                </div>
                {#if gameSession.errorMessage}
                    <div
                        class="max-w-[420px] rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-base"
                    >
                        {gameSession.errorMessage}
                    </div>
                {/if}
                <div class="flex flex-wrap items-start gap-3">
                    <!-- A fresh element, not the pile button that just slid in (the {#if}/{:else}
                         above tore that one down) - it lands in the same visual spot regardless,
                         both being "the leftmost item in a row anchored to the board's left edge",
                         so there's nothing to keep continuous here. Its own attachment captures
                         dealOrigin from wherever it actually renders, which is what the cards
                         below (and a declined card's return flight) fly from/to. -->
                    <div
                        {@attach (el) => {
                            const rect = el.getBoundingClientRect()
                            dealOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                        }}
                        style="width: {CARD_WIDTH_CSS};"
                        class="relative opacity-80 pointer-events-none"
                    >
                        {@render pileFace(cards, false)}
                    </div>
                    {#each cards as card, dealIndex (card.id)}
                        <button
                            type="button"
                            bind:this={cardEls[card.id]}
                            {@attach dealIn(dealIndex)}
                            disabled={takingCardId !== undefined}
                            class="cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-150"
                            style="width: {CARD_WIDTH_CSS};"
                            onclick={() => chooseCard(card)}
                        >
                            <PoliticsCard {card} />
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/if}
