<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CardBack } from '@tabletop/lowenherz'
    import type { ActionCardSlot } from '$lib/model/actionCardTypes.js'
    import { decisionsForSlot, playerName } from '$lib/model/actionCardHelpers.js'
    import ActionCard from './ActionCard.svelte'
    import PoliticsCard from './PoliticsCard.svelte'
    import backA from '$lib/images/action-cards/backs/back-a.jpg'
    import backB from '$lib/images/action-cards/backs/back-b.jpg'
    import backC from '$lib/images/action-cards/backs/back-c.jpg'
    import backD from '$lib/images/action-cards/backs/back-d.jpg'
    import backE from '$lib/images/action-cards/backs/back-e.jpg'

    const gameSession = getGameSession()
    const actionState = $derived(gameSession.gameState)
    const card = $derived(actionState.currentActionCard)
    // Before the very first draw (and briefly between rounds), currentActionCard is
    // unset - show the back of whatever's actually on top of the deck instead of a
    // blank placeholder, so the correct back (A/B/etc.) is visible before it's ever
    // clicked.
    const nextCardBack = $derived(card?.back ?? actionState.actionDeck[0]?.back)
    const pileA = $derived(actionState.politicsCardPileA)
    const pileB = $derived(actionState.politicsCardPileB)

    // While it's my turn and I haven't picked a pile yet, either one is selectable -
    // the rulebook lets you look through just one, so once picked, the OTHER pile
    // stops being clickable. The chosen pile itself stays clickable though, so a
    // player who hid the fanned view (see PoliticsHand) can bring the same pile back
    // up - that's not "backing out," just re-showing what they already committed to.
    function canSelectPile(pile: 'A' | 'B'): boolean {
        if (!gameSession.canTakePoliticsCard) return false
        return !gameSession.selectedPoliticsPile || gameSession.selectedPoliticsPile === pile
    }

    // Feeds PoliticsHand's "deal" animation - the cards fly out from wherever the
    // pile button actually is on screen, so it needs the button's real viewport
    // position at click time, not just which pile was picked.
    function onPileClick(pile: 'A' | 'B', event: MouseEvent) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

        if (gameSession.selectedPoliticsPile === pile) {
            gameSession.revealPoliticsHand(origin)
        } else {
            gameSession.selectPoliticsPile(pile, origin)
        }
    }

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
            clickable: gameSession.canChooseAction,
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

{#snippet countBadge(count: number)}
    {#if count > 0}
        <span
            class="absolute inset-0 flex items-center justify-center text-white font-bold pointer-events-none"
            style="font-size: 66px; line-height: 1; text-shadow: 0 0 8px rgba(0, 0, 0, 0.85), 0 0 16px rgba(0, 0, 0, 0.6);"
        >
            {count}
        </span>
    {/if}
{/snippet}

<div class="grid grid-cols-2 gap-2" style="width: fit-content;">
    <button
        type="button"
        disabled={!gameSession.canDrawActionCard}
        onclick={() => gameSession.drawActionCard()}
        class="w-[106px] {gameSession.canDrawActionCard ? 'cursor-pointer hover:brightness-95' : ''}"
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
    </button>
    <div class="w-[106px]">
        {#if card}
            <ActionCard {card} slots={{ top: slotFor(1), middle: slotFor(2), bottom: slotFor(3) }} />
        {:else}
            {@render emptySlot('')}
        {/if}
    </div>
    <button
        type="button"
        disabled={!canSelectPile('A')}
        onclick={(e) => onPileClick('A', e)}
        class="w-[106px] relative {canSelectPile('A') ? 'cursor-pointer hover:brightness-95' : ''}"
    >
        {#if pileA.length > 0}
            <PoliticsCard card={pileA[0]} faceDown />
        {:else}
            {@render emptySlot('empty')}
        {/if}
        {@render countBadge(pileA.length)}
    </button>
    <button
        type="button"
        disabled={!canSelectPile('B')}
        onclick={(e) => onPileClick('B', e)}
        class="w-[106px] relative {canSelectPile('B') ? 'cursor-pointer hover:brightness-95' : ''}"
    >
        {#if pileB.length > 0}
            <PoliticsCard card={pileB[0]} faceDown />
        {:else}
            {@render emptySlot('empty')}
        {/if}
        {@render countBadge(pileB.length)}
    </button>
</div>
