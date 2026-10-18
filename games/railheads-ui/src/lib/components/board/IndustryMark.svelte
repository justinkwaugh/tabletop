<script lang="ts">
    import { Industry } from '@tabletop/railheads'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'

    let { industry, scale = 1 }: { industry: Industry; scale?: number } = $props()

    const color = $derived(INDUSTRY_STYLE[industry].mark)
</script>

<g transform="scale({scale})" fill={color} stroke="#1d1d1b" stroke-width="1.2" stroke-linejoin="round">
    {#if industry === Industry.Cloth}
        <path d="M -12 -2 L 0 -10 L 12 -2 L 0 6 Z" />
        <path d="M -12 -2 L -12 3 L 0 11 L 12 3 L 12 -2 L 0 6 Z" fill="#2c2f6e" />
    {:else if industry === Industry.Grain}
        <path
            d="M -5 -12 L 5 -12 L 3 -8 C 9 -6 12 0 11 6 C 10 11 6 12 0 12 C -6 12 -10 11 -11 6 C -12 0 -9 -6 -3 -8 Z"
        />
        <path d="M -3 -8 L 3 -8" stroke-width="2" />
    {:else if industry === Industry.Brick}
        <path d="M -11 -6 L 6 -9 L 12 -4 L -5 -1 Z" fill="#a9452a" />
        <path d="M -11 -6 L -5 -1 L -5 10 L -11 5 Z" fill="#5c2210" />
        <path d="M -5 -1 L 12 -4 L 12 7 L -5 10 Z" />
    {:else}
        <path
            d="M -12 -8 L 9 -8 C 12 -8 12 -4 9 -3 L 4 -2 L 4 3 L 8 6 L 8 10 L -8 10 L -8 6 L -4 3 L -4 -2 L -9 -3 C -12 -4 -12 -6 -12 -8 Z"
        />
    {/if}
</g>
