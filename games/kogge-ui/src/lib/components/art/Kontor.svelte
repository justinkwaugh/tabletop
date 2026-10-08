<script lang="ts">
    let {
        color,
        x = 0,
        y = 0,
        size = 34,
        outline = false
    }: { color: string; x?: number; y?: number; size?: number; outline?: boolean } = $props()

    const scale = $derived(size / 34)
    const facade = 'M1 40 V19 H4 V15 H8 V11 H12 V7 H15 V3 H19 V7 H22 V11 H26 V15 H30 V19 H33 V40 Z'
</script>

<!-- Anchored at the top-left of a 34 x 40 box. -->
<g transform="translate({x} {y}) scale({scale})">
    {#if outline}
        <path
            d={facade}
            fill="#e9dcb8"
            fill-opacity="0.6"
            stroke="#7a5b33"
            stroke-width="1.2"
            stroke-dasharray="3 2.4"
        ></path>
    {:else}
        <path d={facade} fill={color} stroke="#2a1a0c" stroke-width="1.3" stroke-linejoin="round"
        ></path>
        <path d="M1 40 V19 H4 V15 H8 V11 H12 V7 H15 V3 H17 V40 Z" fill="#fff" fill-opacity="0.12"
        ></path>
        <g fill="#2a1a0c" fill-opacity="0.55">
            <rect x="14" y="30" width="6" height="10" rx="3" ry="3"></rect>
            <rect x="6" y="22" width="4.5" height="5.5"></rect>
            <rect x="23.5" y="22" width="4.5" height="5.5"></rect>
            <rect x="15" y="12" width="4" height="5"></rect>
        </g>
    {/if}
</g>
