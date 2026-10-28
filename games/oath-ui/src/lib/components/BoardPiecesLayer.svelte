<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { pawnImage, siteBanditsImage, warbandImage } from '$lib/images/pieceImages.js'
    import { sitePieces, type SiteRule } from '$lib/model/siteRule.js'
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

    const SITE_ASPECT = cardAspect({ back: CardKind.Site })

    // R-7.6.5 — the figure's name says what its colour says; the enlarged site names the holder.
    function banditsName(rule: SiteRule): string {
        if (rule.banditsImperial) return 'Bandits serving as Imperial warbands'
        return rule.banditsHolderId === undefined ? 'Bandits' : 'Bandits serving as warbands'
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
                <span class="warband bandits">
                    <img
                        src={siteBanditsImage(pieces.rule, (id) =>
                            gameSession.colors.getPlayerColor(id)
                        )}
                        alt={banditsName(pieces.rule)}
                        style="height:{WARBAND_HEIGHT}px; width:auto;"
                    />
                    <!-- R-2.8.3 — the usual 1 goes unsaid; Bandit Chief's 3 wears the warbands' badge. -->
                    {#if pieces.banditCount !== 1}
                        <span class="warband__count">{pieces.banditCount}</span>
                    {/if}
                </span>
            {/if}
            {#each pieces.warbands as [owner, count] (owner)}
                <span class="warband">
                    <img
                        src={warbandImage(gameSession.warbandColor(owner))}
                        alt=""
                        style="height:{WARBAND_HEIGHT}px; width:auto;"
                    />
                    <span class="warband__count">{count}</span>
                </span>
            {/each}

            {#each pieces.pawns as pawn (pawn.playerId)}
                <span class="pawn-slot">
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
