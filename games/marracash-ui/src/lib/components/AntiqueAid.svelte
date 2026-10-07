<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AidCard from '$lib/components/AidCard.svelte'
    import AntiqueCard from '$lib/components/AntiqueCard.svelte'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { PanelPalette } from '$lib/utils/playerPanel.js'
    import { AntiqueItemNames } from '$lib/utils/antiqueItems.js'
    import {
        antiquePayoutRows,
        antiqueValueRanges,
        ExampleAntiqueHand
    } from '$lib/utils/playerAid.js'

    const gameSession = getGameSession()
    const ValueRanges = antiqueValueRanges()
    const ItemSize = 22
    const FanStepDegrees = 6
    const FanDropPerStep = 2
    const FanMiddle = (ExampleAntiqueHand.length - 1) / 2

    let payoutRows = $derived(antiquePayoutRows(gameSession.gameState.players.length))

    function itemName(color: MarketColor): string {
        const name = AntiqueItemNames[color]
        return name.charAt(0).toUpperCase() + name.slice(1)
    }
</script>

<AidCard title="Antiques">
    <p>Each card needs a customer of its color in your shops.</p>
    <div class="mt-1 mb-1 flex items-center justify-center gap-4">
        <div class="fan">
            {#each ExampleAntiqueHand as card, index (index)}
                <div
                    class="fan-card"
                    style:transform="rotate({(index - FanMiddle) * FanStepDegrees}deg) translateY({Math.abs(
                        index - FanMiddle
                    ) * FanDropPerStep}px)"
                >
                    <AntiqueCard {card} covered />
                </div>
            {/each}
        </div>
        <div class="flex items-end gap-px" aria-label="One customer for each card">
            {#each ExampleAntiqueHand as card, index (index)}
                <PawnIcon color={card.color} height={24} />
            {/each}
        </div>
    </div>
    <h3 class="aid-heading">Upon completion</h3>
    <p class="aid-lead">Gain cash equal to your best cards:</p>
    <table class="aid-table">
        <tbody>
            {#each payoutRows as row (row.place)}
                <tr>
                    <td>{row.place}</td>
                    <td class="aid-gain text-right">+ best {row.paidCards} cards</td>
                </tr>
            {/each}
        </tbody>
    </table>
    <h3 class="aid-heading">Card values</h3>
    <div class="grid grid-cols-2 gap-x-4">
        {#each ValueRanges as range (range.color)}
            <div class="flex h-[24px] items-center gap-2">
                <svg
                    width={ItemSize}
                    height={ItemSize}
                    viewBox="0 0 40 40"
                    role="img"
                    aria-label={itemName(range.color)}
                >
                    <AntiqueItem color={range.color} cutout={PanelPalette.scrollInset} />
                </svg>
                <!-- El Messiri sets numerals high in the line, above the bottom-heavy items -->
                <span class="aid-figure relative top-[2px]">{range.lowest}–{range.highest}</span>
            </div>
        {/each}
    </div>
</AidCard>

<style>
    .fan {
        display: flex;
        padding: 2px 4px 0 8px;
    }

    .fan-card {
        transform-origin: 50% 100%;
        filter: drop-shadow(1px 1px 1.5px rgb(0 0 0 / 0.3));
    }

    .fan-card + .fan-card {
        margin-left: -18px;
    }
</style>
