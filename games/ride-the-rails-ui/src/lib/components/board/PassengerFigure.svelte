<script lang="ts">
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { PAWN } from '$lib/utils/cityMarks.js'

    let { gone = false }: { gone?: boolean } = $props()

    // The passenger BOARD_LOOK.passenger picks, in its own units; its place and size on the board
    // come from utils/cityMarks.ts. Another passenger style is drawn here beside it.
</script>

<!-- Art plan, Passenger: a flat natural-wood pawn with a dark edge, centred on the origin; once
     taken it leaves a dashed outline where it stood. -->
<g aria-hidden="true" data-passenger={gone ? 'gone' : 'waiting'}>
    {#if BOARD_LOOK.passenger === 'pawn'}
        {#if gone}
            <path
                d={PAWN.path}
                fill="none"
                stroke="var(--rtr-passenger-gone)"
                stroke-width={PAWN.goneWidth}
                stroke-dasharray={PAWN.goneDash}
                stroke-linejoin="round"
            ></path>
        {:else}
            <path
                d={PAWN.path}
                fill="var(--rtr-pawn)"
                stroke="var(--rtr-pawn-edge)"
                stroke-width={PAWN.edgeWidth}
                stroke-linejoin="round"
            ></path>
        {/if}
    {/if}
</g>
