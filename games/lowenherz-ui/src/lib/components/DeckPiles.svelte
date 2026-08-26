<script lang="ts">
    import { CARD_COLUMN_WIDTH } from '$lib/model/boardMetrics.js'
    import { ActionCardFlipAnimator } from '$lib/animators/actionCardFlipAnimator.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CardBack, isAdvanceResolution } from '@tabletop/lowenherz'
    import type { ActionCardSlot } from '$lib/model/actionCardTypes.js'
    import { decisionsForSlot, playerName } from '$lib/model/actionCardHelpers.js'
    import ActionCard from './ActionCard.svelte'
    import backA from '$lib/images/action-cards/backs/back-a.jpg'
    import backB from '$lib/images/action-cards/backs/back-b.jpg'
    import backC from '$lib/images/action-cards/backs/back-c.jpg'
    import backD from '$lib/images/action-cards/backs/back-d.jpg'
    import backE from '$lib/images/action-cards/backs/back-e.jpg'

    const gameSession = getGameSession()
    const actionState = $derived(gameSession.gameState)
    // The "your move" pulse (draw pile + face-up action card) is only a training aid,
    // so it's shown just during the very first round - long enough for players to
    // learn the two spots they interact with, then it gets out of the way. A round
    // boundary is the system AdvanceResolution action stamped roundAdvanced (see
    // resolvingActions.ts); if none has happened yet, we're still in round one.
    const isFirstRound = $derived(
        !gameSession.actions.some((a) => isAdvanceResolution(a) && a.metadata?.roundAdvanced)
    )
    // Mining resolves instantly and clears currentActionCard right away (no
    // slot-picking round-trip like a standard card) - discardedActionCard is what it
    // leaves behind, and it just shows up in this same "flipped card" spot until the
    // active player manually draws the next one (see startOfTurn.ts's
    // StartOfTurnStateHandler), same as any other card would.
    const card = $derived(actionState.currentActionCard ?? actionState.discardedActionCard)
    // The pile's own back, not the just-drawn card's: actionDeck[0] is whatever a NEXT
    // draw would actually turn up, so this tracks it directly rather than falling back
    // to card?.back once nothing more urgent is available. Falling back to card?.back
    // first looked right for almost every draw - the pile hasn't changed pack since the
    // last one - but broke exactly at a pack boundary, where the just-drawn card (still
    // showing in the flipped-card slot below) is the OLD pack's last card while the
    // pile itself has already moved on to the new one's first.
    const nextCardBack = $derived(actionState.actionDeck[0]?.back)
    // How many more draws (starting with the current top card) until a new lettered
    // "pack" begins - packs are stacked in order (see actionDeckAssembly.ts) so the
    // deck is just a run of same-back cards followed by a run of the next back, etc.
    // Undefined once we're into the last pack (no next letter to count down to).
    const untilNextPack = $derived.by(() => {
        const deck = actionState.actionDeck
        if (deck.length === 0) return undefined
        const currentBack = deck[0].back
        let count = 0
        for (const deckCard of deck) {
            if (deckCard.back !== currentBack) break
            count++
        }
        if (count >= deck.length) return undefined
        return { count, nextBack: deck[count].back }
    })
    // The flip lives in an animator now (see animators/actionCardFlipAnimator), registered by the
    // {@attach} below so it is bound to this component's lifetime. It appends its tween to the
    // shared AnimationContext the session hands each listener, which is what sequences it before
    // the reactive state update instead of racing it.
    const flip = new ActionCardFlipAnimator(gameSession)

    const backImages: Record<CardBack, string> = {
        [CardBack.A]: backA,
        [CardBack.B]: backB,
        [CardBack.C]: backC,
        [CardBack.D]: backD,
        [CardBack.E]: backE
    }

    // Drives ActionCard's interactive bands - clicking a band picks that slot's
    // decision card, and each picker shows up as a colored name pill on the band.
    function slotFor(slot: 1 | 2 | 3): ActionCardSlot {
        return {
            onClick: () => gameSession.chooseAction(slot),
            // Not just "is it my turn" - a slot this player has already used this round
            // isn't clickable at all (they hold one decision card per number), so a second
            // click on it reads as inert instead of throwing.
            clickable: gameSession.canChooseSlot(slot),
            pills: decisionsForSlot(gameSession, slot).map((playerId) => ({
                playerId,
                name: playerName(gameSession, playerId),
                color: gameSession.colors.getPlayerUiColor(playerId),
                // getPlayerTextColor returns a Tailwind class name ("text-white") -
                // fine for a class attribute, but useless (and silently ignored by
                // the browser) as a raw inline style value. getPlayerTextColorValue
                // returns the actual hex color the class maps to.
                textColor: gameSession.colors.getPlayerTextColorValue(playerId)
            }))
        }
    }
</script>

{#snippet emptySlot(label: string)}
    <div
        class="aspect-[546/840] rounded-md border border-dashed border-black/30 flex items-center justify-center text-black/40 text-[10px] text-center px-1"
    >
        {label}
    </div>
{/snippet}

<!-- The action deck's two spots stack vertically (they used to sit side by side, with
     the politics piles on a second row below). One column instead of two halves this
     area's width and hands the difference straight to the board. The politics piles
     left entirely - only their counts matter turn to turn, so those moved to the side
     panel, and the piles themselves now appear over the board when someone actually
     wins politics (see SummaryStrip's highlighted count pills and PoliticsPileReveal). -->
<div class="flex flex-col gap-2" style="width: fit-content;">
    <button
        type="button"
        {@attach (el) => {
            flip.setDrawPile(el)
            return () => flip.setDrawPile(undefined)
        }}
        disabled={!gameSession.canDrawActionCard}
        onclick={() => gameSession.drawActionCard()}
        style="width: {CARD_COLUMN_WIDTH}px;" class="relative shadow-[0_4px_10px_rgba(0,0,0,0.35)] {gameSession.canDrawActionCard
            ? 'cursor-pointer hover:brightness-95'
            : ''} {gameSession.canDrawActionCard && isFirstRound ? 'draw-pile-glow' : ''}"
    >
        {#if nextCardBack}
            <img
                src={backImages[nextCardBack]}
                alt="Deck {nextCardBack}"
                class="w-full rounded-md shadow-md"
            />
        {:else}
            {@render emptySlot('deck')}
        {/if}
        {#if untilNextPack}
            <div
                class="absolute bottom-[8%] inset-x-0 text-center text-[28px] text-black/80 leading-none"
            >
                {untilNextPack.count} until <span class="pack-letter">{untilNextPack.nextBack}</span>
            </div>
        {/if}
    </button>
    <div
        class="rounded-md {gameSession.canChooseAction && isFirstRound
            ? 'action-card-glow'
            : 'shadow-[0_4px_10px_rgba(0,0,0,0.35)]'}"
        style="width: {CARD_COLUMN_WIDTH}px; perspective: 900px;"
        {@attach attachAnimator(flip)}
        {@attach (el) => {
            flip.setSlot(el)
            return () => flip.setSlot(undefined)
        }}
    >
        {#if flip.flippingCard}
            {@const flippingCard = flip.flippingCard}
            <div
                {@attach (el) => {
                    flip.setNode(el)
                    return () => flip.setNode(undefined)
                }}
                class="relative w-full aspect-[546/840] pointer-events-none"
                style="transform-style: preserve-3d;"
            >
                <div class="absolute inset-0" style="backface-visibility: hidden;">
                    <img
                        src={backImages[flippingCard.back]}
                        alt="Deck {flippingCard.back}"
                        class="w-full h-full rounded-md shadow-md object-cover"
                    />
                </div>
                <div class="absolute inset-0" style="backface-visibility: hidden; transform: rotateY(180deg);">
                    <ActionCard
                        card={flippingCard}
                        slots={{ top: slotFor(1), middle: slotFor(2), bottom: slotFor(3) }}
                    />
                </div>
            </div>
        {:else if card}
            <ActionCard {card} slots={{ top: slotFor(1), middle: slotFor(2), bottom: slotFor(3) }} />
        {:else}
            {@render emptySlot('')}
        {/if}
    </div>
</div>

<style>
    /* A gentle "your move" pulse on the draw pile whenever it's actually drawable
       (the same moment the status text reads "Click the action card draw pile...").
       Deliberately soft/slow so it reads as an invitation, not an alarm. */
    @keyframes pink-glow-pulse {
        0%,
        100% {
            box-shadow:
                0 4px 10px rgba(0, 0, 0, 0.35),
                0 0 4px 1px rgba(236, 72, 153, 0.11);
        }
        50% {
            box-shadow:
                0 4px 10px rgba(0, 0, 0, 0.35),
                0 0 14px 3px rgba(236, 72, 153, 0.23);
        }
    }

    /* Same gentle pink "your move" pulse, shared by the draw pile (time to draw)
       and the face-up action card (time to pick a region/action on it) - kept subtle
       and slow so it reads as a soft invitation rather than an alarm. */
    .draw-pile-glow,
    .action-card-glow {
        border-radius: 0.375rem; /* matches the card art's own rounded-md corners */
        animation: pink-glow-pulse 3.6s ease-in-out infinite;
    }
</style>
