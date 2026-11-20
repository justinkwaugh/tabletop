<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { HydratedFeudumGameState, KnightRowId } from '@tabletop/feudum'
    import PrimaryButton from '$lib/components/panel/PrimaryButton.svelte'
    import GuildDie from '$lib/components/pieces/GuildDie.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'
    import type { BenchOffer } from '$lib/model/benchOffer.js'
    import { benchViewOf, type GhostPiece } from '$lib/model/benchView.js'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import { ownerPaint, type SeatPaint } from '$lib/model/seatPaint.js'
    import { tradePickerOf, type TradeCard } from '$lib/model/tradePicker.js'
    import BenchGhostPiece from './BenchGhostPiece.svelte'
    import UprightGuild from './UprightGuild.svelte'

    /** Contract, Guild and Feast: the trade picker reads the bench offer and decides nothing. */
    let {
        bench,
        compact = false,
        send,
        state,
        playerId,
        paintOf,
        colourPaintOf,
        pointer,
        onPress
    }: {
        bench: BenchOffer
        compact?: boolean
        send?: Extract<ActionBlock, { kind: 'primary' }>
        state: HydratedFeudumGameState
        playerId: string
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        pointer: RowPointer
        onPress: (choice: PanelChoice) => void
    } = $props()

    /** Contract, Guild and Feast; Phone layout: about 310 px upright on a desk, 210 px on a phone. */
    const DeskBoard = 310
    const PhoneBoard = 210

    let picker = $derived(tradePickerOf(bench, state, playerId))
    let area = $derived(benchViewOf(bench, state, playerId).areas[0])

    function rowPaint(row: KnightRowId): SeatPaint | undefined {
        const held = state.guilds.knight.rows[row]
        return held && ownerPaint(state, row, paintOf, colourPaintOf)
    }
</script>

{#snippet art(pieces: readonly GhostPiece[], size: number)}
    {#each pieces as piece, index (index)}
        <span class="inline-flex"><BenchGhostPiece {piece} {size} {rowPaint} /></span>
    {/each}
{/snippet}

{#snippet costLine(card: TradeCard, size: number)}
    <span class="inline-flex flex-wrap items-center gap-1 text-sm font-semibold" data-cost-gain>
        {#if card.price !== undefined}
            <ShillingToken value={1} {size} />{card.price}
            <span aria-hidden="true">→</span>
        {/if}
        {#if card.gain.length > 0}
            {@render art(card.gain, size)}
        {:else if card.gainWords}
            <span>{card.gainWords}</span>
        {/if}
    </span>
{/snippet}

{#snippet binContent(card: TradeCard)}
    <span class="flex flex-col items-center gap-1 text-center">
        <span class="art flex items-center justify-center gap-0.5" aria-hidden="true">
            {@render art(card.gain.slice(0, 1), compact ? 22 : 40)}
        </span>
        {#if !compact}<span class="name">{card.name}</span>{/if}
        {#if card.price !== undefined}
            <span class="inline-flex items-center gap-0.5 text-sm font-semibold">
                <ShillingToken value={1} size={16} />{card.price}
            </span>
        {/if}
        {#if card.stock && !compact}
            <span class="text-xs" data-stock>{card.stock}</span>
        {/if}
    </span>
{/snippet}

{#snippet choiceCard(card: TradeCard)}
    <div
        class="card flex rounded-lg border border-feudum-frame bg-feudum-parchment text-feudum-ink"
        class:picked={card.item.picked}
        role="group"
        aria-label={card.label}
        data-trade-card={card.item.id}
        data-card-role={card.item.role}
    >
        <span class="art flex shrink-0 items-center justify-center" aria-hidden="true">
            {@render art(card.gain.slice(0, 1), compact ? 26 : 48)}
        </span>
        <span class="body flex min-w-0 flex-col gap-1">
            <span class="name">{card.name}</span>
            {#if card.words && !compact}
                <span class="text-xs" data-words>{card.words}</span>
            {/if}
            <span class="flex flex-wrap items-center justify-between gap-2">
                {@render costLine(card, compact ? 16 : 20)}
                {#if card.press}
                    <span class="buy" data-trade-buy={card.item.id}>
                        <PanelRow choice={card.press} {pointer} {onPress} />
                    </span>
                {/if}
            </span>
        </span>
    </div>
{/snippet}

{#if picker && area}
    <div
        class="picker flex gap-3 text-feudum-text"
        class:compact
        role="group"
        aria-label={picker.title}
        data-bench={picker.title}
        data-trade-picker={picker.guild}
    >
        <UprightGuild
            {area}
            height={compact ? PhoneBoard : DeskBoard}
            {state}
            {paintOf}
            {colourPaintOf}
        />
        <div class="column flex min-w-0 grow flex-col gap-2">
            <p class="flex flex-wrap items-center gap-x-2 text-sm" data-picker-header>
                <GuildDie guild={picker.guild} size={24} phoneSize={20} />
                <strong class="text-feudum-heading">{picker.title}</strong>
                {#if !compact}<span class="text-feudum-text-muted">· {picker.line}</span>{/if}
                <span class="inline-flex items-center gap-1" data-purse>
                    you have <span class="inline-flex" aria-hidden="true"
                        ><ShillingToken value={1} size={16} /></span
                    >{picker.purse}
                </span>
            </p>
            <div
                class="cards flex flex-wrap gap-2"
                class:bins={picker.sends === 'one' && picker.basket}
                data-trade-cards
            >
                {#each picker.cards as card (card.item.id)}
                    {#if picker.basket && card.press}
                        <span
                            class="bin"
                            data-trade-card={card.item.id}
                            data-card-role={card.item.role}
                        >
                            <PanelRow choice={card.press} {pointer} {onPress}>
                                {#snippet face()}
                                    {@render binContent(card)}
                                {/snippet}
                            </PanelRow>
                        </span>
                    {:else}
                        {@render choiceCard(card)}
                    {/if}
                {/each}
            </div>
            {#if picker.basket}
                <p class="flex flex-wrap items-center gap-2 text-sm" data-trade-basket>
                    <span class="text-xs text-feudum-text-muted">Basket</span>
                    {#each picker.basket.picks as piece, index (index)}
                        <span class="inline-flex" data-basket-pick
                            ><BenchGhostPiece {piece} size={22} {rowPaint} /></span
                        >
                    {/each}
                    <span class="inline-flex items-center gap-0.5 font-semibold" data-basket-total
                        >= <ShillingToken value={1} size={16} /><span data-basket-sum
                            >{picker.basket.total}</span
                        ></span
                    >
                </p>
            {/if}
            {#if bench.rows.length > 0}
                <span class="flex flex-wrap items-center gap-1" data-bench-rows>
                    {#each bench.rows as choice (choice.label)}
                        <PanelRow {choice} {pointer} {onPress} />
                    {/each}
                </span>
            {/if}
            {#if bench.refused && (picker.basket?.picks.length ?? 0) > 0}
                <p class="text-xs text-feudum-danger" data-bench-refused>{bench.refused}</p>
            {/if}
            {#if send}
                <span class="send" data-bench-send><PrimaryButton block={send} /></span>
            {/if}
        </div>
    </div>
{/if}

<style>
    .card {
        flex: 1 1 12rem;
        max-width: 15rem;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        text-align: center;
    }

    .card .body {
        align-items: center;
    }

    .card.picked,
    .bin :global([data-picked] button.face) {
        outline: 3px solid var(--feudum-accent);
    }

    .name {
        font-family: var(--feudum-font-title);
        font-variant: small-caps;
        font-size: 1rem;
        line-height: 1.1;
    }

    .bin {
        flex: 0 1 6.5rem;
        min-width: 5.5rem;
    }

    .bin :global([data-row]) {
        display: flex;
        width: 100%;
    }

    .bin :global(button.face) {
        padding: 0.5rem 0.25rem;
        border: 1px solid var(--feudum-frame);
        border-radius: 0.5rem;
        background: var(--feudum-parchment);
        color: var(--feudum-ink);
    }

    .buy :global(button) {
        font-weight: 600;
    }

    .send {
        align-self: flex-start;
    }

    .compact {
        gap: 0.5rem;
    }

    .compact .cards {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 0.375rem;
    }

    .compact .cards.bins {
        flex-direction: row;
        flex-wrap: wrap;
    }

    .compact .card {
        flex: 0 0 auto;
        max-width: none;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        text-align: left;
    }

    .compact .card .body {
        align-items: stretch;
        flex-grow: 1;
    }

    .compact .name {
        font-size: 0.875rem;
    }

    .compact .bin {
        flex: 1 1 3.5rem;
        min-width: 3.25rem;
    }

    .compact .bin :global(button.face) {
        padding: 0.25rem;
    }

    .compact .send {
        align-self: stretch;
    }

    .compact .send :global(button),
    .compact .buy :global(button) {
        min-height: 2.75rem;
    }
</style>
