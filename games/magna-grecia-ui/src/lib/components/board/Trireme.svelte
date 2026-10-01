<script lang="ts">
    let {
        x,
        y,
        scale = 1,
        flip = false
    }: { x: number; y: number; scale?: number; flip?: boolean } = $props()
</script>

<g transform="translate({x} {y}) scale({flip ? -scale : scale} {scale})" opacity="0.9">
    <path d="M -46 6 q 46 16 92 0" fill="none" stroke="#d7eef3" stroke-width="1.4" opacity="0.6"
    ></path>
    <path
        d="M -40 -2 L 38 -2 Q 46 -2 50 -10 L 44 4 Q 0 12 -36 6 Z"
        fill="#6b3f1d"
        stroke="#3f220d"
        stroke-width="1"
    ></path>
    <path d="M -38 -2 L 38 -2" stroke="#d9a441" stroke-width="1.6"></path>
    <g stroke="#3f220d" stroke-width="1">
        {#each [-28, -18, -8, 2, 12, 22] as oar (oar)}
            <line x1={oar} y1="3" x2={oar - 6} y2="14"></line>
        {/each}
    </g>
    <line x1="0" y1="-2" x2="0" y2="-40" stroke="#3f220d" stroke-width="1.6"></line>
    <path
        d="M -16 -37 Q 0 -30 16 -37 L 14 -10 Q 0 -5 -14 -10 Z"
        fill="#f1e2bf"
        stroke="#8c5b2e"
        stroke-width="1"
    ></path>
    <path d="M -15 -24 Q 0 -18 15 -24" fill="none" stroke="#b5462f" stroke-width="3"></path>
    <path d="M -40 -2 q -8 -8 -4 -14" fill="none" stroke="#6b3f1d" stroke-width="2.4"></path>
</g>
