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

    // Same fixed size PlayerState uses for the cards in a player's own hand - smaller than this
    // component used to render its piles/cards at, and, being real layout (see the wrapping
    // <div> below, and GameTable.svelte's placement of this component), a known fixed size here
    // is what lets the row above the board reserve a known, stable height for itself rather than
    // resizing as vw-relative cards would.
    const CARD_W = 66
    const CARD_H = 103
    const CARD_WIDTH_CSS = `${CARD_W}px`
    const PILE_GAP = 12 // px, between the two piles in the choosing step

    function canSelectPile(pile: 'A' | 'B'): boolean {
        if (!showing || slidingPile || chosenPile) return false
        return (pile === 'A' ? pileA : pileB).length > 0
    }

    const SLIDE_DURATION = 450 // ms
    const FADE_DURATION = 200 // ms - the unchosen pile going away

    let rootEl: HTMLElement | undefined = $state()
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
        if (!chosenEl || !rootEl) return

        gameSession.errorMessage = undefined
        // Erases the instructions and the unchosen pile (see the template's {#if !slidingPile}
        // guards) while the chosen one slides - both fire the moment a pile is picked, not after.
        slidingPile = pile

        if (otherEl) gsap.to(otherEl, { opacity: 0, duration: FADE_DURATION / 1000, ease: 'power1.out' })

        // Purely horizontal: the pile is already sitting at the right height (this component's
        // own row, above the board), it only needs to move to that row's own left edge.
        const rootRect = rootEl.getBoundingClientRect()
        const startRect = chosenEl.getBoundingClientRect()
        const dx = rootRect.left - startRect.left

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
            class="aspect-[534/832] rounded-md border border-dashed border-black/30 flex items-center justify-center text-black/40 text-[10px]"
        >
            empty
        </div>
    {/if}
    {#if showCount && pileCards.length > 0}
        <span
            class="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none"
            style="font-size: 36px; line-height: 1; text-shadow: 0 0 6px rgba(0, 0, 0, 0.85), 0 0 10px rgba(0, 0, 0, 0.6);"
        >
            {pileCards.length}
        </span>
    {/if}
{/snippet}

{#if showing}
    <!-- Real layout, not a floating overlay: this sits above ScalingWrapper's board in
         GameTable.svelte's own shrink-0 column, so it reserves actual height and pushes the
         board down while it's up, rather than floating over whatever's there. No backdrop
         either way: nothing else on screen dims or gets blocked. -->
    <div bind:this={rootEl} class="flex flex-col items-center py-2" style="min-height: {CARD_H + 40}px;">
        {#if !revealed}
            <!-- Choosing step: both piles stay mounted throughout the slide (see choosePile) - the
                 unchosen one fades via GSAP rather than being removed, so the DOM node the chosen
                 one is mid-animation on never gets torn down out from under it. -->
            {#if !slidingPile}
                <div class="mb-2 text-black text-lg font-semibold">Choose a politics pile:</div>
            {/if}
            {#if gameSession.errorMessage}
                <div
                    class="mb-2 max-w-[420px] rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-sm"
                >
                    {gameSession.errorMessage}
                </div>
            {/if}
            <div class="flex items-start" style="gap: {PILE_GAP}px;">
                <button
                    type="button"
                    disabled={!canSelectPile('A')}
                    bind:this={pileElA}
                    onclick={() => choosePile('A')}
                    style="width: {CARD_WIDTH_CSS};"
                    class="relative rounded-md shadow-[0_6px_16px_rgba(0,0,0,0.4)] transition-transform {canSelectPile(
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
                    class="relative rounded-md shadow-[0_6px_16px_rgba(0,0,0,0.4)] transition-transform {canSelectPile(
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
                 note below), inert, sitting at this row's own left edge, with its cards fanned
                 out to the right. Its count badge drops off here: unlike the choosing step,
                 where it told you what you couldn't see yet, the count is just as visible in
                 the row itself now. -->
            <div class="w-full flex flex-col gap-2">
                <div class="text-black text-lg font-semibold w-fit">Click a card to take it.</div>
                {#if gameSession.errorMessage}
                    <div
                        class="max-w-[420px] rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-sm"
                    >
                        {gameSession.errorMessage}
                    </div>
                {/if}
                <div class="flex flex-wrap items-start gap-2">
                    <!-- A fresh element, not the pile button that just slid in (the {#if}/{:else}
                         above tore that one down) - it lands in the same visual spot regardless,
                         both being "the leftmost item in this row", so there's nothing to keep
                         continuous here. Its own attachment captures dealOrigin from wherever it
                         actually renders, which is what the cards below (and a declined card's
                         return flight) fly from/to. -->
                    <div
                        {@attach (el) => {
                            const rect = el.getBoundingClientRect()
                            dealOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                        }}
                        style="width: {CARD_WIDTH_CSS};"
                        class="relative opacity-80"
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
