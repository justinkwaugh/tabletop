<script lang="ts">
    import { range, type BoundingBox } from '@tabletop/common'
    import { CardKind, effectiveSiteCapacity, siteRevealPrompt } from '@tabletop/oath'
    import BoardCard from '$lib/components/BoardCard.svelte'
    import TokenPair from '$lib/components/TokenPair.svelte'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CARD_STRIP_RECTS,
        SITE_TOKEN_RADIUS,
        stripLayout
    } from '$lib/definitions/boardGeometry.js'

    // R-2.8.1, R-2.8.2 — empty spaces are drawn, since R-5.2.1, R-5.3.2 and R-7.2.1 turn on one.
    // A facedown site shows none: its counts are on its front (R-9.4).
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    let selectableCardIds = $derived(gameSession.selectableCards)
    let selectableRelicSlotIds = $derived(gameSession.selectableRelicSlots)

    type Space =
        | { kind: 'denizen'; cardId?: string; pickable: boolean }
        | { kind: 'relic'; slotId?: string; cardId?: string; pickable: boolean }

    function spacesFor(slotId: string): Space[] {
        const siteCardId = gameState.siteCardAt(slotId)
        if (!siteCardId || !gameState.isSiteFaceup(slotId)) return []

        const cards = gameState.denizensBySite[slotId] ?? []
        const relicSlots = gameState.relicSlotsAt(slotId)

        const capacity = Math.max(effectiveSiteCapacity(gameState, slotId), cards.length)
        const relicSpaces = Math.max(siteRevealPrompt(siteCardId)?.relics ?? 0, relicSlots.length)

        const denizens: Space[] = range(0, capacity).map((index) => {
            const cardId = cards[index]
            return {
                kind: 'denizen',
                cardId,
                pickable: cardId !== undefined && selectableCardIds.includes(cardId)
            }
        })

        // R-2.8.2 — relics sit facedown; only this player's own peek names one.
        const relics: Space[] = range(0, relicSpaces).map((index) => {
            const slot = relicSlots[index]
            return {
                kind: 'relic',
                slotId: slot?.slotId,
                cardId: gameSession.knownRelicAt(slot?.slotId),
                pickable: slot !== undefined && selectableRelicSlotIds.includes(slot.slotId)
            }
        })

        return [...denizens, ...relics]
    }

    // A card that leaves its space unmounts, which ends the preview it opened.
    function spaceKey(slotId: string, space: Space, index: number): string {
        if (space.kind === 'denizen') return space.cardId ?? `${slotId}:denizen:${index}`
        return space.slotId ?? `${slotId}:relic:${index}`
    }

    function layoutFor(slotId: string, strip: BoundingBox, spaces: Space[]) {
        return stripLayout(strip, spaces).map((placed, index) => ({
            ...placed,
            key: spaceKey(slotId, placed.space, index)
        }))
    }
</script>

{#each Object.entries(CARD_STRIP_RECTS) as [slotId, strip] (slotId)}
    {#each layoutFor(slotId, strip, spacesFor(slotId)) as placed (placed.key)}
        {@const space = placed.space}
        {@const box = `left:${placed.x}px; top:${placed.y}px;
                       width:${placed.width}px; height:${placed.height}px;`}
        {#if space.kind === 'relic'}
            {#if space.slotId === undefined}
                <span class="space space--relic" title="Empty relic space" style={box}></span>
            {:else}
                {@const relicSlotId = space.slotId}
                <BoardCard
                    cardId={space.cardId}
                    faceDown={space.cardId === undefined}
                    backKind={CardKind.Relic}
                    label={space.cardId ? cardName(space.cardId) : 'Facedown relic'}
                    x={placed.x}
                    y={placed.y}
                    width={placed.width}
                    zIndex={placed.zIndex}
                    pickable={space.pickable}
                    onpick={() => gameSession.chooseRelicSlot(relicSlotId)}
                />
            {/if}
        {:else if space.cardId === undefined}
            <span class="space space--denizen" title="Empty denizen space" style={box}></span>
        {:else}
            {@const denizenCardId = space.cardId}
            {@const tokens = gameState.tokensOn(denizenCardId)}
            <BoardCard
                cardId={denizenCardId}
                label={cardName(denizenCardId)}
                x={placed.x}
                y={placed.y}
                width={placed.width}
                zIndex={placed.zIndex}
                pickable={space.pickable}
                onpick={() => gameSession.chooseCard(denizenCardId)}
            />
            {#if tokens.favor > 0 || tokens.secrets > 0}
                <!-- R-7.1.2 — favor and secrets on the card, which R-7.1.2.a's occupancy reads. -->
                <span
                    class="card-tokens"
                    style="left:{placed.x +
                        placed.width -
                        SITE_TOKEN_RADIUS -
                        10}px; top:{placed.y - SITE_TOKEN_RADIUS + 6}px; z-index:{placed.zIndex +
                        200};"
                >
                    <TokenPair
                        favor={tokens.favor}
                        secrets={tokens.secrets}
                        size={SITE_TOKEN_RADIUS * 2}
                        on={cardName(denizenCardId)}
                    />
                </span>
            {/if}
        {/if}
    {/each}
{/each}

<style>
    /* An empty space is an outline, not a back: a back would say a card is there. */
    .space {
        position: absolute;
        border-radius: 5px;
        border: 3px solid rgba(255, 255, 255, 0.85);
        background: rgba(12, 10, 9, 0.12);
        box-shadow: 0 0 6px rgba(0, 0, 0, 0.35);
        pointer-events: none;
    }

    .card-tokens {
        position: absolute;
        display: flex;
        gap: 3px;
        pointer-events: none;
    }

    .space--relic {
        border-radius: 50%;
        border-color: rgba(255, 255, 255, 0.85);
    }
</style>
