<script lang="ts">
    // A rough, hand-hewn stone rampart strip: irregular crenellation teeth (randomized
    // width and height) plus a noise-textured fill, rather than a perfectly uniform
    // repeating pattern in flat black.
    let { side }: { side: 'top' | 'bottom' | 'left' | 'right' } = $props()

    const isVertical = side === 'left' || side === 'right'

    const THICKNESS = 20
    // The viewBox stretches to fill a fixed container size, so AVG_WIDTH's absolute
    // value cancels out - TOOTH_COUNT is what actually controls rendered tooth size.
    // Top/bottom uses one fewer tooth than before (30 -> 29) to widen each space by
    // ~1px (board is a fixed 664px wide, so 664/29 - 664/30 ≈ 1px); left/right is
    // unchanged.
    const TOOTH_COUNT = isVertical ? 19 : 29
    const AVG_WIDTH = 24
    const PIXEL_JITTER = 1

    type Tooth = { pos: number; width: number; isMerlon: boolean; merlonHeight: number }

    function generateTeeth(): { teeth: Tooth[]; total: number } {
        const teeth: Tooth[] = []
        let pos = 0
        for (let i = 0; i < TOOTH_COUNT; i++) {
            const width = AVG_WIDTH + (Math.random() * 2 - 1) * PIXEL_JITTER
            const merlonHeight = THICKNESS / 2 + (Math.random() * 2 - 1) * PIXEL_JITTER
            teeth.push({ pos, width, isMerlon: i % 2 === 0, merlonHeight })
            pos += width
        }
        return { teeth, total: pos }
    }

    const { teeth, total } = generateTeeth()
    const filterId = `rock-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)

    // Flip so the merlon half always faces inward, toward the board.
    const flipTransform = side === 'bottom' ? 'scaleY(-1)' : side === 'right' ? 'scaleX(-1)' : 'none'
    const stoneColor = '#3f463f' // dark gray with a touch of green - matches WallSegment/RampartCorner
</script>

<svg
    class="block w-full h-full"
    style="transform: {flipTransform};"
    preserveAspectRatio="none"
    viewBox={isVertical ? `0 0 ${THICKNESS} ${total}` : `0 0 ${total} ${THICKNESS}`}
>
    <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed={seed} result="noise" />
            <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.45 0"
                result="darkNoise"
            />
            <feComposite in="darkNoise" in2="SourceGraphic" operator="in" result="noiseOverShape" />
            <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="noiseOverShape" />
            </feMerge>
        </filter>
    </defs>

    <!-- base wall: solid across the full length, outer half of the thickness -->
    {#if isVertical}
        <rect x={THICKNESS / 2} y="0" width={THICKNESS / 2} height={total} fill={stoneColor} filter="url(#{filterId})" />
    {:else}
        <rect x="0" y={THICKNESS / 2} width={total} height={THICKNESS / 2} fill={stoneColor} filter="url(#{filterId})" />
    {/if}

    <!-- merlons: irregular teeth growing inward from the base -->
    {#each teeth as tooth (tooth.pos)}
        {#if tooth.isMerlon}
            {#if isVertical}
                <rect
                    x={THICKNESS / 2 - tooth.merlonHeight}
                    y={tooth.pos}
                    width={tooth.merlonHeight + THICKNESS / 2}
                    height={tooth.width}
                    fill={stoneColor}
                    filter="url(#{filterId})"
                />
            {:else}
                <rect
                    x={tooth.pos}
                    y={THICKNESS / 2 - tooth.merlonHeight}
                    width={tooth.width}
                    height={tooth.merlonHeight + THICKNESS / 2}
                    fill={stoneColor}
                    filter="url(#{filterId})"
                />
            {/if}
        {/if}
    {/each}
</svg>
