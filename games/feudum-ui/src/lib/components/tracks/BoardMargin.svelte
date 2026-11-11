<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { Goods, VesselTypes, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import ArcheryTarget from '$lib/components/pieces/ArcheryTarget.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import { PlainChrome, dimmedWithRest, type BoardChrome } from '$lib/model/boardChrome.js'
    import { deckView, influencePools } from '$lib/model/boardView.js'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { writName } from '$lib/model/writLabels.js'
    import {
        BoardWidth,
        HaversackStep,
        InfluenceStep,
        MarginHeight,
        MarginSlots,
        MarginToken,
        MarginTop,
        VesselCountStep
    } from '$lib/utils/boardGeometry.js'
    import { wrapLines } from '$lib/utils/cardShape.js'
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import { SackPath } from '$lib/utils/trackShape.js'

    /**
     * Below the board. R-5.1 The writ deck's count, R-4.4.2 the writs the table saw go under as a
     * "seen" note, and R-4.4.1 what only the viewer knows lies there. R-5.4-H1 The haversack's counts.
     * R-1.4.2 The supply counts that bind play. R-3.2 The start-player marker. A press on the deck
     * opens its stack view (contract: Card preview).
     */
    let {
        state,
        viewerId,
        paintOf,
        colourPaintOf,
        chrome = PlainChrome
    }: {
        state: HydratedFeudumGameState
        viewerId?: string
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        chrome?: BoardChrome
    } = $props()

    const DeckBacks = [0, 1, 2]
    const DeckBackWidth = 58
    const SeenNoteWidth = 58
    const Half = MarginToken / 2
    const LabelY = -30
    const CountY = 32

    let deck = $derived(deckView(state, viewerId))
    let seenLines = $derived(
        deck.seen.length
            ? wrapLines(`seen: ${deck.seen.map(writName).join(', ')}`, SeenNoteWidth)
            : []
    )
    let influence = $derived(
        influencePools(state).map(({ colour, count, playerId }) => ({
            colour,
            count,
            paint: playerId ? paintOf(playerId) : colourPaintOf(colour)
        }))
    )
</script>

{#snippet count(x: number, y: number, value: string | number, kind: string)}
    <text
        {x}
        {y}
        text-anchor="middle"
        font-size="20"
        font-weight="700"
        fill="var(--feudum-text)"
        data-margin={kind}>{value}</text
    >
{/snippet}

{#snippet label(x: number, y: number, name: string)}
    <text {x} {y} text-anchor="middle" font-size="16" fill="var(--feudum-text-muted)">{name}</text>
{/snippet}

<g data-margin-layer opacity={dimmedWithRest(chrome)} style:font-family="var(--feudum-font-text)">
    <rect
        x="0"
        y={MarginTop}
        width={BoardWidth}
        height={MarginHeight}
        fill="var(--feudum-surface-raised)"
    ></rect>

    <g transform="translate({MarginSlots.deck.x} {MarginSlots.deck.y})" data-deck={deck.count}>
        {#each DeckBacks as back (back)}
            <WritFace
                faceShown={false}
                width={DeckBackWidth}
                x={-40 + back * 4}
                y={-58 + back * 3}
            />
        {/each}
        <text x="40" y="-20" font-size="20" fill="var(--feudum-text)" data-margin="deck-count"
            >{deck.count} writs</text
        >
        {#each seenLines as line, index (index)}
            <text
                x="40"
                y={2 + index * 20}
                font-size="16"
                fill="var(--feudum-text-muted)"
                data-margin="deck-seen">{line}</text
            >
        {/each}
        {#if deck.knownToViewer > 0}
            <text
                x="40"
                y={2 + seenLines.length * 20}
                font-size="16"
                fill="var(--feudum-text-muted)"
                data-margin="deck-known">you know {deck.knownToViewer} under the deck</text
            >
        {/if}
        {#if chrome.openStack}
            <rect
                x={-40}
                y={-58}
                width={DeckBackWidth + 8}
                height={100}
                fill="transparent"
                role="button"
                tabindex="0"
                aria-label="Open the writ deck"
                pointer-events="all"
                cursor="zoom-in"
                data-open-stack="deck"
                onclick={() => chrome.openStack?.({ kind: 'deck' })}
                onkeydown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        chrome.openStack?.({ kind: 'deck' })
                    }
                }}
            ></rect>
        {/if}
    </g>

    <g transform="translate({MarginSlots.haversack.x} {MarginSlots.haversack.y})">
        <svg x={-70} y={-24} width="48" height="48" viewBox="0 0 24 24" data-sack>
            <path d={SackPath} fill="var(--feudum-wood-piece)" stroke="var(--feudum-wood-dark)"
            ></path>
        </svg>
        {@render label(-46, LabelY - 6, 'Haversack')}
        {#each Goods as good, index (good)}
            {@const x = index * HaversackStep}
            <GoodToken {good} size={MarginToken} x={x - Half} y={-Half} />
            {@render count(x, CountY, state.supply.haversack[good], `haversack-${good}`)}
        {/each}
    </g>

    <g transform="translate({MarginSlots.seals.x} {MarginSlots.seals.y})">
        {@render label(0, LabelY, 'Seals')}
        <SealFace faceShown={sealFaceShown(false)} size={MarginToken} x={-Half} y={-Half} />
        {@render count(0, CountY, state.supply.sealPileCount, 'seals')}
    </g>

    <g transform="translate({MarginSlots.vessels.x} {MarginSlots.vessels.y})">
        {@render label(VesselCountStep, LabelY, 'Vessels')}
        {#each VesselTypes as vessel, index (vessel)}
            {@const x = index * VesselCountStep}
            <VesselToken {vessel} size={MarginToken} x={x - Half} y={-Half} />
            {@render count(x, CountY, state.supply.vessels[vessel], `vessels-${vessel}`)}
        {/each}
    </g>

    <g transform="translate({MarginSlots.targets.x} {MarginSlots.targets.y})">
        {@render label(0, LabelY, 'Targets')}
        <ArcheryTarget size={MarginToken} x={-Half} y={-Half} />
        {@render count(0, CountY, state.supply.targets, 'targets')}
    </g>

    <g transform="translate({MarginSlots.discs.x} {MarginSlots.discs.y})">
        {@render label(0, LabelY, 'Discs')}
        <circle r={Half - 2} fill="var(--feudum-disc-outpost)" stroke="var(--feudum-map-ink)"
        ></circle>
        {@render count(0, CountY, state.supply.discs.length, 'discs')}
    </g>

    <g transform="translate({MarginSlots.influence.x} {MarginSlots.influence.y})">
        {@render label((InfluenceStep * (influence.length - 1)) / 2, LabelY, 'Influence')}
        {#each influence as row, index (row.colour)}
            {@const x = index * InfluenceStep}
            <SeatToken kind="marker" paint={row.paint} size={MarginToken} x={x - Half} y={-Half} />
            {@render count(x, CountY, row.count, `influence-${row.colour}`)}
        {/each}
    </g>

    <BoardPiece at={MarginSlots.startPlayer} piece="start-player">
        <g role="img" aria-label="start-player marker" data-start-player={state.startingPlayerId}>
            <title>Start player</title>
            {@render label(0, LabelY - 6, 'Start')}
            <rect
                x="-26"
                y="-22"
                width="52"
                height="44"
                rx="6"
                fill="var(--feudum-wood-piece)"
                stroke="var(--feudum-wood-dark)"
            ></rect>
            <svg x="-24" y="-20" width="24" height="24" viewBox="0 0 24 24">
                <path d={CrownPath} fill="var(--feudum-accent)" stroke="var(--feudum-ink)"></path>
            </svg>
            <SeatToken
                kind="disc"
                paint={paintOf(state.startingPlayerId)}
                size={26}
                x={0}
                y={-10}
            />
        </g>
    </BoardPiece>
</g>
