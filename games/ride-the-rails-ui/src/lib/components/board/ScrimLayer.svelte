<script lang="ts">
    import type { HexId, RailroadId } from '@tabletop/ride-the-rails'
    import type { BoardOffer } from '$lib/model/boardOffer.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexPoints } from '$lib/utils/boardGeometry.js'
    import { locomotivePieces, railroadStarts } from '$lib/utils/boardPieces.js'
    import {
        BOARD_OUTLINE_PATH,
        insetHexPoints,
        scrimPath,
        spotlightMode
    } from '$lib/utils/pickMarks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import Locomotive from './Locomotive.svelte'

    let { offer, spotlight }: { offer: BoardOffer; spotlight: RailroadId | undefined } = $props()

    const gameSession = getGameSession()

    const mode = $derived(spotlightMode(offer, spotlight))
    const spotlit = $derived(
        spotlight
            ? locomotivePieces(gameSession.gameState.track).filter(
                  (piece) => piece.railroadId === spotlight
              )
            : []
    )
    const spotlitHexes: HexId[] = $derived([...new Set(spotlit.map((piece) => piece.hexId))])
    const startHexIds: HexId[] = $derived(
        spotlight ? (railroadStarts(gameSession.actions).get(spotlight) ?? []) : []
    )
    const colour = $derived(spotlight ? railroadStyle(spotlight).fill : 'transparent')
</script>

<!-- Contract, Pick conventions: a plain translucent fill with holes, never an opacity effect. -->
<g class="scrim" aria-hidden="true">
    {#if offer.scrim}
        <path d={scrimPath(offer.scrim.holes)} fill="var(--rtr-scrim)" fill-rule="evenodd"></path>
    {/if}
    {#if mode === 'dim'}
        <path d={BOARD_OUTLINE_PATH} fill="var(--rtr-scrim)"></path>
        {#each spotlit as piece (piece.key)}
            <Locomotive
                railroadId={piece.railroadId}
                x={piece.slot.x}
                y={piece.slot.y}
                width={piece.slot.width}
            />
        {/each}
        {#each startHexIds as startHexId (startHexId)}
            <polygon
                points={hexPoints(startHexId)}
                fill="none"
                stroke="var(--rtr-halo)"
                stroke-width="2"
            ></polygon>
            <polygon
                points={insetHexPoints(startHexId, 2.8)}
                fill="none"
                stroke={colour}
                stroke-width="4.4"
            ></polygon>
        {/each}
    {:else if mode === 'outline'}
        {#each spotlitHexes as hexId (hexId)}
            <polygon
                points={insetHexPoints(hexId, 1.2)}
                fill="none"
                stroke={colour}
                stroke-width="2.8"
                stroke-dasharray="6 4"
            ></polygon>
        {/each}
    {/if}
</g>
