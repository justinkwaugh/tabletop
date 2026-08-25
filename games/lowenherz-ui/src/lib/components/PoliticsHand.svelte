<script lang="ts">
    import { onMount } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PoliticsCardType, type PoliticsCard as PoliticsCardData } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    // Browsing history is not the same as playing: the harness caps animation during history
    // navigation at roughly 0.1s (see ANIMATION_PATTERN.md's fast-fallback rule and the
    // FALLBACK_* durations in bus-ui's animators). These card slides are state-driven - the hand's
    // contents change and the cards reposition - so scrubbing through a game would otherwise play
    // them at full length, once per step.
    // The fan's angles and offsets depend on the hand's size, so they move on state change
    // as well as on hover.
    const fanMs = $derived(gameSession.isViewingHistory ? 100 : 300)

    // Two unrelated things share this same floating-overlay chrome and deal-in
    // animation: the draw-pile flow (pick a NEW card from a pile you've committed
    // to - see DeckPiles.svelte) and this read-only peek at cards you already hold
    // (see PlayerState.svelte's hover/click on your own pile). Only the former lets
    // you click a card to take it.
    const viewingMyHand = $derived(gameSession.viewingMyPoliticsCards)
    // Once a pile is opened there's only one legal move left - take a card from it - so its fan
    // shows itself; there's no separate "reopen" step to gate it on. That holds across a reload
    // too: openedPoliticsPile is server state, so a player who reloads mid-choice still has it set.
    const isOpen = $derived(viewingMyHand || !!gameSession.selectedPoliticsPile)

    const cards = $derived(
        viewingMyHand
            ? gameSession.myPoliticsCards
            : gameSession.selectedPoliticsPile === 'A'
              ? gameSession.gameState.politicsCardPileA
              : gameSession.selectedPoliticsPile === 'B'
                ? gameSession.gameState.politicsCardPileB
                : []
    )

    // Only the read-only peek at your own hand can be dismissed. Choosing a card from an opened pile
    // cannot: the rulebook has the player "look through one of the two piles... and select one
    // card", so once a pile is open the only move is to take a card from it - there is nothing a
    // dismiss would do but strand the player with no way back short of reloading (see isOpen above).
    const dismissible = $derived(viewingMyHand)

    // Only reachable via the backdrop/Escape, which are only wired up when dismissible - i.e. only
    // for the my-hand peek. An opened pile has no dismiss gesture at all (see isOpen above).
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
    const FAN_ANGLE_STEP = 9 // degrees between adjacent cards
    const FAN_OFFSET_STEP = 56 // px between adjacent card centers once fanned - can be
    // generous now that this floats over the whole viewport instead of living in the
    // narrow sidebar column.

    // This overlay already floats above everything with a dimmed backdrop, so there's
    // no space pressure that needs the splay-and-pop-on-hover trick - a plain tiled
    // grid reads just as well and is simpler. Flip this back to true to bring back the
    // fan (kept below, unused, since it's a fun effect we might revisit).
    const SHOW_SPLAYED = false

    // Starts stacked (only the top card showing, unrotated) and fans out shortly
    // after mount - a plain CSS transform transition. Replays every time this
    // component (re)appears, including hide-then-reveal-the-same-pile. Only matters
    // for the splayed layout.
    let fannedOut = $state(false)
    let hoveredCardId: string | undefined = $state(undefined)

    // onMount, not an effect: this watches nothing. The fan is a one-shot animation belonging to
    // this component's appearance, and the component is recreated on every reveal.
    onMount(() => {
        if (!SHOW_SPLAYED) return
        const timer = setTimeout(() => {
            fannedOut = true
        }, 40)
        return () => clearTimeout(timer)
    })

    // Tiled-layout "deal" animation: each card flies in from wherever the clicked
    // pile button actually sits on screen (see DeckPiles.svelte/politicsPileOrigin),
    // landing at its normal tiled position, staggered slightly per card like a quick
    // riffle deal. Done with direct DOM writes (rather than a Svelte transition)
    // because the "from" point is external and only known at click time, and the
    // "to" point is wherever flex-wrap happens to lay each card out.
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
    function dealIn(index: number) {
        return (el: HTMLElement) => {
            if (SHOW_SPLAYED) return
            const origin = gameSession.politicsPileOrigin
            if (!origin) return

            const rect = el.getBoundingClientRect()
            const dx = origin.x - (rect.left + rect.width / 2)
            const dy = origin.y - (rect.top + rect.height / 2)
            const delay = index * DEAL_STAGGER

            el.style.transition = 'none'
            el.style.opacity = '0'
            el.style.transform = `translate(${dx}px, ${dy}px) scale(0.35) rotate(${index % 2 === 0 ? -6 : 6}deg)`

            // Force a reflow so the "from" state above is actually painted before the "to" state
            // below kicks off the transition.
            void el.offsetHeight

            el.style.transition = `transform ${DEAL_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, opacity 200ms ease-out ${delay}ms`
            el.style.opacity = '1'
            el.style.transform = 'translate(0px, 0px) scale(1) rotate(0deg)'

            // Once landed, drop back to plain Tailwind-controlled styling so the normal
            // hover-opacity behaviour still works afterward.
            const settle = setTimeout(() => {
                el.style.transition = ''
                el.style.opacity = ''
                el.style.transform = ''
            }, delay + DEAL_DURATION + 50)

            return () => clearTimeout(settle)
        }
    }

    // Animates one card's element from wherever it currently sits to a target
    // viewport point, shrinking and fading out as it flies - the reverse of the
    // deal-in effect above. Resolves once the transition (including its stagger
    // delay) has finished, so callers can sequence multiple flights one after another.
    function flyTo(
        el: HTMLElement | undefined,
        target: { x: number; y: number },
        delay: number,
        duration: number
    ): Promise<void> {
        return new Promise((resolve) => {
            if (!el) {
                resolve()
                return
            }

            const rect = el.getBoundingClientRect()
            const dx = target.x - (rect.left + rect.width / 2)
            const dy = target.y - (rect.top + rect.height / 2)

            el.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.7, 1) ${delay}ms, opacity ${Math.min(duration, 250)}ms ease-in ${delay}ms`
            el.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`
            el.style.opacity = '0'

            setTimeout(resolve, delay + duration + 20)
        })
    }

    // Set for the whole choreographed sequence below, once a card has been clicked -
    // disables further clicks and the backdrop's dismiss-on-click until it finishes.
    let takingCardId: string | undefined = $state(undefined)

    const RETURN_DURATION = 300 // ms - the other cards flying back to the pile
    const RETURN_STAGGER = 35 // ms between each returning card starting its flight
    const DELIVER_DURATION = 420 // ms - the taken card flying to the player's own pile

    // Only ever called from the draw-pile flow (see the template - viewingMyHand
    // cards aren't clickable). Rather than taking the card immediately, plays it out
    // visually first: every OTHER card flies back to the pile it came from, then the
    // chosen card flies on to the player's own politics pile (see PlayerState.svelte)
    // - only once that's finished do we actually dispatch TakePoliticsCard, which is
    // also what closes this overlay.
    async function chooseCard(card: PoliticsCardData) {
        if (viewingMyHand || takingCardId) return
        const pile = gameSession.selectedPoliticsPile
        if (!pile) return

        takingCardId = card.id

        const pileOrigin = gameSession.politicsPileOrigin
        if (pileOrigin) {
            const others = cards.filter((c) => c.id !== card.id)
            await Promise.all(
                others.map((c, i) => flyTo(cardEls[c.id], pileOrigin, i * RETURN_STAGGER, RETURN_DURATION))
            )
        }

        const myPileOrigin = gameSession.myPoliticsPileOrigin
        if (myPileOrigin) {
            await flyTo(cardEls[card.id], myPileOrigin, 0, DELIVER_DURATION)
        }

        await gameSession.takePoliticsCard(pile, card.id)
        takingCardId = undefined
    }

    // Only relevant in the read-only my-hand view (see PlayerState.svelte) - a card
    // already in hand can be applied right now if its type's specific play window is
    // currently open. Renegade/Alliance share the same window (your decision-laying
    // turn) via the existing multi-step targeting flow (this is just a second entry
    // point into the same session methods, alongside the glowing card in the player
    // panel splay - see PlayerState.svelte). Treasure has no dedicated "play" action
    // of its own - applying it here just arms it (the same
    // selectTreasureCard() mechanism RealBoard's wooded-square picker and the duel-bid
    // form already use), for the next knight placement or duel bid to pick up.
    function canApplyCard(card: PoliticsCardData): boolean {
        if (!viewingMyHand) return false
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
                gameSession.selectTreasureCard(card.id)
                break
        }
        // The remaining steps (picking regions/squares, or entering a bid) happen on
        // the board/sidebar behind this overlay, so get out of the way immediately.
        close()
    }
</script>

{#if isOpen}
    <!-- A floating overlay above everything else - doesn't affect the board or sidebar's size at
         all. The backdrop dismisses it only when it is dismissible (see above): the peek at your own
         hand closes on a click or Escape, an opened pile stays up until a card is taken. The
         handlers and the button role are spread in together so a backdrop that does nothing is not
         announcing itself as a button. Dismissal is off entirely while a card is being taken
         (takingCardId set), so the return-then-deliver animation can't be interrupted partway. -->
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/50 p-3"
        {...dismissible
            ? {
                  role: 'button',
                  tabindex: 0,
                  onclick: () => !takingCardId && close(),
                  onkeydown: (e: KeyboardEvent) => {
                      if (
                          (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') &&
                          !takingCardId
                      ) {
                          close()
                      }
                  }
              }
            : {}}
    >
        <!-- Matches the pile-choosing prompt in PoliticsPileOverlay (text-2xl semibold with
             a drop shadow): the two are consecutive steps of the same flow, and at text-sm
             this one read as a caption where the first read as an instruction. -->
        <span class="text-white text-2xl font-semibold drop-shadow">
            {#if viewingMyHand}
                Your politics cards
            {:else}
                Click a card to take it.
            {/if}
        </span>
        <!-- Matches PoliticsPileOverlay's error readout: this is the only overlay left on screen
             once a pile is chosen (see its showing), so a rejected take needs somewhere to say so. -->
        {#if gameSession.errorMessage}
            <div
                class="mx-auto max-w-[420px] rounded-md bg-red-900/90 border border-red-300/50 px-3 py-2 text-center text-white text-base"
            >
                {gameSession.errorMessage}
            </div>
        {/if}
        {#if SHOW_SPLAYED}
            {#key gameSession.selectedPoliticsPile}
                <div
                    class="relative flex justify-center"
                    style="height: 240px; width: 100%;"
                    role="presentation"
                    onclick={(e) => e.stopPropagation()}
                >
                    {#each cards as card, i (card.id)}
                        {@const mid = (cards.length - 1) / 2}
                        {@const isHovered = hoveredCardId === card.id}
                        {@const angle = fannedOut && !isHovered ? (i - mid) * FAN_ANGLE_STEP : 0}
                        {@const offset = fannedOut ? (i - mid) * FAN_OFFSET_STEP : 0}
                        <button
                            type="button"
                            class="absolute bottom-0 left-1/2 origin-bottom cursor-pointer transition-[transform,opacity] ease-out {isHovered
                                ? 'opacity-100'
                                : 'opacity-80'}"
                            style="
                                transition-duration: {fanMs}ms;
                                width: {CARD_WIDTH_CSS};
                                transform: translateX(-50%) translateX({offset}px) rotate({angle}deg) {isHovered
                                ? 'translateY(-24px) scale(1.15)'
                                : ''};
                                z-index: {isHovered ? 100 : i};
                            "
                            onmouseenter={() => (hoveredCardId = card.id)}
                            onmouseleave={() => (hoveredCardId = undefined)}
                            onclick={() => gameSession.takePoliticsCard(gameSession.selectedPoliticsPile!, card.id)}
                        >
                            <PoliticsCard {card} />
                        </button>
                    {/each}
                </div>
            {/key}
        {:else}
            <!-- Simple tiled grid: every card the same size, laid out side by side and
                 wrapping as needed, no overlap or hover pop needed since this already
                 floats above the whole board.

                 w-full alongside max-w-4xl: the parent's items-center means this isn't stretched
                 to fill it, only centred within it, so without a width tied to that available
                 space this sized itself to fit every card on one unwrapped row - up to 896px wide
                 even on a 375px phone - and overflowed past the fixed backdrop's edge into
                 whatever sat behind the page rather than actually wrapping. -->
            <div
                class="flex flex-wrap items-start justify-center gap-4 w-full max-w-4xl max-h-[calc(100dvh-7rem)] overflow-y-auto px-2 py-1"
                role="presentation"
                onclick={(e) => e.stopPropagation()}
            >
                {#each cards as card, dealIndex (card.id)}
                    {#if viewingMyHand}
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
                    {:else}
                        <button
                            type="button"
                            bind:this={cardEls[card.id]}
                            {@attach dealIn(dealIndex)}
                            disabled={takingCardId !== undefined}
                            class="cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-150"
                            style={cardWidthStyle}
                            onclick={() => chooseCard(card)}
                        >
                            <PoliticsCard {card} />
                        </button>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
{/if}
