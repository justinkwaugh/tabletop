<script lang="ts">
    import { gsap } from 'gsap'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PoliticsCardType, type PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    // A read-only peek at cards you already hold, triggered by hovering/clicking your own pile in
    // the player panel (see PlayerState.svelte). The pile-choosing/draw flow used to share this
    // same floating-overlay chrome and deal-in animation, but has its own presentation now
    // (SummaryStrip's highlighted count pills to choose, PoliticsPileReveal to deal the cards in
    // the space that opens up beside them) - this dismissible, full-screen overlay is purely for
    // the peek.
    const isOpen = $derived(gameSession.viewingMyPoliticsCards)
    const cards = $derived(gameSession.myPoliticsCards)

    function close() {
        gameSession.hideMyPoliticsCards()
    }

    // Desktop width. On a phone, min() takes over: 42vw keeps two cards plus the gap inside a 320px
    // viewport with margin to spare, where a fixed 150px pair came to 316px and sat flush against
    // both edges. A style rather than a Tailwind class because dealIn measures the rendered node,
    // and every card below shares it.
    const CARD_WIDTH = 150
    const CARD_WIDTH_CSS = `min(${CARD_WIDTH}px, 42vw)`
    const cardWidthStyle = `width: ${CARD_WIDTH_CSS};`

    // Tiled "deal" animation: each card flies in from wherever the clicked pile button actually
    // sits on screen (see PlayerState.svelte's peek()/politicsPileOrigin), landing at its normal
    // tiled position, staggered slightly per card like a quick riffle deal. Done with direct DOM
    // writes (rather than a Svelte transition) because the "from" point is external and only known
    // at click time, and the "to" point is wherever flex-wrap happens to lay each card out.
    let cardEls: Record<string, HTMLElement> = {}

    const DEAL_DURATION = 380 // ms
    const DEAL_STAGGER = 45 // ms between each successive card starting its flight

    // An attachment on each card rather than an effect watching isOpen. The deal plays when the
    // cards APPEAR, and an attachment runs exactly then - per card, with the node in hand, so
    // there is no cardEls lookup, no requestAnimationFrame to wait for layout (the node is already
    // in the document and measurable), and nothing to cancel if the hand closes mid-flight because
    // the attachment's own cleanup runs when the card goes.
    //
    // The stagger index comes from the card's position in the hand, which is what the loop was
    // using anyway.
    //
    // A GSAP timeline rather than a raw CSS transition + settle timeout: the timeout only ever
    // GUESSED when the transition had finished (delay + duration + a fudge factor), which can
    // diverge from the actual visual completion if the tween is interrupted, throttled, or its
    // element removed mid-flight. GSAP's own onComplete fires exactly when the tween actually
    // finishes, and clearProps hands the element straight back to Tailwind afterward, same as the
    // old settle timeout did.
    function dealIn(index: number) {
        return (el: HTMLElement) => {
            const origin = gameSession.politicsPileOrigin
            if (!origin) return

            const rect = el.getBoundingClientRect()
            const dx = origin.x - (rect.left + rect.width / 2)
            const dy = origin.y - (rect.top + rect.height / 2)

            gsap.set(el, {
                x: dx,
                y: dy,
                scale: 0.35,
                opacity: 0,
                rotate: index % 2 === 0 ? -6 : 6
            })

            const tl = gsap.timeline({
                delay: (index * DEAL_STAGGER) / 1000,
                onComplete: () => {
                    // 'all' clears the WHOLE inline style attribute, not just the properties
                    // this tween touched - that included the width Svelte's style={cardWidthStyle}
                    // had set, collapsing every card down to its unstyled intrinsic size right as
                    // the deal finished. Naming only the tweened properties leaves that alone.
                    gsap.set(el, { clearProps: 'x,y,scale,rotate,opacity' })
                }
            })
            // Opacity finishes well before the flight does, same split the old CSS transition
            // had (200ms fade against a 380ms move) - a snappy fade-in reads better than one
            // that's still creeping up as the card settles into place.
            tl.to(el, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0)
            tl.to(el, { x: 0, y: 0, scale: 1, rotate: 0, duration: DEAL_DURATION / 1000, ease: 'power3.out' }, 0)

            return () => tl.kill()
        }
    }

    // A card already in hand can be applied right now if its type's specific play window is
    // currently open. Renegade/Alliance share the same window (your decision-laying turn) via the
    // existing multi-step targeting flow (this is just a second entry point into the same session
    // methods, alongside the glowing card in the player panel splay - see PlayerState.svelte).
    // Treasure has no dedicated "play" action of its own - applying it here just arms it, for the
    // next knight placement (selectTreasureCard - one card at a time) or duel bid
    // (armDuelTreasure - any number, since nothing in the rulebook caps a bid at one) to pick up.
    function canApplyCard(card: PoliticsCardData): boolean {
        switch (card.type) {
            case PoliticsCardType.Renegade:
                return gameSession.canPlayRenegadeCard && !gameSession.isPlayingRenegadeCard
            case PoliticsCardType.Alliance:
                return gameSession.canPlayAllianceCard && !gameSession.isPlayingAllianceCard
            case PoliticsCardType.Treasure:
                return gameSession.canPlaceKnight || gameSession.canSubmitDuelBid
            default:
                return false
        }
    }

    function applyCard(card: PoliticsCardData) {
        switch (card.type) {
            case PoliticsCardType.Renegade:
                gameSession.startPlayingRenegadeCard(card.id)
                break
            case PoliticsCardType.Alliance:
                gameSession.startPlayingAllianceCard(card.id)
                break
            case PoliticsCardType.Treasure:
                if (gameSession.canSubmitDuelBid) {
                    gameSession.armDuelTreasure(card.id)
                } else {
                    gameSession.selectTreasureCard(card.id)
                }
                break
        }
        // The remaining steps (picking regions/squares, or entering a bid) happen on
        // the board/sidebar behind this overlay, so get out of the way immediately.
        close()
    }
</script>

{#if isOpen}
    <!-- A floating overlay above everything else - doesn't affect the board or sidebar's size at
         all. Dismisses on a click or Escape - unlike the draw-pile flow this replaced part of,
         there is nothing here that has to be finished before backing out; it is just a look. -->
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/50 p-3"
        role="button"
        tabindex="0"
        onclick={() => close()}
        onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') close()
        }}
    >
        <span class="text-white text-2xl font-semibold drop-shadow">Your politics cards</span>
        <div
            class="flex flex-wrap items-start justify-center gap-4 w-full max-w-4xl max-h-[calc(100dvh-7rem)] overflow-y-auto px-2 py-1"
            role="presentation"
            onclick={(e) => e.stopPropagation()}
        >
            {#each cards as card, dealIndex (card.id)}
                <div
                    bind:this={cardEls[card.id]}
                    {@attach dealIn(dealIndex)}
                    class="relative opacity-90"
                    style={cardWidthStyle}
                >
                    <PoliticsCard {card} />
                    {#if canApplyCard(card)}
                        <button
                            type="button"
                            class="absolute top-[15%] left-1/2 -translate-x-1/2 cursor-pointer rounded-lg bg-black/80 text-white text-xs tracking-widest px-3 py-1 border-2 border-transparent hover:border-white"
                            onclick={() => applyCard(card)}
                        >
                            APPLY
                        </button>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}
