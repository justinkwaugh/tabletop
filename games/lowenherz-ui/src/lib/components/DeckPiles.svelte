<script lang="ts">
    import { onMount, tick } from 'svelte'
    import { gsap } from 'gsap'
    import type { GameAction } from '@tabletop/common'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import type { HydratedLowenherzGameState } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CardBack,
        isAdvanceResolution,
        isDrawActionCard,
        type ActionCard as ActionCardData
    } from '@tabletop/lowenherz'
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
    // Plays a 3D flip (back design -> the actual card face) as a freshly drawn card travels from
    // the draw pile into the middle slot, rather than having it just appear.
    //
    // This runs on the harness's shared AnimationContext (see
    // libs/frontend-components/src/lib/utils/ANIMATION_PATTERN.md), which is what makes the timing
    // reliable: the session gathers every listener's tweens, plays the timeline, and only THEN
    // assigns the new reactive state. The flip is therefore sequenced before the board changes
    // underneath it, instead of being fired off with a CSS transition and racing the re-render -
    // which is what the old `setTimeout(..., 20)` was really compensating for. It waited for the
    // node to mount, and the node only mounted once state had already landed.
    let drawPileEl: HTMLElement | undefined = $state()
    let middleSlotEl: HTMLElement | undefined = $state()
    let flipNode: HTMLElement | undefined = $state()

    const FLIP_DURATION_S = 0.48

    // Pattern C, pre-reactivity override: the card being flipped comes from the action's own `to`
    // state, because for the whole length of the flip the derived `card` below is still the
    // PREVIOUS one. Nothing clears this - it stops being rendered the moment reactive state
    // catches up and `card.id` matches, which is the pattern's "let state naturally supersede it".
    let flippingCard: ActionCardData | undefined = $state(undefined)

    async function flipInDrawnCard(drawn: ActionCardData, animationContext: AnimationContext) {
        // Pattern B, new item: write the transient presence state, await the mount, resolve the
        // node, tween the node itself. No per-frame reactive writes - gsap owns the motion.
        flippingCard = drawn
        await tick()
        if (!flipNode) {
            // Nothing to tween means nothing to show: leaving the override in place would park a
            // static card back over the slot until reactive state caught up.
            flippingCard = undefined
            return
        }

        // The draw pile and the middle slot are both fixed in place (this grid never reflows), so
        // their offset only needs measuring once, as the flip starts - it makes the card travel
        // from one to the other instead of flipping in place.
        let dx = 0
        let dy = 0
        if (drawPileEl && middleSlotEl) {
            const fromRect = drawPileEl.getBoundingClientRect()
            const toRect = middleSlotEl.getBoundingClientRect()
            dx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2)
            dy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2)
        }

        gsap.set(flipNode, { x: dx, y: dy, rotationY: 0, transformOrigin: 'center center' })
        animationContext.actionTimeline.to(
            flipNode,
            { x: 0, y: 0, rotationY: 180, duration: FLIP_DURATION_S, ease: 'power2.out' },
            0
        )
    }

    onMount(() => {
        // Driven by the per-action listener rather than by watching card?.id: the session says
        // which action was just applied, so "a new card was drawn" is something we are told rather
        // than inferred by diffing - which is what the old baselineRecorded/previousCardId pair was
        // for (avoiding a replay of the flip for the card already on the table at mount, and a
        // re-flip when the history controls rewound and regrew the action list).
        const listener = async ({
            action,
            to,
            animationContext
        }: {
            action?: GameAction
            to: HydratedLowenherzGameState
            animationContext: AnimationContext
        }) => {
            if (!action || gameSession.isViewingHistory) return
            if (!isDrawActionCard(action)) return
            const drawn = to.currentActionCard
            if (drawn) await flipInDrawnCard(drawn, animationContext)
        }

        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
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
        {#if flippingCard && flippingCard.id !== card?.id}
            <div
                bind:this={flipNode}
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
