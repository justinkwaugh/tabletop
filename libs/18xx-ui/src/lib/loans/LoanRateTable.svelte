<script lang="ts">
    import { LoanRateTableHeight, type LoanRateTableView } from './loanRateTable.js'
    import { MarketScenePadding } from '../stock/marketTokenLayout.js'

    let { view, renderScale = 1 }: { view: LoanRateTableView; renderScale?: number } = $props()
</script>

<section
    class="loan-table"
    aria-label="Loan interest table"
    style:--render-scale={renderScale}
    style:height={`${LoanRateTableHeight * renderScale}px`}
    style:margin={`0 ${MarketScenePadding * renderScale}px ${MarketScenePadding * renderScale}px`}
>
    <ol class="rows">
        {#each view.rows as row (row.rate)}<li
                class="row {row.standing}"
                class:charged={row.charged}
                aria-current={row.standing === 'current' ? 'true' : undefined}
                aria-label={`${row.rate}%: ${row.taken} of ${row.loans} loans taken`}
            >
                <span class="rate">{row.rate}%</span>
                <span class="loans" aria-hidden="true"
                    >{#each { length: row.loans }, loan (loan)}<span
                            class="loan"
                            class:taken={loan < row.taken}
                        ></span>{/each}</span
                >
            </li>{/each}
    </ol>
</section>

<style>
    .loan-table {
        --loan-ink: light-dark(#30271f, var(--rail-text, #e3e9ef));
        --loan-muted: light-dark(#7c6f5f, var(--rail-muted, #a6b2bf));
        --loan-chip: light-dark(#b8432f, #d65f49);
        --loan-socket: light-dark(#cbbfad, #56636f);
        box-sizing: border-box;
        pointer-events: auto;
        padding: calc(6px * var(--render-scale)) calc(8px * var(--render-scale));
        border: calc(1px * var(--render-scale)) solid
            light-dark(#a4b3a7, var(--rail-border, #485666));
        background: light-dark(#fffefa, var(--rail-surface-raised, #2b3744));
        color: var(--loan-ink);
        font:
            calc(13px * var(--render-scale)) / 1.3 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    .rows {
        display: flex;
        gap: calc(4px * var(--render-scale));
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .row {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: calc(5px * var(--render-scale));
        padding: calc(5px * var(--render-scale)) 0 calc(6px * var(--render-scale));
        border-radius: calc(4px * var(--render-scale));
    }
    .row.charged {
        outline: calc(1.5px * var(--render-scale)) dashed var(--loan-muted);
        outline-offset: calc(-1.5px * var(--render-scale));
    }
    .row.used > * {
        opacity: 0.45;
    }
    .rate {
        color: var(--loan-muted);
        font-weight: 600;
    }
    /* The current rate keeps its printed yellow in dark mode, as a market zone's solid fill does. */
    .current .rate {
        padding: 0 calc(8px * var(--render-scale));
        border-radius: calc(4px * var(--render-scale));
        background: #f6df81;
        color: #30271f;
        font-size: calc(15px * var(--render-scale));
        font-weight: 700;
        line-height: calc(19px * var(--render-scale));
        margin-top: calc(-3px * var(--render-scale));
    }
    .loans {
        display: flex;
        gap: calc(3px * var(--render-scale));
    }
    .loan {
        width: calc(8px * var(--render-scale));
        height: calc(12px * var(--render-scale));
        border-radius: calc(2px * var(--render-scale));
        background: var(--loan-chip);
    }
    .loan.taken {
        background: none;
        box-shadow: inset 0 0 0 calc(1px * var(--render-scale)) var(--loan-socket);
    }
</style>
