<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { banditWarbandImage, pawnImage, warbandImage } from '$lib/images/pieceImages.js'
    import { siteName } from '$lib/model/names.js'
    import { sitePieces } from '$lib/model/siteRule.js'
    import {
        PAWN_HEIGHT,
        PIECE_ROW_GAP,
        PIECE_ROW_HEIGHT,
        PIECE_ROW_INSET_X,
        PIECE_ROW_INSET_Y,
        SITE_SLOT_RECTS,
        WARBAND_HEIGHT,
        fitRect
    } from '$lib/definitions/boardGeometry.js'

    // R-6.5 targets a site, not a piece, so nothing here is a click target.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    const SITE_ASPECT = cardAspect({ backKind: CardKind.Site, faceDown: true })

    function banditsTitle(slotId: string, servingIds: string[]): string {
        const site = siteName(gameState, slotId)
        if (servingIds.length === 0) return `Bandits rule ${site}`
        return `Bandits serve ${servingIds.map((id) => gameSession.getPlayerName(id)).join(', ')} at ${site}`
    }

    // R-7.6.5 — bandits that act as the Crown holder's warbands keep their figure in that player's colour.
    function servedWarbandImage(servingIds: string[]): string {
        const [firstId] = servingIds
        if (firstId === undefined) return banditWarbandImage()
        return banditWarbandImage(gameSession.colors.getPlayerColor(firstId))
    }
</script>

{#each Object.entries(SITE_SLOT_RECTS) as [slotId, slot] (slotId)}
    {@const rect = fitRect(slot, SITE_ASPECT)}
    {@const pieces = sitePieces(gameState, slotId)}
    {#if pieces.warbands.length > 0 || pieces.pawns.length > 0 || pieces.bandits}
        <div
            class="piece-row"
            style="left:{rect.x + PIECE_ROW_INSET_X}px;
                   top:{rect.y + rect.height - PIECE_ROW_INSET_Y - PIECE_ROW_HEIGHT}px;
                   height:{PIECE_ROW_HEIGHT}px;
                   gap:{PIECE_ROW_GAP}px;"
        >
            {#if pieces.bandits}
                <span
                    class="warband bandits"
                    title={banditsTitle(slotId, pieces.rule.banditsServeIds)}
                >
                    <img
                        src={servedWarbandImage(pieces.rule.banditsServeIds)}
                        alt={pieces.rule.banditsServeIds.length > 0
                            ? 'Bandits serving as warbands'
                            : 'Bandits'}
                        style="height:{WARBAND_HEIGHT}px; width:auto;"
                    />
                </span>
            {/if}
            {#each pieces.warbands as [owner, count] (owner)}
                <span
                    class="warband"
                    title="{count} {gameSession.warbandOwnerName(owner)} warbands"
                >
                    <img
                        src={warbandImage(gameSession.warbandColor(owner))}
                        alt=""
                        style="height:{WARBAND_HEIGHT}px; width:auto;"
                    />
                    <span class="warband__count">{count}</span>
                </span>
            {/each}

            {#each pieces.pawns as pawn (pawn.playerId)}
                <span class="pawn-slot" title="{gameSession.getPlayerName(pawn.playerId)}'s pawn">
                    <img
                        src={pawnImage(gameSession.colors.getPlayerColor(pawn.playerId))}
                        alt=""
                        style="height:{PAWN_HEIGHT}px; width:auto;"
                    />
                </span>
            {/each}
        </div>
    {/if}
{/each}

<style>
    .piece-row {
        position: absolute;
        z-index: 5;
        display: flex;
        align-items: flex-end;
        pointer-events: none;
    }

    .warband {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        align-self: center;
        line-height: 0;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
    }

    /* Haloed rather than coloured: a seat colour can be anything from black to white. */
    .warband__count {
        position: absolute;
        right: -5px;
        bottom: -4px;
        font-size: 20px;
        font-weight: 800;
        line-height: 1;
        color: #fff;
        paint-order: stroke;
        text-shadow:
            0 0 3px rgba(0, 0, 0, 0.98),
            0 0 2px rgba(0, 0, 0, 0.98),
            0 1px 1px rgba(0, 0, 0, 0.98);
    }

    .pawn-slot {
        display: block;
        align-self: flex-end;
        line-height: 0;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
    }
</style>
