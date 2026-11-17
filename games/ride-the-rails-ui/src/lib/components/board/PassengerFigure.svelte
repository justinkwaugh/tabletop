<script lang="ts">
    import { BOARD_LOOK, SCRIM_FILL } from '$lib/utils/boardLook.js'
    import { MEEPLE } from '$lib/utils/cityMarks.js'

    let {
        gone = false,
        shaded = false
    }: {
        gone?: boolean
        /**
         * Dimmed as the scrim dims the land: the scrim's own fill laid over the figure's shape. An
         * unlit city's passenger in a pick, which is drawn above the scrim.
         */
        shaded?: boolean
    } = $props()

    // The passenger BOARD_LOOK.passenger picks, in its own units; its place and size on the board
    // come from utils/cityMarks.ts. Another passenger style is drawn here beside it.
</script>

<!-- Art plan, Passenger: a flat natural-wood meeple with a dark edge, centred on the origin; once
     taken it leaves a dashed outline where it stood. -->
<g
    aria-hidden="true"
    data-passenger={gone ? 'gone' : 'waiting'}
    data-passenger-shape={BOARD_LOOK.passenger}
>
    {#if BOARD_LOOK.passenger === 'meeple'}
        {#if gone}
            <path
                d={MEEPLE.path}
                fill="none"
                stroke="var(--rtr-passenger-gone)"
                stroke-width={MEEPLE.goneWidth}
                stroke-dasharray={MEEPLE.goneDash}
                stroke-linejoin="round"
            ></path>
        {:else}
            <path
                d={MEEPLE.path}
                fill="var(--rtr-passenger)"
                stroke="var(--rtr-passenger-edge)"
                stroke-width={MEEPLE.edgeWidth}
                stroke-linejoin="round"
            ></path>
            {#if shaded}
                <!-- The same shape, edge included, in the scrim's translucent fill: a fill's own
                     alpha on one shape, as the scrim is, never an opacity effect. -->
                <path
                    d={MEEPLE.path}
                    fill={SCRIM_FILL}
                    stroke={SCRIM_FILL}
                    stroke-width={MEEPLE.edgeWidth}
                    stroke-linejoin="round"
                    data-scrim-shade
                ></path>
            {/if}
        {/if}
    {/if}
</g>
