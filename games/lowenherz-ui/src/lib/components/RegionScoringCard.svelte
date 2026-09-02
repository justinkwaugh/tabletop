<script lang="ts">
    import AidCard from './AidCard.svelte'

    // The region-creation player aid, drawn rather than photographed - it replaced a scan
    // of the physical card, which read as a screenshot pasted onto the board next to
    // everything else that's actually styled (that scan has since been deleted). Same
    // numbers as the printed card; "ab 31" is just spelled out in English here.
    const ROWS: { spaces: string; points: number }[] = [
        { spaces: '1 – 4', points: 3 },
        { spaces: '5 – 10', points: 5 },
        { spaces: '11 – 20', points: 7 },
        { spaces: '21 – 30', points: 9 },
        { spaces: '31 or more', points: 12 }
    ]
</script>

<AidCard title="Region Creation">
    <div class="relative px-[10px] pt-2 pb-1">
        <div
            class="grid grid-cols-[1fr_58px] items-end gap-y-1 border-b border-[#3b2410]/35 pb-1 text-[11px] uppercase tracking-[0.09em] text-[#5a4126]"
        >
            <span># of spaces</span>
            <span class="text-center leading-[1.15]">Power<br />points</span>
        </div>

        {#each ROWS as row, i (row.spaces)}
            <div
                class="grid grid-cols-[1fr_58px] items-center {i > 0
                    ? 'border-t border-[#3b2410]/15'
                    : ''} {i % 2 === 1 ? 'bg-[#3b2410]/[0.04]' : ''}"
            >
                <span class="py-[5px] text-[17px] leading-none">{row.spaces}</span>
                <span class="flex justify-center border-l border-[#3b2410]/15 py-[5px]">
                    <span class="points-roundel">{row.points}</span>
                </span>
            </div>
        {/each}
    </div>

    {#snippet footer()}
        Each city counts for 5 power points.
    {/snippet}
</AidCard>

<style>
    /* A struck gold coin per score - echoes the Treasure card's ducat chip, and gives
       the eye something to scan down the right-hand column. */
    .points-roundel {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background-image: radial-gradient(circle at 32% 28%, #fbeaa0 0%, #e3c363 45%, #b8912f 100%);
        border: 1px solid rgba(70, 45, 10, 0.55);
        box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            0 1px 2px rgba(0, 0, 0, 0.3);
        font-size: 17px;
        font-weight: bold;
        line-height: 1;
        color: #2b1a0a;
    }
</style>
