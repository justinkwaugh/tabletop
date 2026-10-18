<script lang="ts">
    import { Side, UnitType, type Face } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        DISPLAY_SLOT_HEIGHT,
        DISPLAY_SLOT_WIDTH,
        displayPanel,
        displaySlot,
        displaySlotCount,
        displayedFaces
    } from '$lib/utils/armyDisplay.js'

    interface BlockPaint {
        face: string
        bevel: string
        edge: string
    }

    interface DisplayPaint {
        standing: BlockPaint
        eliminated: BlockPaint
    }

    const gameSession = getGameSession()

    // Sampled from the printed displays.
    const PANEL = '#f7fbfa'
    const SYMBOL = '#ffffff'
    const PAINT: Record<Side, DisplayPaint> = {
        [Side.French]: {
            standing: { face: '#0167ab', bevel: '#014f82', edge: '#00263f' },
            eliminated: { face: '#d3e3ee', bevel: '#d3e3ee', edge: '#9fb9cc' }
        },
        [Side.Allied]: {
            standing: { face: '#ad2f29', bevel: '#82231f', edge: '#3d100e' },
            eliminated: { face: '#efd7d4', bevel: '#efd7d4', edge: '#cfa29d' }
        }
    }

    const W = DISPLAY_SLOT_WIDTH
    const H = DISPLAY_SLOT_HEIGHT
    const BEVEL = 2.6
    const EDGE = 0.7
    const SYMBOL_WIDTH = 12.75
    const SYMBOL_HEIGHT = 18.4
    const SYMBOL_GAP = 2.6
    const SYMBOL_LINE = 0.75
    const DOT_RADIUS = 3.3
    const OUTLINE = `0,0 ${W - BEVEL},0 ${W},${BEVEL} ${W},${H} ${BEVEL},${H} 0,${H - BEVEL}`

    const displays = $derived(
        gameSession.gameState.players.flatMap((player) =>
            player.side && player.armyDisplay
                ? [{ side: player.side, faces: displayedFaces(player.armyDisplay) }]
                : []
        )
    )

    function slotTransform(side: Side, index: number): string {
        const { x, y } = displaySlot(side, index)
        return side === Side.French
            ? `translate(${x} ${y})`
            : `translate(${x} ${y}) rotate(180 ${W / 2} ${H / 2})`
    }

    function symbolTops(strength: number): number[] {
        const stack = strength * SYMBOL_HEIGHT + (strength - 1) * SYMBOL_GAP
        const top = (H - BEVEL - stack) / 2
        return Array.from(
            { length: strength },
            (_, index) => top + index * (SYMBOL_HEIGHT + SYMBOL_GAP)
        )
    }
</script>

{#snippet block(paint: BlockPaint)}
    <polygon points={OUTLINE} fill={paint.bevel} stroke={paint.edge} stroke-width={EDGE}></polygon>
    <line x1={W - BEVEL} y1={H - BEVEL} x2={W} y2={H} stroke={paint.edge} stroke-width={EDGE}
    ></line>
    <rect
        width={W - BEVEL}
        height={H - BEVEL}
        fill={paint.face}
        stroke={paint.edge}
        stroke-width={EDGE}
    ></rect>
{/snippet}

{#snippet symbol(face: Face, top: number, ground: string)}
    {@const left = (W - BEVEL - SYMBOL_WIDTH) / 2}
    {@const right = left + SYMBOL_WIDTH}
    {@const bottom = top + SYMBOL_HEIGHT}
    {@const middle = top + SYMBOL_HEIGHT / 2}
    {@const centre = left + SYMBOL_WIDTH / 2}
    <rect
        x={left}
        y={top}
        width={SYMBOL_WIDTH}
        height={SYMBOL_HEIGHT}
        fill={face.guard ? SYMBOL : ground}
        stroke={SYMBOL}
        stroke-width={SYMBOL_LINE}
    ></rect>
    {#if face.guard}
        <path
            d="M{left} {top} L{right} {bottom} M{right} {top} L{left} {bottom}"
            stroke={ground}
            stroke-width={SYMBOL_LINE * 1.4}
        ></path>
    {:else if face.type === UnitType.Infantry}
        <polygon points="{left},{top} {right},{top} {centre},{middle}" fill={SYMBOL}></polygon>
        <polygon points="{left},{bottom} {right},{bottom} {centre},{middle}" fill={SYMBOL}
        ></polygon>
    {:else if face.type === UnitType.Cavalry}
        <polygon points="{left},{top} {left},{bottom} {right},{bottom}" fill={SYMBOL}></polygon>
    {:else}
        <circle cx={centre} cy={middle} r={DOT_RADIUS} fill={SYMBOL}></circle>
    {/if}
{/snippet}

<g class="pointer-events-none" data-army-displays>
    {#each displays as { side, faces } (side)}
        {@const paint = PAINT[side]}
        {@const panel = displayPanel(side)}
        <g data-army-display={side}>
            <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill={PANEL}
            ></rect>
            {#each { length: displaySlotCount(side) }, index (index)}
                {@const face = faces[index]}
                <g transform={slotTransform(side, index)}>
                    {#if face}
                        {@render block(paint.standing)}
                        {#each symbolTops(face.strength) as top (top)}
                            {@render symbol(face, top, paint.standing.face)}
                        {/each}
                    {:else}
                        {@render block(paint.eliminated)}
                    {/if}
                </g>
            {/each}
        </g>
    {/each}
</g>
