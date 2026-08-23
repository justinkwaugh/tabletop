<script lang="ts">
    import { onMount } from 'svelte'
    import type { GameAction } from '@tabletop/common'
    import type { HydratedLowenherzGameState } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CardBack, isAdvanceResolution, isDrawActionCard } from '@tabletop/lowenherz'
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
    // Before the very first draw (and briefly between rounds), currentActionCard is
    // unset - show the back of whatever's actually on top of the deck instead of a
    // blank placeholder, so the correct back (A/B/etc.) is visible before it's ever
    // clicked.
    const nextCardBack = $derived(card?.back ?? actionState.actionDeck[0]?.back)
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
    // Plays a 3D flip (back design -> the actual card face) the moment a freshly
    // drawn card shows up in the middle slot, rather than having it just appear.
    // Only fires for an actual draw, not for the card that's already sitting there
    // when this component first mounts (e.g. rejoining a game in progress) - the
    // very first effect run just records that starting card as a baseline (whatever
    // it is, even undefined) without animating; every run after that compares
    // against the baseline, so an id change is unambiguously a fresh draw,
    // including the very first draw of a brand new game.
    let flippingCardId: string | undefined = $state(undefined)
    let flipped = $state(false)

    // The draw pile button and the middle slot are both fixed in place (this grid
    // never reflows), so their on-screen offset from each other only needs
    // measuring once, right as a flip starts - used to make the flip travel from
    // one to the other instead of just flipping in place.
    let drawPileEl: HTMLElement | undefined = $state()
    let middleSlotEl: HTMLElement | undefined = $state()
    let flipDx = $state(0)
    let flipDy = $state(0)

    const FLIP_DURATION = 480 // ms

    // Driven by the per-action listener rather than by watching card?.id. The session says which
    // action was just applied, so "a new card was drawn" is something we are told rather than
    // something inferred by diffing - which is what baselineRecorded and previousCardId were for:
    // bookkeeping to avoid replaying the flip for the card already on the table at mount, and to
    // avoid re-flipping when the history controls rewind and replay the list. Both are gone.
    let flipTimers: ReturnType<typeof setTimeout>[] = []

    function flipInDrawnCard(cardId: string) {
        flippingCardId = cardId
        flipped = false

        if (drawPileEl && middleSlotEl) {
            const fromRect = drawPileEl.getBoundingClientRect()
            const toRect = middleSlotEl.getBoundingClientRect()
            flipDx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2)
            flipDy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2)
        } else {
            flipDx = 0
            flipDy = 0
        }

        flipTimers.forEach(clearTimeout)
        flipTimers = [
            setTimeout(() => {
                flipped = true
            }, 20),
            setTimeout(() => {
                flippingCardId = undefined
            }, FLIP_DURATION + 40)
        ]
    }

    onMount(() => {
        // `to` is the state this action produced. gameSession.gameState is NOT that yet - the
        // session calls its listeners and only then assigns the exposed state - so reading it here
        // returns the PREVIOUS card, flippingCardId never matched the card being rendered, and the
        // flip silently did nothing.
        const listener = async ({
            action,
            to
        }: {
            action?: GameAction
            to: HydratedLowenherzGameState
        }) => {
            if (!action || gameSession.isViewingHistory) return
            if (!isDrawActionCard(action)) return
            const drawn = to.currentActionCard?.id
            if (drawn) flipInDrawnCard(drawn)
        }

        gameSession.addGameStateChangeListener(listener)
        return () => {
            gameSession.removeGameStateChangeListener(listener)
            flipTimers.forEach(clearTimeout)
        }
    })

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
     wins politics (see PoliticsPileOverlay). -->
<div class="flex flex-col gap-2" style="width: fit-content;">
    <button
        type="button"
        bind:this={drawPileEl}
        disabled={!gameSession.canDrawActionCard}
        onclick={() => gameSession.drawActionCard()}
        class="w-[106px] relative shadow-[0_4px_10px_rgba(0,0,0,0.35)] {gameSession.canDrawActionCard
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
                class="absolute bottom-[8%] inset-x-0 text-center text-[14px] text-black/80 leading-none"
            >
                {untilNextPack.count} until <span class="pack-letter">{untilNextPack.nextBack}</span>
            </div>
        {/if}
    </button>
    <div
        class="w-[106px] rounded-md {gameSession.canChooseAction && isFirstRound
            ? 'action-card-glow'
            : 'shadow-[0_4px_10px_rgba(0,0,0,0.35)]'}"
        style="perspective: 900px;"
        bind:this={middleSlotEl}
    >
        {#if card}
            {#if flippingCardId === card.id}
                <div
                    class="relative w-full aspect-[546/840] pointer-events-none transition-transform ease-out"
                    style="
                        transform-style: preserve-3d;
                        transform: translate({flipped ? 0 : flipDx}px, {flipped ? 0 : flipDy}px)
                            rotateY({flipped ? 180 : 0}deg);
                        transition-duration: {FLIP_DURATION}ms;
                    "
                >
                    <div class="absolute inset-0" style="backface-visibility: hidden;">
                        <img
                            src={backImages[card.back]}
                            alt="Deck {card.back}"
                            class="w-full h-full rounded-md shadow-md object-cover"
                        />
                    </div>
                    <div class="absolute inset-0" style="backface-visibility: hidden; transform: rotateY(180deg);">
                        <ActionCard {card} slots={{ top: slotFor(1), middle: slotFor(2), bottom: slotFor(3) }} />
                    </div>
                </div>
            {:else}
                <ActionCard {card} slots={{ top: slotFor(1), middle: slotFor(2), bottom: slotFor(3) }} />
            {/if}
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
