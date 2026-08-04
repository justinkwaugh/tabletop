<script lang="ts">
    // The region-creation player aid, drawn rather than photographed - this replaces a
    // scan of the physical card (region-creation.png), which read as a screenshot
    // pasted onto the board next to everything else that's actually styled. Same
    // numbers as the printed card; "ab 31" is just spelled out in English here.
    const ROWS: { spaces: string; points: number }[] = [
        { spaces: '1 – 4', points: 3 },
        { spaces: '5 – 10', points: 5 },
        { spaces: '11 – 20', points: 7 },
        { spaces: '21 – 30', points: 9 },
        { spaces: '31 or more', points: 12 }
    ]
</script>

<div class="aid-card relative w-[262px] select-none rounded-[10px] text-[#2b1a0a]">
    <!-- A thin gilt ring just inside the dark outer edge - the double-frame look every
         card in the box has, without needing a border image. -->
    <div class="pointer-events-none absolute inset-[3px] rounded-[7px] border border-[#a9843c]/45"></div>

    <div class="aid-header rounded-t-[8px] px-3 py-[6px] text-center">
        <span class="aid-title text-[23px] leading-tight">Region Creation</span>
    </div>

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

    <div
        class="rounded-b-[8px] border-t-2 border-[#3b2410]/40 bg-[#3b2410]/[0.07] px-3 py-[7px] text-center text-[13px] italic leading-snug"
    >
        Each city counts for 5 power points.
    </div>
</div>

<style>
    /* Aged parchment: a warm base, a lit corner, and a grubby opposite corner - enough
       variation that it doesn't read as a flat beige rectangle at this size. */
    .aid-card {
        background-color: #f0dfba;
        background-image:
            radial-gradient(ellipse at 18% 12%, rgba(255, 255, 255, 0.55), transparent 55%),
            radial-gradient(ellipse at 88% 85%, rgba(120, 80, 30, 0.18), transparent 60%),
            linear-gradient(160deg, #f7eaca 0%, #eddbb4 45%, #dfc998 100%);
        border: 2px solid #3b2410;
        box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.45),
            inset 0 0 18px rgba(120, 80, 30, 0.15);
    }

    .aid-header {
        background-image: linear-gradient(180deg, #7c3b2a 0%, #5d281c 55%, #4a1f15 100%);
        border-bottom: 2px solid #3b2410;
        box-shadow: inset 0 1px 0 rgba(255, 226, 180, 0.25);
    }

    /* No font-family of its own - inherits IM Fell English from the app, same as the
       table and footer below it, so the whole card is set in one face. */
    .aid-title {
        color: #f6e8c8;
        letter-spacing: 0.015em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    }

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
