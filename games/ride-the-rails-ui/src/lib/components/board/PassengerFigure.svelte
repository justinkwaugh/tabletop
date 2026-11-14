<script lang="ts">
    let { gone = false }: { gone?: boolean } = $props()

    // The figure BOARD_LOOK.passenger picks: a head and a body in its own units; another
    // passenger style is drawn here beside it.
    const HEAD = { cy: -10.6, r: 6.2 }
    const BODY = 'M-9.4 12 L-8.2 -1.2 Q0 -5.8 8.2 -1.2 L9.4 12 Z'
</script>

<!-- Art plan, Passenger: a navy standing figure with a white outline, centred on the origin;
     once taken it leaves a dashed outline where it stood. -->
<g aria-hidden="true" data-passenger={gone ? 'gone' : 'waiting'}>
    {#if gone}
        <circle
            cy={HEAD.cy}
            r={HEAD.r}
            fill="none"
            stroke="var(--rtr-passenger-gone)"
            stroke-width="1.9"
            stroke-dasharray="3.6 2.6"
        ></circle>
        <path
            d={BODY}
            fill="none"
            stroke="var(--rtr-passenger-gone)"
            stroke-width="1.9"
            stroke-dasharray="3.6 2.6"
            stroke-linejoin="round"
        ></path>
    {:else}
        <circle
            cy={HEAD.cy}
            r={HEAD.r}
            fill="var(--rtr-passenger)"
            stroke="var(--rtr-station)"
            stroke-width="3.4"
            paint-order="stroke"
        ></circle>
        <path
            d={BODY}
            fill="var(--rtr-passenger)"
            stroke="var(--rtr-station)"
            stroke-width="3.4"
            stroke-linejoin="round"
            paint-order="stroke"
        ></path>
    {/if}
</g>
