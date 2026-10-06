<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import PawnIcon from '$lib/components/PawnIcon.svelte'

    let { action }: { action: 'move' | 'auction' } = $props()
</script>

<span
    class="marracash-display inline-flex h-[22px] items-center gap-[3px] rounded-full border-[1.5px] pr-[7px] pl-[5px] text-[11px] tracking-[0.05em] uppercase {action ===
    'move'
        ? 'border-[#8a6a46] bg-[#e3cfa8] text-[#3d2f1f]'
        : 'border-[#5e2716] bg-[#8a3d26] text-[#f8ecd2]'}"
>
    {#if action === 'move'}
        <PawnIcon color={MarketColor.Blue} height={16} />
        Move
    {:else}
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <g fill="currentColor">
                <rect x="3" y="2" width="8" height="4" rx="1" transform="rotate(-35 7 4)"></rect>
                <rect x="7" y="5" width="2.2" height="9" rx="1" transform="rotate(-35 8 9)"></rect>
                <rect x="1" y="13" width="9" height="2" rx="1"></rect>
            </g>
        </svg>
        Auction
    {/if}
</span>
