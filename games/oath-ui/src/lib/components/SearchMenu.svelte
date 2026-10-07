<script lang="ts">
    import { CardKind, SearchSource } from '@tabletop/oath'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { cardBack } from '$lib/images/cardImages.js'
    import { favorToken } from '$lib/images/tileImages.js'
    import { regionName } from '$lib/model/names.js'
    import type { SearchRow } from '$lib/model/searchRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.1.1 — a row per source the engine accepts, its price on the button.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let rows = $derived(gameSession.searchRows)
    let busy = $derived(gameSession.busy)

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
</script>

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
                onclick={() => gameSession.searchFrom(row)}
            >
                <span class="flex items-center gap-1.5 whitespace-nowrap text-oath-accent">
                    {row.cost} Supply
                    {#if row.favorTo.length > 0}
                        <span>+</span>
                        <MenuCount count={row.favorTo.length} image={favorToken()} />
                    {/if}
                </span>
                <span class="text-xs font-normal text-oath-text-muted"
                    >draw {row.draw}{row.fromBottom ? ', from the bottom' : ''}</span
                >
            </MenuChoice>
        </MenuRow>
    {/each}
</div>
