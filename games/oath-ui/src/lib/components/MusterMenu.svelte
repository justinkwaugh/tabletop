<script lang="ts">
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { cardName, plural, suitName } from '$lib/model/names.js'
    import type { MusterRow } from '$lib/model/musterRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.2 — a row per card at the site a favor can go on, one button each.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.musterRows)
    let owner = $derived(gameSession.musterWarbandOwner)
    let busy = $derived(gameSession.busy)
    const choiceWidth = new ChoiceWidth()

    function spoken(row: MusterRow): string {
        const placed = row.paysSecret ? 'a secret' : '1 favor'
        return `Muster at ${cardName(row.cardId)}: place ${placed}, get ${plural(row.gain, 'warband')}`
    }
</script>

<div class="flex flex-col gap-1.5" role="list" aria-label="Musters at your site">
    {#each rows as row (row.cardId)}
        <MenuRow
            image={suitImage(row.suit)}
            imageAlt={suitName(row.suit)}
            name={cardName(row.cardId)}
            points={{ kind: 'card', cardId: row.cardId }}
        >
            <MenuChoice
                label={spoken(row)}
                disabled={busy}
                width={choiceWidth}
                onclick={() => gameSession.chooseCard(row.cardId)}
            >
                <span class="flex items-center gap-1.5">
                    <MenuCount
                        count={1}
                        image={row.paysSecret ? secretToken() : favorToken()}
                        cost
                    />
                    <span class="text-oath-text-muted">→</span>
                    {#if owner}
                        <MenuCount
                            count={row.gain}
                            image={warbandFigure(gameSession.warbandColor(owner))}
                        />
                    {/if}
                </span>
                {#if row.bankShort}
                    <!-- R-9.3 — the bank gives what it holds. -->
                    <span class="text-xs font-normal text-oath-text-muted"
                        >{row.gain === 0 ? 'bank empty' : 'bank runs short'}</span
                    >
                {/if}
            </MenuChoice>
        </MenuRow>
    {/each}
</div>
