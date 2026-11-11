<script lang="ts">
    import { ActionBox } from '@tabletop/south-african-railroads'
    import { polygonPoints } from '$lib/utils/shapes.js'
    import Cube from './icons/Cube.svelte'

    let { box, size = 36 }: { box: ActionBox; size?: number } = $props()

    const TIES = [6, 12, 18, 30, 36, 42]
    const COINS = [34, 28, 22]
</script>

<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    {#if box === ActionBox.ConstructTrack}
        {#each TIES as x (x)}
            <rect {x} y="19" width="2.4" height="12" fill="#425e80" />
        {/each}
        <line x1="2" x2="46" y1="22" y2="22" class="rail" />
        <line x1="2" x2="46" y1="28" y2="28" class="rail" />
        <rect x="15" y="16" width="18" height="18" rx="2.5" fill="#fdfdfb" stroke="#18222f" />
        <Cube x={24} y={25} size={15} color="#c8231f" edge="#7d1411" />
    {:else if box === ActionBox.OfferStock}
        <rect x="12" y="9" width="30" height="20" rx="2" class="certificate" />
        <rect x="6" y="18" width="30" height="20" rx="2" class="certificate" />
        <rect x="6" y="18" width="30" height="6" rx="2" fill="#2f4fa8" />
        <text x="21" y="35.5" class="dollar">$</text>
    {:else if box === ActionBox.DevelopSettlements}
        <circle cx="24" cy="25" r="17" class="ring" />
        <polygon points={polygonPoints(6, 12, -90, { x: 24, y: 25 })} class="railhead" />
        <path d="M24 4 L29 10 L19 10 Z" fill="#18222f" />
    {:else}
        {#each COINS as y (y)}
            <ellipse cx="24" cy={y + 4} rx="14" ry="5" fill="#9b7612" />
            <ellipse cx="24" cy={y} rx="14" ry="5" class="coin" />
        {/each}
        <text x="24" y="25.5" class="coin-mark">$</text>
    {/if}
</svg>

<style>
    .rail {
        stroke: #18222f;
        stroke-width: 2;
    }

    .certificate {
        fill: #fdfdfb;
        stroke: #18222f;
        stroke-width: 1.5;
    }

    .dollar {
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        fill: #18222f;
        text-anchor: middle;
    }

    .ring {
        fill: none;
        stroke: #8c8478;
        stroke-width: 3.5;
    }

    .railhead {
        fill: #f2b81e;
        stroke: #0d1219;
        stroke-width: 1.4;
    }

    .coin {
        fill: #e3b32f;
        stroke: #7a5a0a;
        stroke-width: 1.2;
    }

    .coin-mark {
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 8px;
        font-weight: 700;
        fill: #5c4306;
        text-anchor: middle;
    }
</style>
