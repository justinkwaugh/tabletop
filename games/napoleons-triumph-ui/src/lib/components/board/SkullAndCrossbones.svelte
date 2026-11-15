<script lang="ts">
    import { MARK_INK, MARK_PAPER } from '$lib/utils/approachSymbols.js'

    let { size }: { size: number } = $props()

    const DRAWN_SIZE = 26
    const BONE_KNOBS = [
        [-7.3, -2.1],
        [7.3, -2.1],
        [-8.7, 0.1],
        [8.7, 0.1],
        [-8.7, 8.9],
        [8.7, 8.9],
        [-7.3, 11.1],
        [7.3, 11.1]
    ]
</script>

<g transform="scale({size / DRAWN_SIZE})" fill={MARK_INK}>
    <g stroke={MARK_INK} stroke-width="2.4" stroke-linecap="round">
        <line x1="-8" y1="-1" x2="8" y2="10"></line>
        <line x1="8" y1="-1" x2="-8" y2="10"></line>
    </g>
    {#each BONE_KNOBS as [x, y] (`${x}:${y}`)}
        <circle cx={x} cy={y} r="1.6"></circle>
    {/each}
    <path
        d="M-6 -3 A6.6 6.6 0 1 1 6 -3 Q6 0 4 1 V4 H-4 V1 Q-6 0 -6 -3 Z"
        stroke={MARK_PAPER}
        stroke-width="1.2"
    ></path>
    <g fill={MARK_PAPER}>
        <ellipse cx="-2.6" cy="-4" rx="1.9" ry="2.1"></ellipse>
        <ellipse cx="2.6" cy="-4" rx="1.9" ry="2.1"></ellipse>
        <polygon points="0,-1.4 -1.1,0.6 1.1,0.6"></polygon>
        <rect x="-1.95" y="2" width="0.7" height="2"></rect>
        <rect x="-0.35" y="2" width="0.7" height="2"></rect>
        <rect x="1.25" y="2" width="0.7" height="2"></rect>
    </g>
</g>
