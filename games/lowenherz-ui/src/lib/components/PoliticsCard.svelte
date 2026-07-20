<script lang="ts">
    import type { PoliticsCard } from '$lib/data/politicsCards.js'
    import allianceImg from '$lib/images/politics-cards/alliance.jpg'
    import renegadeImg from '$lib/images/politics-cards/renegade.jpg'
    import parchmentFrame from '$lib/images/politics-cards/parchment-frame.png'
    import treasureFrame from '$lib/images/politics-cards/treasure-frame.png'

    let { card }: { card: PoliticsCard } = $props()

    const numeralStyle = "font-family:'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif"
</script>

<div
    class="@container aspect-[534/832] w-full rounded-md overflow-hidden border border-black/20 shadow-md bg-white relative"
>
    {#if card.type === 'alliance'}
        <img src={allianceImg} alt="Alliance" class="w-full h-full object-cover" />
    {:else if card.type === 'renegade'}
        <img src={renegadeImg} alt="Renegade" class="w-full h-full object-cover" />
    {:else if card.type === 'parchment'}
        <img src={parchmentFrame} alt="Parchment" class="w-full h-full object-cover" />
        <div class="absolute inset-x-0 flex items-center justify-center gap-[2cqw]" style="top:73%; height:25%;">
            <span class="font-bold text-[9cqw] text-[#1a1a1a]" style={numeralStyle}>{card.value}</span>
            <span class="text-[4.5cqw] text-[#1a1a1a]" style={numeralStyle}>Power points</span>
        </div>
    {:else if card.type === 'treasure'}
        <img src={treasureFrame} alt="Treasure" class="w-full h-full object-cover" />
        <div class="absolute inset-x-0 flex items-center justify-center" style="top:78%; height:18%;">
            <div
                class="bg-[#f3d84e] rounded-lg flex items-baseline gap-[2cqw]"
                style="padding: 1cqw 3cqw;"
            >
                <span class="font-bold text-[7cqw] text-[#1a1a1a]" style={numeralStyle}>{card.value}</span>
                <span class="text-[3.5cqw] text-[#1a1a1a]" style={numeralStyle}>Ducats</span>
            </div>
        </div>
    {/if}
</div>
