<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { W, H } from '$lib/utils/boardGeometry.js'

    const FLY_A = 'M1.5 0 L-1 -4.5 L-0.5 0 L-1 4.5 Z'
    const FLY_B = 'M1.5 0 L-2.5 -3 L-0.5 0 L-2.5 3 Z'
    const GROUND = 'M2 0 L2.8 -0.3 L2 -0.6 C1.5 -1.2 -1 -1.3 -1.8 -0.6 L-2.6 -1.1 L-2.1 0 L-2.6 1.1 L-1.8 0.6 C-1 1.3 1.5 1.2 2 0.6 Z'

    const director = getGameSession().birds
    let birdIds: number[] = $state([])
</script>

<svg
    class="absolute"
    width={W}
    height={H}
    viewBox="0 0 {W} {H}"
    aria-hidden="true"
    style="left: 10px; top: 10px; pointer-events: none; overflow: visible"
    {@attach () => director.attach((ids) => { birdIds = ids })}
>
    {#each birdIds as id (id)}
        <g
            class="bird"
            data-pose="fly-a"
            visibility="hidden"
            {@attach (el: SVGGElement) => {
                director.setBirdNode(id, el)
                return () => director.setBirdNode(id, undefined)
            }}
        >
            <path class="fly-a" d={FLY_A} />
            <path class="fly-b" d={FLY_B} />
            <path class="ground" d={GROUND} />
        </g>
    {/each}
</svg>

<style>
    .bird path {
        fill: #15110d;
    }
    .bird:not([data-pose='fly-a']) .fly-a,
    .bird:not([data-pose='fly-b']) .fly-b,
    .bird:not([data-pose='ground']) .ground {
        display: none;
    }
</style>
