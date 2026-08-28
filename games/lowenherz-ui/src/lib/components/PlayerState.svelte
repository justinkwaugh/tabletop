<script lang="ts">
    import { gsap } from 'gsap'
    import { type Player, type Color } from '@tabletop/common'
    import { LowenherzPlayerState, type PoliticsCard } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import iconMoneybagFill from '$lib/images/action-cards/icons/icon-moneybag-transparent.png'
    import iconMoneybagLines from '$lib/images/action-cards/icons/icon-moneybag-lines.png'
    import Numeral from './Numeral.svelte'
    import knightFill from '$lib/images/pieces/knight-fill.png'
    import knightLines from '$lib/images/pieces/knight-lines.png'
    import PoliticsCardView from './PoliticsCard.svelte'
    import FlagBorder from './FlagBorder.svelte'

    let gameSession = getGameSession()

    // Browsing history is not the same as playing: the harness caps animation during history
    // navigation at roughly 0.1s (see ANIMATION_PATTERN.md's fast-fallback rule and the
    // FALLBACK_* durations in bus-ui's animators). These card slides are state-driven - the hand's
    // contents change and the cards reposition - so scrubbing through a game would otherwise play
    // them at full length, once per step.
    const cardSlideMs = $derived(gameSession.isViewingHistory ? 100 : 220)
    let { player, playerState }: { player: Player; playerState: LowenherzPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let headerColor = $derived(gameSession.colors.getPlayerUiColor(player.id))
    // Kept face-down per the rulebook - only the owning player ever sees their own cards
    // face-up (see shouldRevealFace below); everyone else just sees a face-down card and a
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

    // Measures the politics-card area's actual rendered width - cards lay out flat
    // (see step below) as long as they fit in this; only once a big enough hand
    // wouldn't otherwise fit does the spacing compress down toward MIN_SLIVER.
    let politicsAreaWidth: number = $state(0)

    // A little per-card shift/rotation so the splay reads as a loosely-fanned hand
    // rather than a perfectly aligned stack - computed once per card id and cached
    // (not re-rolled every render, which would make cards visibly jitter/flicker
    // whenever anything else about the panel re-renders), same "randomize once, hold
    // stable" approach as WallSegment/RampartCorner's own jitter.
    // Only applied once the hand actually has to overlap (see isOverlapping below) -
    // a small hand that lays out flat reads better as a tidy, deliberately aligned
    // row; the loose-hand look is what sells the overlapped stack.
    // Max rotation in either direction - the splay used to reach ±3.5°, which read as
    // messier than intended once several cards were in hand.
    const MAX_CARD_TILT_DEG = 2.1
    const NO_JITTER = { rotate: 0, dx: 0, dy: 0 }
    const cardJitter = new Map<string, { rotate: number; dx: number; dy: number }>()
    function jitterFor(cardId: string): { rotate: number; dx: number; dy: number } {
        if (!isOverlapping) return NO_JITTER
        let jitter = cardJitter.get(cardId)
        if (!jitter) {
            jitter = {
                rotate: (Math.random() * 2 - 1) * MAX_CARD_TILT_DEG,
                dx: (Math.random() * 2 - 1) * 2,
                dy: (Math.random() * 2 - 1) * 2
            }
            cardJitter.set(cardId, jitter)
        }
        return jitter
    }

    // Cards worth surfacing fully, with their own APPLY button - Renegade/Alliance while
    // they're playable, or a Treasure card while it could actually be spent (a wooded knight
    // placement, or backing a duel bid) - OR a card that's currently active (isPoliticsCardActive),
    // even once canApplyPoliticsCard has stopped saying yes to it. That "even once" matters for
    // Renegade/Alliance specifically: canApplyPoliticsCard for those is a GLOBAL check ("is any
    // Renegade play in progress"), not a per-card one, so the instant a Renegade card is clicked
    // and becomes active, canApplyPoliticsCard goes false for THAT card too (you can't start a
    // second Renegade play while one's already under way) - without this OR, the card the player
    // just clicked would immediately fall out of this set and never get to show its own ACTIVE
    // stripe at all, sliding back into the overlapped stack as if nothing had been clicked. These
    // never overlap and never jitter/rotate - a card the player actually needs to reach (or has
    // just reached) sits flush, on its own, rather than being buried in (or tilted like) the rest
    // of the hand. Everything else still overlaps as it did before, just among a possibly smaller
    // group now that this splits off.
    const applicableCardIds = $derived(
        isMe
            ? new Set(
                  playerState.politicsCards
                      .filter((c) => gameSession.canApplyPoliticsCard(c) || gameSession.isPoliticsCardActive(c))
                      .map((c) => c.id)
              )
            : new Set<string>()
    )
    const applicableCards = $derived(playerState.politicsCards.filter((c) => applicableCardIds.has(c.id)))
    const overlappedCards = $derived(playerState.politicsCards.filter((c) => !applicableCardIds.has(c.id)))

    // An empty hand still gets a slot (so cards don't pop the panel taller the moment
    // someone picks one up), but it doesn't need to reserve a full card's height to say
    // "nothing here" - at full size the placeholder was the tallest thing in the panel
    // and made card-less players look as heavy as card-holding ones. Half height keeps
    // the slot legible as a card-shaped outline while giving the row back to the panel.
    const hasPoliticsCards = $derived(playerState.politicsCards.length > 0)
    // Started at half a card's height; trimmed another 20% from there, which is as small
    // as the outline can get while still reading as a card-shaped placeholder rather than
    // a stray divider. Derived from CARD_H so it tracks the real card size.
    const EMPTY_SLOT_H = Math.round(CARD_H * 0.4)


    // A card's face only ever shows for your own hand (never an opponent's - that's
    // still purely a client-side convention, not server-enforced, same as before).
    // Every card shows face-up on your own turn (so you can see your whole hand
    // while deciding what to do), and an applicable card shows face-up even outside
    // your turn too, so its APPLY button is actually attached to real card art.
    // Everything else stays face-down.
    function shouldRevealFace(card: PoliticsCard): boolean {
        if (!isMe) return false
        if (applicableCardIds.has(card.id)) return true
        return !!isTurn
    }

    // Applicable cards that are visually identical - same type, and same printed value for
    // Parchment/Treasure (Alliance/Renegade have no value at all, so any two of one type are
    // already identical) - get stacked together (see DUPLICATE_STEP) rather than each claiming
    // a full card's width, so a hand with several copies of the same applicable card doesn't run
    // the applicable row out of room. Grouping, not deduplicating: every card in a group still
    // gets its own APPLY/ACTIVE button underneath, since a Treasure card's arming in particular
    // is genuinely per-card (see GameSession.armDuelTreasure's own comment - a bid can be backed
    // by more than one Treasure card at once, each independently armed).
    type ApplicableGroup = { key: string; cards: PoliticsCard[] }
    const applicableGroups = $derived.by(() => {
        const groups = new Map<string, PoliticsCard[]>()
        for (const card of applicableCards) {
            const key = `${card.type}:${card.value ?? ''}`
            const existing = groups.get(key)
            if (existing) existing.push(card)
            else groups.set(key, [card])
        }
        return Array.from(groups, ([key, cards]): ApplicableGroup => ({ key, cards }))
    })

    // How far a stacked duplicate peeks out from the one in front of it - enough to still show
    // there's more than one underneath (and to keep each one's own APPLY/ACTIVE band, which spans
    // the card's full width, clickable in that sliver), but well short of a whole card's width.
    const DUPLICATE_STEP = 18
    function groupWidth(count: number): number {
        return CARD_W + (count - 1) * DUPLICATE_STEP
    }

    // Room the always-flat applicable row needs, plus the gap between it and the
    // overlapped stack - subtracted from the overlapped stack's own available width below,
    // so the two groups never fight each other for space.
    const GROUP_GAP = 10
    const applicableWidth = $derived(
        applicableGroups.length > 0
            ? applicableGroups.reduce((sum, group) => sum + groupWidth(group.cards.length), 0) +
                  (applicableGroups.length - 1) * CARD_GAP
            : 0
    )

    // The horizontal step between successive OVERLAPPED cards - CARD_W + CARD_GAP (no
    // overlap at all) as long as that group actually fits laid out flat at that spacing
    // alongside the applicable row, only compressing below CARD_W (cards starting to
    // overlap) once it wouldn't otherwise fit, down to MIN_SLIVER at worst.
    const step = $derived.by(() => {
        const count = overlappedCards.length
        const preferred = CARD_W + CARD_GAP
        if (count <= 1) return preferred
        const reserved = applicableWidth + (applicableCards.length > 0 ? GROUP_GAP : 0)
        // 2x the buffer, matching the width the layout below actually asks for - counting
        // it once here let a full hand come out a buffer wider than the space measured for
        // it, which is what the compression is meant to prevent.
        const maxThatFits = (politicsAreaWidth - 2 * CARD_EDGE_BUFFER - reserved - CARD_W) / (count - 1)
        return Math.max(MIN_SLIVER, Math.min(preferred, maxThatFits))
    })
    // Whether the overlapped group is actually overlapping right now - only the frontmost
    // card gets the stacking shadow once it is; laid out flat, every card in it is fully
    // visible on its own and gets the same (non-stacked) treatment.
    const isOverlapping = $derived(step < CARD_W + CARD_GAP)

    // APPLY bounces in rather than just appearing - the same pop-in shape ScorePopupAnimator/
    // AllianceFormAnimator use elsewhere (two tweens past rest and back, not one implicit
    // overshoot), same constants and easing, but as a plain mount attachment rather than a
    // StateAnimator: the button's own appearance already IS the moment to key off, so there's
    // no game-state transition to watch for separately.
    const BOUNCE_INITIAL_SCALE = 0.2
    const BOUNCE_OVERSHOOT_SCALE = 1.16
    const BOUNCE_POP = 0.18
    const BOUNCE_SETTLE = 0.16

    function bounceIn(el: HTMLElement) {
        gsap.set(el, { scale: BOUNCE_INITIAL_SCALE, opacity: 0 })
        const tl = gsap.timeline()
        tl.to(el, { scale: BOUNCE_OVERSHOOT_SCALE, opacity: 1, duration: BOUNCE_POP, ease: 'back.out(2.2)' }, 0)
        tl.to(el, { scale: 1, duration: BOUNCE_SETTLE, ease: 'power2.out', clearProps: 'scale' }, BOUNCE_POP)
        return () => tl.kill()
    }
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
    class="rounded-lg overflow-hidden"
>
    <!-- Name pill, centered right above the flags - a nearly-rectangular pill filled
         with the player's color (same pattern as Indonesia's player nameplates),
         rather than a full-width bar, so it reads as its own badge sitting just above
         the pole rather than a header spanning the whole panel. Ducats flank it on
         the left (number then icon) and knights on the right (icon then number) -
         power points live in the summary strip above these panels (see SummaryStrip),
         so this row carries only the two per-player supplies.
         The two flanking stats are locked to the same width and pushed outward (ducats
         right-aligned, knights left-aligned) so the pill lands on the panel's true center
         - laid out naturally they differ by however much their numbers differ ("12" vs
         "9", or a hidden total's single "?"), which slid the pill a few pixels off the
         center the flag bar and card row below it both use. -->
    <div class="pt-1.5 pb-1 flex justify-center items-center gap-2">
        <span
            class="w-[64px] shrink-0 flex items-center justify-end gap-1 text-gray-800 text-[19px] font-semibold"
            title={showMoney ? 'Ducats' : 'Ducats (hidden)'}
        >
            {#if showMoney}<Numeral value={playerState.money} />{:else}?{/if}
            <span class="relative w-[28px] h-[28px] shrink-0">
                {@render tintedIcon(iconMoneybagFill, iconMoneybagLines, playerState.color, 2, 0)}
            </span>
        </span>
        <span
            class="inline-block min-w-0 truncate px-3 pt-[3px] pb-[1px] rounded-md font-bold uppercase tracking-wide text-base text-white"
            style="background-color: {headerColor}"
            title={player.name}
        >
            {player.name}
        </span>
        <span
            class="w-[64px] shrink-0 flex items-center justify-start gap-1 text-gray-800 text-[19px] font-semibold"
            title="Knights in stock"
        >
            <span class="relative w-[28px] h-[28px] shrink-0">
                {@render tintedIcon(knightFill, knightLines, playerState.color, 0, -2)}
            </span>
            <Numeral value={playerState.knightsInStock} />
        </span>
    </div>
    <FlagBorder color={playerState.color} />
    <!-- The permanent politics-card spot - empty (just a card-shaped outline) when the
         player holds none, so the slot is always there rather than popping in once
         they pick up their first card. -->
    <div
        class="px-2 flex items-center justify-center gap-2.5 {hasPoliticsCards ? 'py-2' : 'py-1'}"
        bind:clientWidth={politicsAreaWidth}
    >
        {#if hasPoliticsCards}
            {@const overlapCount = overlappedCards.length}
            {#if overlapCount > 0}
                <!-- Laid out flat (full CARD_W + CARD_GAP spacing) as long as this group
                     fits that way alongside the applicable row - only once it wouldn't does
                     step compress below CARD_W, tucking each card under its neighbor. Every
                     card flips face up (see shouldRevealFace) on your own turn; otherwise it
                     stays face-down. -->
                <div class="relative h-[103px] shrink-0" style="width: {CARD_W + (overlapCount - 1) * step}px;">
                    {#each overlappedCards as card, i (card.id)}
                        {@const isTop = i === overlapCount - 1}
                        {@const revealFace = shouldRevealFace(card)}
                        {@const jitter = jitterFor(card.id)}
                        <!-- Every card gets a resting drop shadow, so it sits ON the panel
                             rather than looking printed onto it. PoliticsCard's own shadow-md
                             is far too faint to read at this size against the parchment, and
                             only the overlap shadow below was ever visible - which made the
                             cards look like they gained a shadow at 4-5 cards. Overlapped
                             cards keep the extra shadow on top of it, since that's what
                             separates each card from the one it's tucked under. Plain divs
                             throughout - nothing here is clickable; the cards are legible at
                             this size without needing to open a bigger view first. -->
                        <div
                            class="absolute top-0 h-full rounded-md"
                            style="
                                left: {i * step}px;
                                width: {CARD_W}px;
                                z-index: {i};
                                box-shadow: {isOverlapping && i > 0
                                ? '2px 0 3px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.4)'
                                : '0 2px 4px rgba(0, 0, 0, 0.4)'};
                                transform: translate({jitter.dx}px, {jitter.dy}px) rotate({jitter.rotate}deg);
                                transition: left {cardSlideMs}ms ease-out, transform {cardSlideMs}ms ease-out;
                            "
                        >
                            {#if !isMe && isOverlapping && isTop}
                                <!-- The one visible face of an opponent's overlapped stack -
                                     the count tooltip stands in for the cards hidden behind
                                     it. Laid out flat, every one of their cards is already
                                     its own fully visible slot, so this doesn't apply. -->
                                <div
                                    class="relative w-full h-full"
                                    title="{overlapCount} politics card{overlapCount === 1 ? '' : 's'}"
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
            {/if}
            {#if applicableGroups.length > 0}
                <!-- Never jittered/rotated like the overlapped group below, and never compressed
                     smaller than DUPLICATE_STEP apart - a card the player can actually act on
                     right now sits close to flush, with its own APPLY button
                     (GameSession.applyPoliticsCard) right on it. The card art itself isn't
                     otherwise clickable, same as the overlapped group. Once applying it has
                     actually landed (see isPoliticsCardActive - an armed Treasure has nothing
                     else on screen to confirm that), APPLY is replaced with an ACTIVE stripe
                     instead of sitting there looking unclicked. -->
                <div class="flex items-start gap-1.5 h-[103px] shrink-0">
                    {#each applicableGroups as group (group.key)}
                        <!-- Duplicates of the same applicable card (see applicableGroups) stack
                             within their own group instead of each claiming a full card's width -
                             mostly overlapping, but each still peeking out enough (DUPLICATE_STEP)
                             to show there's more than one AND to keep its own APPLY/ACTIVE band
                             (which spans its card's full width) clickable in that sliver. A
                             group of one behaves exactly as a lone applicable card always did. -->
                        <div class="relative h-full shrink-0" style="width: {groupWidth(group.cards.length)}px;">
                            {#each group.cards as card, i (card.id)}
                                {@const active = gameSession.isPoliticsCardActive(card)}
                                <div
                                    class="absolute top-0 rounded-md"
                                    style="
                                        left: {i * DUPLICATE_STEP}px;
                                        width: {CARD_W}px;
                                        z-index: {i};
                                        box-shadow: {i > 0
                                        ? '2px 0 3px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.4)'
                                        : '0 2px 4px rgba(0, 0, 0, 0.4)'};
                                    "
                                >
                                    <PoliticsCardView {card} />
                                    {#if active}
                                        <!-- border border-transparent: same 1px the APPLY pill's own
                                             border adds, purely so the two are the same height -
                                             ACTIVE's own background already reads solid without a
                                             visible border of its own. -->
                                        <div
                                            class="absolute top-[15%] left-0 right-0 bg-red-700 text-white text-[10px] font-bold tracking-widest text-center py-1 border border-transparent pointer-events-none shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                                        >
                                            ACTIVE
                                        </div>
                                    {:else}
                                        <!-- inset-x-1 rather than flush left-0/right-0: a pill this
                                             narrow reads better with a sliver of card showing on either
                                             side than stretched edge-to-edge. Border/background/text
                                             match the board's own village-name pill (see RealBoard.svelte)
                                             rather than a plain UI button, for the same "labeled thing
                                             sitting on parchment" look. -->
                                        <button
                                            type="button"
                                            {@attach bounceIn}
                                            class="absolute top-[15%] inset-x-1 cursor-pointer rounded-full text-[#f6e8c8] text-[10px] font-bold tracking-wide text-center py-1 border border-[rgba(217,180,74,0.75)] bg-[rgba(43,26,10,0.92)] shadow-[0_2px_5px_rgba(0,0,0,0.45)] hover:border-[rgba(217,180,74,1)]"
                                            onclick={() => gameSession.applyPoliticsCard(card)}
                                        >
                                            APPLY
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <div
                class="aspect-[534/832] rounded-md border border-dashed border-white/25"
                style="height: {EMPTY_SLOT_H}px;"
            ></div>
        {/if}
    </div>
    {#if gameSession.showDebug}
        <div class="px-3 py-1 bg-gray-900 text-gray-400 text-[10px] text-left">id: {player.id}</div>
    {/if}
</div>

<style>

</style>
