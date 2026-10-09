<script lang="ts">
    import { CardKind, SearchSource } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { cardBack } from '$lib/images/cardImages.js'
    import { favorToken } from '$lib/images/tileImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { regionName } from '$lib/model/names.js'
    import type { SearchRow } from '$lib/model/searchRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.1.1 — a row per source the engine accepts, its price on the button.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let rows = $derived(gameSession.searchRows)
    let busy = $derived(gameSession.busy)
    const choiceWidth = new ChoiceWidth()

    const sourceOf = (row: SearchRow) =>
        row.region ? `the ${regionName(row.region)} discard pile` : 'the world deck'
    const nameOf = (row: SearchRow) => sourceOf(row).replace(/^the/, 'The')

    function backOf(row: SearchRow): string {
        const back =
            row.source === SearchSource.WorldDeck
                ? gameState.topCardBackType
                : row.region
                  ? gameState.discardTopBackIn(row.region)
                  : undefined
        return cardBack(back ?? CardKind.Denizen)
    }

    const payee = (playerId: string | undefined) =>
        playerId ? gameSession.getPlayerName(playerId) : 'the fire'

    function spoken(row: SearchRow): string {
        const tolls = row.favorTo.map((to) => `, give 1 favor to ${payee(to)}`).join('')
        const bottom = row.fromBottom ? ' from the bottom' : ''
        return `Search ${sourceOf(row)}: spend ${row.cost} Supply${tolls}, draw ${row.draw}${bottom}`
    }

    // R-7.1.4 — the favor a toll takes goes to its payee, or is burned for the bandits.
    const payeesOf = (row: SearchRow) => row.favorTo.filter((to): to is string => to !== undefined)
    const burnedOf = (row: SearchRow) => row.favorTo.filter((to) => to === undefined).length
</script>

<!-- A toll's favor token is no taller than the text beside it. -->
{#snippet favor(count: number)}
    <span class="inline-flex items-center gap-0.5"
        >{count}<img
            class="h-[0.8em] w-auto"
            src={favorToken().src}
            width={favorToken().width}
            height={favorToken().height}
            alt="favor"
        /></span
    >
{/snippet}

<div class="flex flex-col gap-1.5" role="list" aria-label="Sources to search">
    {#each rows as row, index (index)}
        <MenuRow
            image={backOf(row)}
            imageAlt=""
            name={nameOf(row)}
            shape="card"
            points={row.region ? { kind: 'pile', region: row.region } : { kind: 'deck' }}
        >
            <MenuChoice
                label={spoken(row)}
                disabled={busy}
                width={choiceWidth}
                onclick={() => gameSession.searchFrom(row)}
            >
                {@const payees = payeesOf(row)}
                {@const burned = burnedOf(row)}
                <span class="flex items-center gap-1.5 whitespace-nowrap text-oath-accent">
                    {row.cost} Supply
                    {#if payees.length > 0}
                        <span>+</span>
                        {@render favor(payees.length)}
                        to
                        {#each payees as playerId, i (i)}<PlayerName {playerId} />{/each}
                    {/if}
                    {#if burned > 0}
                        <span>+</span>
                        {@render favor(burned)}
                        burned
                    {/if}
                </span>
                <span class="text-xs font-normal text-oath-text-muted"
                    >draw {row.draw}{row.fromBottom ? ', from the bottom' : ''}</span
                >
            </MenuChoice>
        </MenuRow>
    {/each}
</div>
