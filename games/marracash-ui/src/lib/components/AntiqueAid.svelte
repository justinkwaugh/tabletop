<script lang="ts">
    import { antiqueColorCounts, MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AidCard from '$lib/components/AidCard.svelte'
    import AntiqueCard from '$lib/components/AntiqueCard.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { antiqueProgress } from '$lib/utils/antiqueProgress.js'
    import { AntiqueItemNames, sortedAntiques } from '$lib/utils/antiqueItems.js'
    import {
        antiquePayoutRows,
        antiqueValueRanges,
        ExampleAntiqueHand
    } from '$lib/utils/playerAid.js'

    const gameSession = getGameSession()
    const ValueRanges = antiqueValueRanges()

    let myId = $derived(gameSession.myPlayer?.id)
    let myHand = $derived(
        myId === undefined ? [] : gameSession.gameState.getPlayerState(myId).antiques
    )
    let hand = $derived(
        myId !== undefined && myHand.length > 0
            ? antiqueProgress(sortedAntiques(myHand), gameSession.gameState.customersByColor(myId))
            : ExampleAntiqueHand.map((card) => ({ card, covered: false }))
    )
    let needs = $derived.by(() => {
        const counts = antiqueColorCounts(hand.map((entry) => entry.card))
        return Object.values(MarketColor)
            .filter((color) => counts[color] > 0)
            .map((color) => ({ color, count: counts[color] }))
    })
    let payoutRows = $derived(antiquePayoutRows(gameSession.gameState.players.length))

    function itemName(color: MarketColor): string {
        const name = AntiqueItemNames[color]
        return name.charAt(0).toUpperCase() + name.slice(1)
    }
</script>

<AidCard title="Antiques">
    <p>Match every card with a customer of its color in your shops.</p>
    <div class="my-1 flex justify-center gap-1">
        {#each hand as entry, index (index)}
            <AntiqueCard card={entry.card} covered={entry.covered} surface="parchment" />
        {/each}
    </div>
    <p class="text-center text-xs text-[#5a4630] italic">
        needs
        {#each needs as need (need.color)}
            <span class="ml-1 font-bold whitespace-nowrap not-italic"
                ><PawnIcon color={need.color} height={15} />{need.count}</span
            >
        {/each}
    </p>
    <h3 class="aid-heading">Upon completion:</h3>
    <p class="aid-lead">Collect the total value of your best cards:</p>
    <table class="aid-table">
        <tbody>
            {#each payoutRows as row (row.place)}
                <tr>
                    <td>{row.place} to complete</td>
                    <td class="aid-gain text-right">+ best {row.paidCards} cards</td>
                </tr>
            {/each}
        </tbody>
    </table>
    <h3 class="aid-heading">Card values</h3>
    <table class="aid-table">
        <tbody>
            {#each ValueRanges as range (range.color)}
                <tr>
                    <td>
                        <span
                            class="mr-1 inline-block h-[11px] w-[11px] rounded-[3px] border border-black/35 align-[-1px]"
                            style:background-color={gameSession.marketPalettes[range.color].fill}
                        ></span>
                        {itemName(range.color)}
                    </td>
                    <td class="marracash-display text-right">{range.lowest}–{range.highest}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</AidCard>
