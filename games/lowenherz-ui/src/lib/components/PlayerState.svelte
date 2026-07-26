<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { LowenherzPlayerState, PoliticsCardType, type PoliticsCard } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import iconCrownScepter from '$lib/images/action-cards/icons/icon-crown-scepter.png'
    import iconMoneybag from '$lib/images/action-cards/icons/icon-moneybag.png'
    import iconKnight from '$lib/images/action-cards/icons/icon-knight.png'
    import PoliticsCardView from './PoliticsCard.svelte'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: LowenherzPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let isFirstPlayer = $derived(gameSession.gameState.firstPlayerId === player.id)
    let headerColor = $derived(gameSession.colors.getPlayerUiColor(player.id))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(playerState.playerId))
    // Kept face-down per the rulebook - only the owning player can peek at their own
    // actual cards (see peek() below); everyone else just sees a face-down card and a
    // count, same convention as the politics-card piles themselves (a client-side
    // convention, not server-enforced - see LowenherzPlayerState.politicsCards).
    let isMe = $derived(gameSession.myPlayer?.id === player.id)

    // Politics-card slot sizing - a fixed pixel width (rather than the single-card
    // aspect-ratio-driven one) so the splayed layout below can lay multiple cards out
    // with a known, consistent per-card width.
    const CARD_H = 120
    const CARD_W = 77 // CARD_H * 534/832, rounded
    const SLIVER = 6 // px of each non-top card's edge left peeking out from underneath

    let rootEl: HTMLElement | undefined = $state()

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

    // Renegade/Alliance cards playable right now (alongside laying a decision card) -
    // one of these gets featured on top of the splay, with an Apply button right on
    // it, so a player doesn't have to dig through the sidebar or the peek overlay to
    // find it.
    const applicableCardIds = $derived(
        isMe
            ? playerState.politicsCards
                  .filter(
                      (c) =>
                          (c.type === PoliticsCardType.Renegade && gameSession.canPlayRenegadeCard) ||
                          (c.type === PoliticsCardType.Alliance && gameSession.canPlayAllianceCard)
                  )
                  .map((c) => c.id)
            : []
    )

    // Which applicable card (if any) is featured - chosen at random among ties, but
    // held stable (not re-rolled every render) until the set of applicable cards
    // actually changes and the current pick is no longer valid.
    let featuredCardId: string | undefined = $state(undefined)
    $effect(() => {
        const ids = applicableCardIds
        if (featuredCardId && ids.includes(featuredCardId)) return
        featuredCardId = ids.length > 0 ? ids[Math.floor(Math.random() * ids.length)] : undefined
    })

    // Politics cards in splay order - the featured card (if any) moved to the end, so
    // it renders frontmost/topmost regardless of where it naturally falls in hand.
    const displayCards = $derived.by(() => {
        const cards = playerState.politicsCards
        const featured = featuredCardId && cards.find((c) => c.id === featuredCardId)
        if (!featured) return cards
        return [...cards.filter((c) => c.id !== featuredCardId), featured]
    })

    function applyFeaturedCard(event: MouseEvent, card: PoliticsCard) {
        event.stopPropagation()
        if (card.type === PoliticsCardType.Renegade) {
            gameSession.startPlayingRenegadeCard(card.id)
        } else if (card.type === PoliticsCardType.Alliance) {
            gameSession.startPlayingAllianceCard(card.id)
        }
    }
</script>

{#snippet politicsCardSlot()}
    <PoliticsCardView card={playerState.politicsCards[0]} faceDown />
    <!-- Large centered numeral (no circle), matching the same treatment on the
         undrawn politics piles' backs - this is the face-down "back" view of a
         personal hand, so the same big-number look applies. -->
    <span
        class="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none"
        style="font-size: 48px; line-height: 1; text-shadow: 0 0 6px rgba(0, 0, 0, 0.85), 0 0 12px rgba(0, 0, 0, 0.6);"
    >
        {playerState.politicsCards.length}
    </span>
{/snippet}

<div
    bind:this={rootEl}
    class="rounded-lg overflow-hidden {isTurn ? 'border-[4px] pulse-border' : 'border-[4px]'}"
    style={isTurn ? '' : `border-color: ${headerColor}`}
>
    <!-- Colored name bar -->
    <div
        class="px-3 py-1.5 flex items-center gap-2 font-bold uppercase tracking-wide {textColor} text-base"
        style="background-color: {headerColor}"
    >
        {#if isFirstPlayer}
            <span
                class="text-[11px] bg-black/30 px-1.5 py-[2px] rounded font-normal normal-case tracking-normal shrink-0"
            >
                1st
            </span>
        {/if}
        <span class="truncate min-w-0 flex-1 text-left">{player.name}</span>
    </div>
    <!-- Everything below the name bar: stats stacked on the left, and a permanent
         politics-card spot on the right that stretches to match - like Sol's
         per-player card slot, which spans the full height of everything below its
         own name bar. -->
    <div class="flex flex-row items-stretch bg-gray-800">
        <div class="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1 text-white text-sm">
            <span class="flex items-center gap-1.5" title="Power points">
                <img src={iconCrownScepter} alt="Power" class="w-4 h-4 object-contain" />
                {playerState.powerPoints}
            </span>
            <span class="flex items-center gap-1.5" title="Ducats">
                <img src={iconMoneybag} alt="Money" class="w-4 h-4 object-contain" />
                {playerState.money}
            </span>
            <span class="flex items-center gap-1.5" title="Knights in stock">
                <img src={iconKnight} alt="Knights" class="w-4 h-4 object-contain" />
                {playerState.knightsInStock}
            </span>
        </div>
        <!-- Permanent politics-card spot - empty (just a card-shaped outline) when the
             player holds none, so the slot is always there rather than popping in
             once they pick up their first card. Height is an explicit pixel value
             (not h-full/stretch) so its aspect-ratio-derived width resolves in a
             single, unambiguous pass - a percentage/stretched height here left the
             width computation racing the row's own cross-axis sizing, and the slot
             would render far too wide and get clipped down to a sliver by this
             panel's overflow-hidden. -->
        <div class="shrink-0 py-2 pr-2">
            {#if playerState.politicsCards.length > 0}
                {#if isMe && (isTurn || featuredCardId)}
                    {@const count = displayCards.length}
                    <!-- On your own turn (or whenever a Renegade/Alliance card is ready to
                         play), the top card flips face up and the rest peek out narrowly to
                         its left. The featured card (if any) is always the top one, with an
                         Apply button on it; otherwise hover/click the top card as always to
                         see the full hand. -->
                    <div class="relative h-[120px]" style="width: {CARD_W + (count - 1) * SLIVER}px;">
                        {#each displayCards as card, i (card.id)}
                            {@const isTop = i === count - 1}
                            {@const isFeatured = card.id === featuredCardId}
                            <div
                                class="absolute top-0 h-full {isTop ? '' : 'pointer-events-none'}"
                                style="right: {(count - 1 - i) * SLIVER}px; width: {CARD_W}px; z-index: {i};"
                            >
                                {#if isFeatured}
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
                                        <span
                                            class="absolute bottom-0 right-0 min-w-[19px] h-[19px] px-1 rounded-full bg-black/75 text-white text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none"
                                        >
                                            {count}
                                        </span>
                                        <button
                                            type="button"
                                            class="absolute top-[18px] left-1/2 -translate-x-1/2 cursor-pointer rounded-lg bg-black/80 text-white text-[10px] tracking-widest px-2 py-0.5 border border-transparent hover:border-white"
                                            onclick={(e) => applyFeaturedCard(e, card)}
                                        >
                                            APPLY
                                        </button>
                                    </div>
                                {:else if isTop}
                                    <button
                                        type="button"
                                        class="relative w-full h-full cursor-pointer"
                                        aria-label="View your politics cards"
                                        onmouseenter={peek}
                                        onclick={peek}
                                    >
                                        <PoliticsCardView {card} />
                                        <span
                                            class="absolute bottom-0 right-0 min-w-[19px] h-[19px] px-1 rounded-full bg-black/75 text-white text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none"
                                        >
                                            {count}
                                        </span>
                                    </button>
                                {:else}
                                    <PoliticsCardView {card} faceDown />
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else if isMe}
                    <button
                        type="button"
                        class="relative h-[120px] aspect-[534/832] cursor-pointer"
                        aria-label="View your politics cards"
                        onmouseenter={peek}
                        onclick={peek}
                    >
                        {@render politicsCardSlot()}
                    </button>
                {:else}
                    <div
                        class="relative h-[120px] aspect-[534/832]"
                        title="{playerState.politicsCards.length} politics card{playerState.politicsCards.length ===
                        1
                            ? ''
                            : 's'}"
                    >
                        {@render politicsCardSlot()}
                    </div>
                {/if}
            {:else}
                <div class="h-[120px] aspect-[534/832] rounded-md border border-dashed border-white/25"></div>
            {/if}
        </div>
    </div>
    {#if gameSession.showDebug}
        <div class="px-3 py-1 bg-gray-900 text-gray-400 text-[10px] text-left">id: {player.id}</div>
    {/if}
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
