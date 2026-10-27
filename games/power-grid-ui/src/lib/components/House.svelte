<script lang="ts">
    let {
        x,
        y,
        color,
        size = 1,
        ghost = false
    }: { x: number; y: number; color: string; size?: number; ghost?: boolean } = $props()
</script>

<g transform="translate({x} {y}) scale({size})" opacity={ghost ? 0.55 : 1}>
    {#if !ghost}
        <ellipse cx="0.8" cy="6.2" rx="7.4" ry="2.2" fill="#000" opacity="0.28"></ellipse>
    {/if}
    <path d="M-6.5 5.5 L-6.5 -1.5 L0 -7.5 L6.5 -1.5 L6.5 5.5 Z" fill={color}></path>
    <path d="M0.6 -6.9 L6.5 -1.5 L6.5 5.5 L0.6 5.5 Z" fill="#000" opacity="0.14"></path>
    {#if ghost}
        <path
            d="M-6.5 5.5 L-6.5 -1.5 L0 -7.5 L6.5 -1.5 L6.5 5.5 Z"
            fill="none"
            stroke="#1d1a17"
            stroke-width="1.2"
            stroke-dasharray="2 1.5"
        ></path>
    {/if}
</g>
