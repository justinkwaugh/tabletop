<script lang="ts">
    import type { ActionCard, MidBottomBand } from '@tabletop/lowenherz'
    import iconCrownScepter from '$lib/images/action-cards/icons/icon-crown-scepter.png'
    import iconKnight from '$lib/images/action-cards/icons/icon-knight.png'
    import iconKnightDouble from '$lib/images/action-cards/icons/icon-knight-double.png'
    import iconWalls from '$lib/images/action-cards/icons/icon-walls.png'
    import iconMoneybag from '$lib/images/action-cards/icons/icon-moneybag.png'
    import silverMine from '$lib/images/action-cards/silver-mine.jpg'
    import kingIsDead from '$lib/images/action-cards/king-is-dead.jpg'

    let { card }: { card: ActionCard } = $props()

    const numeralStyle = "font-family:'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif"
</script>

{#snippet numeral(value: number)}
    <span
        class="absolute left-[3cqw] top-[1.5cqw] font-bold text-[32.5cqw] text-[#2b2b2b]"
        style={numeralStyle}
    >
        {value}
    </span>
{/snippet}

{#snippet midBottomBand(band: MidBottomBand, bg: string)}
    <div class="flex-1 min-w-0 min-h-0 relative flex items-center justify-center p-3" style="background-color:{bg}">
        {#if band.kind === 'border'}
            {@render numeral(band.count)}
            <img src={iconWalls} alt="border" class="h-full max-w-full object-contain translate-x-[15%]" />
        {:else if band.count === 2}
            <img src={iconKnightDouble} alt="knight" class="h-full max-w-full object-contain scale-110" />
        {:else}
            <img src={iconKnight} alt="knight" class="h-full max-w-full object-contain" />
        {/if}
    </div>
{/snippet}

<div class="@container aspect-[546/840] w-full rounded-md overflow-hidden border border-black/20 shadow-md bg-white">
    {#if card.type === 'mining'}
        <img src={silverMine} alt="Silver Mine" class="w-full h-full object-cover" />
    {:else if card.type === 'kingIsDead'}
        <img src={kingIsDead} alt="The King is Dead" class="w-full h-full object-cover" />
    {:else}
        <div class="flex flex-col w-full h-full min-w-0">
            <div
                class="flex-1 min-w-0 min-h-0 relative flex items-center justify-center p-3"
                style="background-color:#BFCFAE"
            >
                {#if card.top.kind === 'income'}
                    {@render numeral(card.top.value)}
                    <img src={iconMoneybag} alt="income" class="h-full max-w-full object-contain translate-x-[10%]" />
                {:else}
                    <img src={iconCrownScepter} alt="politics" class="h-full max-w-full object-contain" />
                {/if}
            </div>
            {@render midBottomBand(card.middle, '#EEE5A9')}
            {@render midBottomBand(card.bottom, '#B3CBDF')}
        </div>
    {/if}
</div>
