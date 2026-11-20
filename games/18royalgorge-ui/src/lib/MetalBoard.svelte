<script lang="ts">
    import { CfiId, VgcId } from '@tabletop/18royalgorge'
    import { CompanyToken, counted } from '@tabletop/18xx-ui'
    import type { SessionRoyalGorge } from './session.svelte.js'
    import { depotTurnNote, type SteelColumnView } from './metalBoard.js'
    let { session }: { session: SessionRoyalGorge } = $props()
    const money = $derived(session.presentation.money)
    const steel = $derived(session.steel)
    const gold = $derived(session.gold)
    const tileColors = $derived(session.tileAppearance.colors)
    const colorNames: Readonly<Record<string, string>> = {
        yellow: 'Yellow',
        green: 'Green',
        brown: 'Brown',
        gray: 'Silver'
    }
    const markToken = $derived(
        steel.companyId ? session.mapView.stations[steel.companyId] : undefined
    )
    const MarkWords: Readonly<Record<NonNullable<SteelColumnView['mark']>, string>> = {
        fixed: ', used this turn',
        chosen: ', chosen',
        next: ', the cheapest, used unless another is chosen'
    }
    function columnLabel(color: string, id: string, price: number, mark: SteelColumnView['mark']) {
        return `${colorNames[color]} steel column ${id}: next ${money(price)}${mark ? MarkWords[mark] : ''}`
    }
</script>

<section class="metal-board" aria-label="CF&I and VGC">
    <header>
        <CompanyToken appearance={session.mapView.stations[CfiId]} size={20} />
        <h3>CF&amp;I steel</h3>
        <span class="figure">Treasury {money(steel.cash)}</span>
    </header>
    <div class="steel">
        {#each steel.colors as group (group.color)}
            <div class="group">
                <span class="group-name">{colorNames[group.color]}</span>
                <div class="columns">
                    {#each group.columns as column (column.id)}
                        <button
                            class="column"
                            class:fixed={column.mark === 'fixed'}
                            class:chosen={column.mark === 'chosen' || column.mark === 'next'}
                            disabled={!column.choosable || session.actionsLocked}
                            aria-label={columnLabel(
                                group.color,
                                column.id,
                                column.price,
                                column.mark
                            )}
                            title={columnLabel(group.color, column.id, column.price, column.mark)}
                            onclick={() => session.chooseSteel(group.color, column.id)}
                        >
                            <span class="column-id">{column.id}</span>
                            <span class="cells">
                                {#each column.cubes as cube, index (index)}
                                    <span
                                        class="cell"
                                        class:cube={cube.remaining}
                                        style:--cube-color={tileColors[group.color]}
                                        >{money(cube.price)}</span
                                    >
                                {/each}
                            </span>
                            <span
                                class="price"
                                class:empty={column.cubes.length > 0 &&
                                    !column.cubes.some((cube) => cube.remaining)}
                                >{money(column.price)}</span
                            >
                            {#if (column.mark === 'fixed' || column.mark === 'chosen') && markToken}<span
                                    class="mark"
                                    ><CompanyToken appearance={markToken} size={16} /></span
                                >{/if}
                        </button>
                    {/each}
                </div>
                {#if group.next}<span class="next">next {money(group.next.price)}</span>{/if}
            </div>
        {/each}
    </div>
    {#if steel.depot}
        {@const depot = steel.depot}
        <button
            class="depot"
            class:chosen={depot.turn?.on}
            disabled={!depot.turn?.choosable || session.actionsLocked}
            onclick={() => void session.toggleSteelDepot()}
            ><span class="depot-name">Steel Depot</span>
            <span class="depot-cubes"
                >{#each Array.from({ length: depot.steel }, (_, index) => index) as index (index)}<span
                        class="cell cube small"
                        style:--cube-color={tileColors.yellow}
                    ></span>{/each}</span
            >
            <span class="depot-note"
                >{counted(depot.steel, 'free yellow steel', 'free yellow steel')}{depot.turn
                    ? ` · ${depotTurnNote(depot.steel, depot.turn)}`
                    : ''}</span
            >{#if depot.turn?.on && markToken}<CompanyToken
                    appearance={markToken}
                    size={16}
                />{/if}</button
        >
    {/if}

    <header class="gold-header">
        <CompanyToken appearance={session.mapView.stations[VgcId]} size={20} />
        <h3>VGC gold</h3>
        <span class="figure">Pays {money(gold.dividend)}</span>
    </header>
    <div class="gold" aria-label="Gold track">
        {#each gold.spaces as space, index (index)}
            <span
                class="gold-space"
                class:covered={space.covered}
                class:closed={!space.open && !space.last}
                class:last={space.last}
                title={space.covered
                    ? `Covered by shipped gold`
                    : space.last
                      ? 'Never covered'
                      : space.open
                        ? `Open in ${gold.phase}`
                        : 'Opens in a later phase'}
                >{#if space.covered}<span class="gold-cube"></span>{/if}<span class="gold-value"
                    >{money(space.value)}</span
                ></span
            >
        {/each}
    </div>

    {#if session.debts.length}
        <div class="debts" aria-label="Debts">
            <span class="debts-heading">Debts, {money(session.debtMarkerPrice)} each</span>
            {#each session.debts as debt (debt.companyId)}
                <span class="debt"
                    ><CompanyToken
                        appearance={session.mapView.stations[debt.companyId]}
                        size={16}
                    />
                    {debt.owed} left{debt.penalty
                        ? `, −${counted(debt.penalty, 'space')}`
                        : ''}</span
                >
            {/each}
        </div>
    {/if}
</section>

<style>
    .metal-board {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: max-content;
        padding: 8px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #f6f0e6);
        color: var(--rail-text, #463e35);
        pointer-events: auto;
    }
    header {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 650;
    }
    .figure {
        margin-left: auto;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }
    .steel {
        display: flex;
        gap: 10px;
        align-items: flex-start;
    }
    .group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }
    .group-name,
    .next {
        font-size: 11px;
        color: var(--rail-muted, #817261);
    }
    .columns {
        display: flex;
        gap: 3px;
    }
    .column {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 2px;
        border: 1px solid transparent;
        border-radius: 3px;
        background: none;
        color: inherit;
        font: inherit;
    }
    .column:not(:disabled) {
        cursor: pointer;
        border-color: var(--rail-border, #c7b8a6);
    }
    .column:not(:disabled):hover {
        border-color: var(--rail-focus, #443e35);
    }
    .column.fixed,
    .column.chosen,
    .depot.chosen {
        border-color: var(--rail-focus, #443e35);
        border-width: 2px;
        padding: 1px;
    }
    .column-id {
        font-size: 11px;
        font-weight: 650;
    }
    .cells {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-height: 94px;
        justify-content: flex-end;
    }
    .cell {
        display: grid;
        place-items: center;
        width: 26px;
        height: 22px;
        border: 1px dashed var(--rail-border, #c7b8a6);
        border-radius: 2px;
        font-size: 10px;
        color: var(--rail-muted, #817261);
        font-variant-numeric: tabular-nums;
    }
    .cell.cube {
        border: 1px solid rgb(0 0 0 / 0.35);
        background: var(--cube-color);
        color: #2c261f;
        font-weight: 600;
    }
    .cell.small {
        width: 12px;
        height: 12px;
    }
    .price {
        font-size: 11px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
    }
    .price.empty {
        color: #9b2c22;
    }
    .mark {
        position: absolute;
        top: -9px;
        right: -7px;
    }
    .depot {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 6px;
        border: 1px solid transparent;
        border-radius: 3px;
        background: none;
        color: inherit;
        font: inherit;
        font-size: 12px;
    }
    .depot:not(:disabled) {
        cursor: pointer;
        border-color: var(--rail-border, #c7b8a6);
    }
    .depot-name {
        font-weight: 650;
    }
    .depot-cubes {
        display: flex;
        gap: 2px;
    }
    .depot-note {
        color: var(--rail-muted, #817261);
    }
    .gold-header {
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px solid var(--rail-border, #d6cbbc);
    }
    .gold {
        width: 0;
        min-width: 100%;
        display: flex;
        gap: 3px;
    }
    .gold-space {
        position: relative;
        display: grid;
        place-items: center;
        flex: 1;
        height: 34px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 3px;
        background: #f3e3b0;
        color: #4a3b1c;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .gold-space.closed {
        background: repeating-linear-gradient(-45deg, #e7dcc5 0 4px, #d9ccb2 4px 8px);
        color: #6e6250;
    }
    .gold-space.last {
        background: #c9483c;
        color: #fff;
    }
    .gold-space.covered .gold-value {
        position: absolute;
        bottom: 1px;
        font-size: 9px;
    }
    .gold-cube {
        width: 14px;
        height: 14px;
        margin-bottom: 8px;
        border: 1px solid #7a5a10;
        border-radius: 2px;
        background: #e2b326;
    }
    /* The debts wrap within the steel market's width rather than widen the board. */
    .debts {
        width: 0;
        min-width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        padding-top: 6px;
        border-top: 1px solid var(--rail-border, #d6cbbc);
        font-size: 12px;
    }
    .debts-heading {
        flex-basis: 100%;
        font-weight: 650;
    }
    .debt {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
</style>
