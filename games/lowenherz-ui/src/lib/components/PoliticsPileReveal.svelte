<script lang="ts">
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    // Real server state (LookAtPoliticsPile), not local UI state - survives reload/undo. See
    // GameSession.selectedPoliticsPile's own comment for why that matters. Rendered only once
    // this is set (see GameTable.svelte), in the space HistoryControls/the side tabs just
    // collapsed out of - the pile itself never moves; it's whichever count pill in SummaryStrip
    // was clicked (see that component's choosePile, which sets politicsPileOrigin below).
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

    // Tiled "deal" animation: each card slides in from the pile's origin (the count pill that
    // was clicked - see SummaryStrip.choosePile), staggered like a quick riffle deal - the same
    // shape Sol uses when you inspect its card deck (a plain slide, no spin). Plain GSAP tweens
    // against a measured rect rather than porting GSAP's Flip plugin, to stay consistent with how
    // every other animation in this codebase is built. An attachment rather than an effect, so it
    // plays exactly once per card, right as it mounts (see ANIMATION_PATTERN.md and PoliticsHand's
    // own dealIn, which this mirrors).
    const DEAL_DURATION = 380 // ms
    const DEAL_STAGGER = 45 // ms between each successive card starting its flight

    function dealIn(index: number) {
        return (el: HTMLElement) => {
            const origin = gameSession.politicsPileOrigin
            if (!origin) return
            const rect = el.getBoundingClientRect()
            const dx = origin.x - (rect.left + rect.width / 2)
            const dy = origin.y - (rect.top + rect.height / 2)

            gsap.set(el, { x: dx, y: dy, scale: 0.3, opacity: 0 })

            const tl = gsap.timeline({
                delay: (index * DEAL_STAGGER) / 1000,
                onComplete: () => {
                    // Named properties only, not 'all' - clearing the whole inline style would
                    // also wipe the Svelte-set width, collapsing the card (see PoliticsHand's own
                    // note on this exact bug).
                    gsap.set(el, { clearProps: 'x,y,scale,opacity' })
                }
            })
            tl.to(el, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0)
            tl.to(el, { x: 0, y: 0, scale: 1, duration: DEAL_DURATION / 1000, ease: 'power2.out' }, 0)

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
        const takingPile = pile
        if (takingCardId || !takingPile) return
        takingCardId = card.id

        const tl = gsap.timeline()
        const origin = gameSession.politicsPileOrigin
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

        await gameSession.takePoliticsCard(takingPile, card.id)
        takingCardId = undefined
    }
</script>

{#if pile}
    <div class="px-3 py-2 flex flex-col gap-2 border-b-2 border-black/20">
        <div class="text-black text-base font-semibold">Click a card to take it.</div>
        {#if gameSession.errorMessage}
            <div
                class="max-w-full rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-sm"
            >
                {gameSession.errorMessage}
            </div>
        {/if}
        <div class="flex flex-wrap items-start gap-2">
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
