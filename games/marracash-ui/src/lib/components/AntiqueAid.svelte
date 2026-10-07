<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AidCard from '$lib/components/AidCard.svelte'
    import AntiqueCard from '$lib/components/AntiqueCard.svelte'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import { PanelPalette } from '$lib/utils/playerPanel.js'
    import { antiqueProgress } from '$lib/utils/antiqueProgress.js'
    import { AntiqueItemNames, sortedAntiques } from '$lib/utils/antiqueItems.js'
    import {
        antiquePayoutRows,
        antiqueValueRanges,
        ExampleAntiqueHand
    } from '$lib/utils/playerAid.js'

    const gameSession = getGameSession()
    const ValueRanges = antiqueValueRanges()
    const ItemSize = 22

    let myId = $derived(gameSession.myPlayer?.id)
    let myHand = $derived(
        myId === undefined ? [] : gameSession.gameState.getPlayerState(myId).antiques
    )
    let hand = $derived(
        myId !== undefined && myHand.length > 0
            ? antiqueProgress(sortedAntiques(myHand), gameSession.gameState.customersByColor(myId))
            : ExampleAntiqueHand.map((card) => ({ card, covered: false }))
    )
    let payoutRows = $derived(antiquePayoutRows(gameSession.gameState.players.length))

    function itemName(color: MarketColor): string {
        const name = AntiqueItemNames[color]
        return name.charAt(0).toUpperCase() + name.slice(1)
    }
</script>

<AidCard title="Antiques">
    <p>Each card needs a customer of its color in your shops.</p>
    <div class="mt-2 flex justify-center gap-1.5">
        {#each hand as entry, index (index)}
            <AntiqueCard card={entry.card} covered={entry.covered} />
        {/each}
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
    <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {#each ValueRanges as range (range.color)}
            <div class="flex items-center gap-2">
                <svg
                    width={ItemSize}
                    height={ItemSize}
                    viewBox="0 0 40 40"
                    role="img"
                    aria-label={itemName(range.color)}
                >
                    <AntiqueItem color={range.color} cutout={PanelPalette.glaze} />
                </svg>
                <!-- El Messiri sets numerals high in the line, above the bottom-heavy items -->
                <span class="aid-figure relative top-[2px]">{range.lowest}–{range.highest}</span>
            </div>
        {/each}
    </div>
</AidCard>
