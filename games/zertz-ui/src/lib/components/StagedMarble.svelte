<svelte:options namespace="svg" />

<script lang="ts">
    import { onDestroy, untrack } from 'svelte'
    import type { MarbleColor } from '@tabletop/zertz'
    import type { BoardView } from '$lib/board/geometry.js'
    import { MARBLE_SHADOW_RADIUS } from '$lib/board/softShadow.js'
    import { liftOffBody, liftOffShadow, StagedDrop } from '$lib/animators/drop.js'
    import MarbleLook from './MarbleLook.svelte'

    let {
        color,
        seed,
        view,
        drops,
        lifts,
        register
    }: {
        color: MarbleColor
        seed: number
        view: BoardView
        drops: boolean
        lifts: () => boolean
        register: (drop: StagedDrop) => () => void
    } = $props()

    // Whether it drops is settled when it is first drawn.
    const drop = new StagedDrop(untrack(() => drops))
    const unregister = untrack(() => register(drop))
    onDestroy(() => {
        unregister()
        drop.stop()
    })
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
        <MarbleLook {color} {seed} {view} />
    </g>
</g>
