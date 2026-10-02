<script lang="ts">
    import { CardKind, Region } from '@tabletop/oath'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { cardName, regionName } from '$lib/model/names.js'
    import type { TravelChoice, TravelRow } from '$lib/model/travelRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.6 — a row per destination, by region in the board's order, a button per way to pay.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.travelRows)
    let busy = $derived(gameSession.busy)

    const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland]
    let groups = $derived(
        REGIONS.map((region) => ({
            region,
            rows: rows.filter((row) => row.region === region)
        })).filter((group) => group.rows.length > 0)
    )

    const nameOf = (row: TravelRow) => (row.cardId ? cardName(row.cardId) : 'A facedown site')
    const payee = (playerId: string | undefined) =>
        playerId ? gameSession.getPlayerName(playerId) : 'the fire'

    function spoken(row: TravelRow, way: TravelChoice): string {
        const parts = [way.cost > 0 ? `spend ${way.cost} Supply` : 'spend no Supply']
        way.tolls.forEach((cardId, index) => {
            parts.push(`give 1 favor to ${payee(way.favorTo[index])} (${cardName(cardId)})`)
        })
        if (way.flipSecret) parts.push('flip a secret facedown')
        return `Travel to ${nameOf(row)}: ${parts.join(', ')}`
    }

    function tollNote(way: TravelChoice): string {
        return way.tolls
            .map((cardId, index) => `to ${payee(way.favorTo[index])}, ${cardName(cardId)}`)
            .join('; ')
    }
</script>

<div class="flex flex-col gap-1.5">
    {#each groups as group (group.region)}
        <h3
            class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading first:mt-0"
        >
            {regionName(group.region)}
        </h3>
        <div
            class="flex flex-col gap-1.5"
            role="list"
            aria-label="Destinations in the {regionName(group.region)}"
        >
            {#each group.rows as row (row.slotId)}
                <MenuRow
                    image={(row.cardId ? cardImage(row.cardId) : undefined) ??
                        cardBack(CardKind.Site)}
                    imageAlt=""
                    name={nameOf(row)}
                    shape="wide"
                    points={{ kind: 'site', slotId: row.slotId }}
                >
                    {#each row.ways as way, index (index)}
                        <MenuChoice
                            label={spoken(row, way)}
                            disabled={busy}
                            onclick={() => gameSession.travelTo(row.slotId, way)}
                        >
                            <span class="flex items-center gap-1.5 whitespace-nowrap">
                                {way.cost} Supply
                                {#if way.tolls.length > 0}
                                    <span class="text-oath-text-muted">+</span>
                                    <MenuCount count={way.tolls.length} image={favorTokenImage()} />
                                {/if}
                                {#if way.flipSecret}
                                    <span class="text-oath-text-muted">+ flip</span>
                                    <MenuCount count={1} image={secretTokenImage()} />
                                {/if}
                            </span>
                            {#if way.tolls.length > 0}
                                <span class="text-xs font-normal text-oath-text-muted"
                                    >{tollNote(way)}</span
                                >
                            {/if}
                        </MenuChoice>
                    {/each}
                </MenuRow>
            {/each}
        </div>
    {/each}
</div>
