<script lang="ts">
    import { type Player, type Color } from '@tabletop/common'
    import { LowenherzPlayerState, PoliticsCardType, type PoliticsCard } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import iconMoneybagFill from '$lib/images/action-cards/icons/icon-moneybag-transparent.png'
    import iconMoneybagLines from '$lib/images/action-cards/icons/icon-moneybag-lines.png'
    import knightFill from '$lib/images/pieces/knight-fill.png'
    import knightLines from '$lib/images/pieces/knight-lines.png'
    import PoliticsCardView from './PoliticsCard.svelte'
    import FlagBorder from './FlagBorder.svelte'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: LowenherzPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let headerColor = $derived(gameSession.colors.getPlayerUiColor(player.id))
    // Kept face-down per the rulebook - only the owning player can peek at their own
    // actual cards (see peek() below); everyone else just sees a face-down card and a
    // count, same convention as the politics-card piles themselves (a client-side
    // convention, not server-enforced - see LowenherzPlayerState.politicsCards).
    let isMe = $derived(gameSession.myPlayer?.id === player.id)

    // "Public Money" game-config option - defaults to on. A player with a perfect
    // memory could always work out everyone's exact ducat total anyway (every
    // transaction that changes it is public - negotiation payments, revealed duel
    // bids, wooded-space costs, money bag payouts, alliance cancellations - and
    // everyone starts from the same known 12), so showing it openly isn't really
    // giving away hidden information; this option just controls whether the app
    // does that bookkeeping for you or makes you track it yourself, closer to the
    // physical game's actual setup ("A player's money is private").
    let showMoney = $derived(isMe || gameSession.game?.config?.publicMoney !== false)

    // Politics-card slot sizing - a fixed pixel width (rather than the single-card
    // aspect-ratio-driven one) so the splayed layout below can lay multiple cards out
    // with a known, consistent per-card width.
    const CARD_H = 103
    const CARD_W = 66 // CARD_H * 534/832, rounded
    const CARD_GAP = 4 // gap between cards when there's room to lay them out flat, unoverlapped
    const MIN_SLIVER = 6 // narrowest an overlapped card is ever allowed to peek out, once cards no longer fit unoverlapped
    const CARD_EDGE_BUFFER = 6 // px - headroom so a rotated frontmost card doesn't clip against this panel's own rounded/overflow-hidden edge

    let rootEl: HTMLElement | undefined = $state()
    // Measures the politics-card area's actual rendered width - cards lay out flat
    // (see step below) as long as they fit in this; only once a big enough hand
    // wouldn't otherwise fit does the spacing compress down toward MIN_SLIVER.
    let politicsAreaWidth: number = $state(0)

    // A little per-card shift/rotation so the splay reads as a loosely-fanned hand
    // rather than a perfectly aligned stack - computed once per card id and cached
    // (not re-rolled every render, which would make cards visibly jitter/flicker
    // whenever anything else about the panel re-renders), same "randomize once, hold
    // stable" approach as WallSegment/RampartCorner's own jitter.
    const cardJitter = new Map<string, { rotate: number; dx: number; dy: number }>()
    function jitterFor(cardId: string): { rotate: number; dx: number; dy: number } {
        let jitter = cardJitter.get(cardId)
        if (!jitter) {
            jitter = {
                rotate: (Math.random() * 2 - 1) * 3.5,
                dx: (Math.random() * 2 - 1) * 2,
                dy: (Math.random() * 2 - 1) * 2
            }
            cardJitter.set(cardId, jitter)
        }
        return jitter
    }

    // Registers this panel's position as the landing/launch point PoliticsHand uses
    // for its "deliver the taken card" and hover-peek animations - only meaningful
    // for the local player's own panel.
    $effect(() => {
        if (isMe && rootEl) {
            gameSession.registerMyPanelAnchor(rootEl)
        }
    })

    // Hovering OR clicking opens the same read-only overlay PoliticsHand shows for a
    // draw pile. It's only ever wired up for isMe (see the template). Deliberately
    // doesn't close on mouseleave - the overlay covers this button as soon as it
    // opens, which triggers a spurious mouseleave under a stationary cursor in most
    // browsers (hit-testing sees a new top element, not actual pointer movement) -
    // dismissing is instead handled the same way as the draw-pile overlay (click the
    // backdrop, Escape, or click this trigger again).
    function peek(event: MouseEvent | KeyboardEvent) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        gameSession.showMyPoliticsCards({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }

    // Cards worth surfacing to the front of the splay right now - Renegade/Alliance
    // while they're playable (alongside laying a decision card), or a Treasure card
    // while it could actually be spent (a wooded knight placement, or backing a duel
    // bid), so a player doesn't have to dig through the sidebar or the peek overlay
    // to find the one that matters this moment.
    const applicableCardIds = $derived(
        isMe
            ? playerState.politicsCards
                  .filter(
                      (c) =>
                          (c.type === PoliticsCardType.Renegade && gameSession.canPlayRenegadeCard) ||
                          (c.type === PoliticsCardType.Alliance && gameSession.canPlayAllianceCard) ||
                          (c.type === PoliticsCardType.Treasure &&
                              (gameSession.canPlaceKnight || gameSession.canSubmitDuelBid))
                  )
                  .map((c) => c.id)
            : []
    )

    // Politics cards in display order - just the hand's natural (acquisition) order.
    // Applicable cards used to get pulled to the front here so they'd surface out
    // from under a heavily overlapped stack, but now that cards mostly lay out flat
    // instead (see step below), the glow itself (card-glow-pulse) is enough to draw
    // the eye - shuffling a card's position the moment it becomes playable is more
    // distracting than helpful.
    const displayCards = $derived(playerState.politicsCards)

    // A card's face only ever shows for your own hand (never an opponent's - that's
    // still purely a client-side convention, not server-enforced, same as before).
    // Every card shows face-up on your own turn (so you can see your whole hand
    // while deciding what to do), and an applicable card (playable Renegade/
    // Alliance, or a spendable Treasure) shows face-up even outside your turn too,
    // so its glow (see card-glow-pulse) is actually attached to real card art.
    // Everything else stays face-down.
    function shouldRevealFace(card: PoliticsCard): boolean {
        if (!isMe) return false
        if (applicableCardIds.includes(card.id)) return true
        return !!isTurn
    }

    // The horizontal step between successive cards - CARD_W + CARD_GAP (no overlap
    // at all) as long as the hand actually fits laid out flat at that spacing, only
    // compressing below CARD_W (cards starting to overlap) once it wouldn't
    // otherwise fit, down to MIN_SLIVER at worst.
    const step = $derived.by(() => {
        const count = displayCards.length
        const preferred = CARD_W + CARD_GAP
        if (count <= 1) return preferred
        const maxThatFits = (politicsAreaWidth - CARD_EDGE_BUFFER - CARD_W) / (count - 1)
        return Math.max(MIN_SLIVER, Math.min(preferred, maxThatFits))
    })
    // Once cards are actually overlapping, only the frontmost one is fully visible/
    // hit-testable, so it alone stays interactive (peek/click) and carries the
    // stacking shadow - laid out flat, every card is fully visible on its own and
    // gets the same treatment.
    const isOverlapping = $derived(step < CARD_W + CARD_GAP)
</script>

{#snippet tintedIcon(fillSrc: string, linesSrc: string, color: Color, dx = 0, dy = 0)}
    <!-- An embossed parchment "medallion" disc sits behind the icon so the little
         ducat/knight marks read as minted tokens and lift off the busy flag art
         instead of looking plain. The disc fills the box; the icon itself is inset a
         little so a coin-like rim shows around it. -->
    <div
        class="absolute inset-0 rounded-full"
        style="
            background: radial-gradient(circle at 38% 30%, #fdfaf0 0%, #efe6d0 58%, #d3c3a0 100%);
            border: 1px solid rgba(94, 73, 42, 0.5);
            box-shadow:
                inset 0 1px 1.5px rgba(255, 255, 255, 0.75),
                inset 0 -1.5px 2px rgba(94, 73, 42, 0.35),
                0 1px 2px rgba(0, 0, 0, 0.4);
        "
    ></div>
    <!-- Same fill-mask + line-art compositing as the board's own knight/castle pieces
         (see RealBoard.svelte's pieceIcon) - fillSrc's shape is used as a mask so this
         player's exact color shows through, linesSrc is outline/detail work layered
         on top so it stays crisp (and visible) regardless of fill color. The
         drop-shadow lifts the mark off the disc for a bit of relief. -->
    <!-- dx/dy nudge the mark within the disc - some source art isn't perfectly
         centered on its own canvas, so a per-icon offset re-centers it optically. -->
    <div
        class="absolute inset-[16%]"
        style="filter: drop-shadow(0 0.5px 1px rgba(0, 0, 0, 0.45)); transform: translate({dx}px, {dy}px);"
    >
        <div
            class="absolute inset-0"
            style="
                background-color:{gameSession.colors.getUiColor(color)};
                mask-image:url({fillSrc}); mask-size:contain; mask-repeat:no-repeat; mask-position:center;
                -webkit-mask-image:url({fillSrc}); -webkit-mask-size:contain; -webkit-mask-repeat:no-repeat; -webkit-mask-position:center;
                filter: saturate(1.7) brightness(1.18);
            "
        ></div>
        <img src={linesSrc} alt="" class="absolute inset-0 w-full h-full object-contain" />
    </div>
{/snippet}

<div
    bind:this={rootEl}
    class="rounded-lg overflow-hidden"
>
    <!-- Name pill, centered right above the flags - a nearly-rectangular pill filled
         with the player's color (same pattern as Indonesia's player nameplates),
         rather than a full-width bar, so it reads as its own badge sitting just above
         the pole rather than a header spanning the whole panel. Ducats flank it on
         the left (number then icon) and knights on the right (icon then number) -
         power points moved up to the toolbar's "Points:" readout instead, so this row
         is the only place per-player stats live now. -->
    <div class="pt-1.5 pb-1 flex justify-center items-center gap-2">
        <span
            class="flex items-center gap-1 text-gray-800 text-[19px] font-semibold"
            title={showMoney ? 'Ducats' : 'Ducats (hidden)'}
        >
            {showMoney ? playerState.money : '?'}
            <span class="relative w-[28px] h-[28px] shrink-0">
                {@render tintedIcon(iconMoneybagFill, iconMoneybagLines, playerState.color, 2, 0)}
            </span>
        </span>
        <span
            class="inline-block max-w-full truncate px-3 pt-[3px] pb-[1px] rounded-md font-bold uppercase tracking-wide text-base text-white"
            style="background-color: {headerColor}"
        >
            {player.name}
        </span>
        <span class="flex items-center gap-1 text-gray-800 text-[19px] font-semibold" title="Knights in stock">
            <span class="relative w-[28px] h-[28px] shrink-0">
                {@render tintedIcon(knightFill, knightLines, playerState.color, 0, -2)}
            </span>
            {playerState.knightsInStock}
        </span>
    </div>
    <FlagBorder color={playerState.color} />
    <!-- The permanent politics-card spot - empty (just a card-shaped outline) when the
         player holds none, so the slot is always there rather than popping in once
         they pick up their first card. -->
    <div class="py-2 px-2 flex items-center" bind:clientWidth={politicsAreaWidth}>
        {#if playerState.politicsCards.length > 0}
            {@const count = displayCards.length}
            <!-- Laid out flat (full CARD_W + CARD_GAP spacing) as long as the hand
                 fits that way - only once it wouldn't does step compress below
                 CARD_W, tucking each card under its neighbor. Every card flips face
                 up (see shouldRevealFace) on your own turn, or at any time if it's
                 currently applicable (glowing, via card-glow-pulse); otherwise it
                 stays face-down. -->
            <div
                class="relative h-[103px] mx-auto"
                style="width: {CARD_W + (count - 1) * step + CARD_EDGE_BUFFER}px;"
            >
                {#each displayCards as card, i (card.id)}
                    {@const isTop = i === count - 1}
                    {@const isInteractive = isOverlapping ? isTop : true}
                    {@const isApplicableCard = applicableCardIds.includes(card.id)}
                    {@const revealFace = shouldRevealFace(card)}
                    {@const jitter = jitterFor(card.id)}
                    <div
                        class="absolute top-0 h-full {isInteractive
                            ? ''
                            : 'pointer-events-none'} {isOverlapping && i > 0
                            ? 'shadow-[-2px_0_3px_rgba(0,0,0,0.35)]'
                            : ''} {isApplicableCard ? 'card-glow-pulse' : ''}"
                        style="
                            right: {CARD_EDGE_BUFFER + (count - 1 - i) * step}px;
                            width: {CARD_W}px;
                            z-index: {i};
                            transform: translate({jitter.dx}px, {jitter.dy}px) rotate({jitter.rotate}deg);
                            transition: right 220ms ease-out, transform 220ms ease-out;
                        "
                    >
                        {#if isInteractive && revealFace}
                            <div
                                class="relative w-full h-full cursor-pointer"
                                role="button"
                                tabindex="0"
                                aria-label="View your politics cards"
                                onmouseenter={peek}
                                onclick={peek}
                                onkeydown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') peek(e)
                                }}
                            >
                                <PoliticsCardView {card} />
                            </div>
                        {:else if isInteractive && isMe}
                            <button
                                type="button"
                                class="relative w-full h-full cursor-pointer"
                                aria-label="View your politics cards"
                                onmouseenter={peek}
                                onclick={peek}
                            >
                                <PoliticsCardView {card} faceDown />
                            </button>
                        {:else if !isMe && isOverlapping && isTop}
                            <!-- The one visible face of an opponent's overlapped stack -
                                 the count tooltip stands in for the cards hidden behind
                                 it. Laid out flat, every one of their cards is already
                                 its own fully visible slot, so this doesn't apply. -->
                            <div
                                class="relative w-full h-full"
                                title="{count} politics card{count === 1 ? '' : 's'}"
                            >
                                <PoliticsCardView {card} faceDown />
                            </div>
                        {:else if revealFace}
                            <PoliticsCardView {card} />
                        {:else}
                            <PoliticsCardView {card} faceDown />
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div
                class="h-[103px] aspect-[534/832] rounded-md border border-dashed border-white/25 mx-auto"
            ></div>
        {/if}
    </div>
    {#if gameSession.showDebug}
        <div class="px-3 py-1 bg-gray-900 text-gray-400 text-[10px] text-left">id: {player.id}</div>
    {/if}
</div>

<style>
    @keyframes card-glow-pulsate {
        0%,
        100% {
            box-shadow:
                0 0 4px 1px rgba(255, 221, 0, 0.35),
                0 0 0 1px rgba(255, 221, 0, 0.35);
        }
        50% {
            box-shadow:
                0 0 14px 5px rgba(255, 221, 0, 0.95),
                0 0 0 2px rgba(255, 221, 0, 0.95);
        }
    }

    .card-glow-pulse {
        border-radius: 0.375rem; /* matches PoliticsCard's own rounded-md corners */
        animation: card-glow-pulsate 1.6s ease-in-out infinite;
    }
</style>
