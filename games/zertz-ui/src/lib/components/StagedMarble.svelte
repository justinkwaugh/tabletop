<svelte:options namespace="svg" />

<script lang="ts">
    import { onDestroy, untrack } from 'svelte'
    import type { MarbleColor } from '@tabletop/zertz'
    import { MARBLE_RADIUS, type BoardView } from '$lib/board/geometry.js'
    import { MARBLE_SHADOW_RADIUS } from '$lib/board/softShadow.js'
    import { liftOffBody, liftOffShadow, StagedDrop } from '$lib/animators/drop.js'
    import MarbleShape from './MarbleShape.svelte'

    // The marble you are about to place, dropping into the ring you chose unless Undo took it back
    // out there. Taken back, it lifts out again, unless it is going in (lifts says which). Drawn at
    // the marble's centre, as the board's marbles are.
    let {
        color,
        seed,
        view,
        drops,
        lifts
    }: {
        color: MarbleColor
        seed: number
        view: BoardView
        drops: boolean
        lifts: () => boolean
    } = $props()

    // Whether it drops is settled when it is first drawn.
    const drop = new StagedDrop(untrack(() => drops))
    onDestroy(() => drop.stop())
</script>

<g out:liftOffShadow|global={{ lifts }}>
    <g transform="translate(0 {view.lift + 3 * view.tilt})">
        <g {@attach drop.shadow}>
            <ellipse
                rx={MARBLE_SHADOW_RADIUS}
                ry={MARBLE_SHADOW_RADIUS * view.tilt}
                fill="url(#zertz-marble-shadow)"
            ></ellipse>
        </g>
    </g>
</g>
<g out:liftOffBody|global={{ lifts }}>
    <g {@attach drop.marble}>
        <MarbleShape prefix="zertz-board" {color} radius={MARBLE_RADIUS} {seed} />
    </g>
</g>
