<script lang="ts">
    import { SHARES_PER_RAILROAD, type RailroadId } from '@tabletop/texas-special'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import ShareCertificate, {
        CERTIFICATE_HEIGHT,
        CERTIFICATE_WIDTH
    } from './ShareCertificate.svelte'
    import Stamp from './Stamp.svelte'

    let {
        railroadId,
        choice,
        selected
    }: { railroadId: RailroadId; choice?: 'build' | 'offer'; selected: boolean } = $props()

    const gameSession = getGameSession()

    const SHARE_OFFSET_X = 4
    const SHARE_OFFSET_Y = 9
    const STACK_STEPS = SHARES_PER_RAILROAD - 1

    const map = $derived(gameSession.gameState.map)
    const definition = $derived(map.railroad(railroadId))
    const style = $derived(RAILROAD_STYLE[railroadId])
    const railroad = $derived(gameSession.gameState.railroad(railroadId))
    const sharesLeft = $derived(gameSession.gameState.unsoldShares(railroadId))

    function choose() {
        if (choice === 'offer') {
            void gameSession.offerShare(railroadId, false)
        } else if (choice === 'build') {
            gameSession.selectRailroad(railroadId)
        }
    }
</script>

{#snippet body()}
    <div class="head" style:background={style.fill} style:color={style.text}>
        <span class="short" title={definition.name}>{definition.shortName}</span>
        <span class="treasury">
            <span class="treasury-label">Treasury</span>
            <span class="money">${railroad.treasury}</span>
        </span>
    </div>
    <div class="ledger">
        <div class="pile" title="{sharesLeft} of {SHARES_PER_RAILROAD} shares left for sale">
            {#if sharesLeft > 0}
                <span
                    class="stack"
                    style:width="{CERTIFICATE_WIDTH + SHARE_OFFSET_X * STACK_STEPS}px"
                    style:height="{CERTIFICATE_HEIGHT + SHARE_OFFSET_Y * STACK_STEPS}px"
                >
                    {#each Array.from({ length: sharesLeft }, (_, index) => STACK_STEPS - sharesLeft + 1 + index) as step (step)}
                        <span
                            class="stacked"
                            aria-hidden="true"
                            style:left="{SHARE_OFFSET_X * step}px"
                            style:top="{SHARE_OFFSET_Y * step}px"
                        >
                            <ShareCertificate {railroadId} labelled={step === STACK_STEPS} />
                        </span>
                    {/each}
                </span>
                <span class="count">{sharesLeft} left</span>
            {:else}
                <span class="sold-out">
                    <span
                        class="empty-slot"
                        style:width="{CERTIFICATE_WIDTH}px"
                        style:height="{CERTIFICATE_HEIGHT}px"
                    ></span>
                    <Stamp label="All sold" />
                </span>
            {/if}
        </div>
        {#if railroad.open}
            <div class="rows">
                <div class="entry" title="Income: the settlements along its track">
                    <span>Income</span><span class="money"
                        >${gameSession.shownState.income(railroadId)}</span
                    >
                </div>
                <div class="entry" title="Value: its track and external connections">
                    <span>Value</span><span class="money"
                        >${gameSession.shownState.value(railroadId)}</span
                    >
                </div>
                <div
                    class="entry"
                    title="Dividend per share: income ÷ {SHARES_PER_RAILROAD}, rounded up"
                >
                    <span>Dividend</span><span class="money"
                        >${gameSession.shownState.dividendPerShare(railroadId)}</span
                    >
                </div>
                <div
                    class="entry"
                    title="Final payoff per share: (value + income) ÷ shares sold, rounded up"
                >
                    <span>Final Payoff</span><span class="money"
                        >${gameSession.shownState.finalPayoffPerShare(railroadId)}</span
                    >
                </div>
            </div>
        {:else}
            <div class="closed-note">
                {map.opensInInitialOffering(railroadId)
                    ? 'Opens in the initial offering'
                    : `Opens when track reaches ${map.settlement(definition.homeId).name}`}
            </div>
        {/if}
    </div>
{/snippet}

{#if choice}
    <div
        class="card choosable"
        class:selected
        class:closed={!railroad.open}
        role="button"
        tabindex="0"
        aria-label={choice === 'offer'
            ? `Offer a ${definition.shortName} share`
            : `Choose the ${definition.shortName}`}
        onclick={choose}
        onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                choose()
            }
        }}
    >
        {@render body()}
    </div>
{:else}
    <div class="card" class:selected class:closed={!railroad.open}>
        {@render body()}
    </div>
{/if}

<style>
    .card {
        overflow: hidden;
        border: 2px solid #28394d;
        border-radius: 6px;
        background: #fdfdfb;
        color: #18222f;
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 13px;
        box-shadow: 0 1px 3px rgba(16, 22, 30, 0.15);
    }

    .card.closed {
        opacity: 0.6;
    }

    .card.selected {
        border-color: #c8961a;
        box-shadow: 0 0 0 2px #c8961a;
    }

    .card.choosable {
        cursor: pointer;
        border: 2px dashed #c8961a;
        background: #fdfdfb;
        opacity: 1;
        outline: none;
    }

    .card.choosable:hover,
    .card.choosable:focus-visible {
        background: #eef1f2;
        box-shadow: 0 0 0 2px #c8961a;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-left: 8px;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
    }

    .short {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 16px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .treasury {
        display: flex;
        align-items: center;
        align-self: stretch;
        gap: 6px;
        min-height: 24px;
        font-family: 'SAR Bitter', Georgia, serif;
    }

    .treasury-label {
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.85;
    }

    .treasury .money {
        border-left-color: rgba(255, 255, 255, 0.45);
    }

    .ledger {
        display: flex;
        border-bottom: 1px solid #cfd7dd;
    }

    .pile {
        position: relative;
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        width: 78px;
        padding: 5px 0 3px;
        border-right: 1px solid #cfd7dd;
        background: #fdfdfb;
        --stamp-size: 9px;
    }

    .stack {
        position: relative;
    }

    .stacked {
        position: absolute;
        display: flex;
        border-radius: 2px;
        box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
    }

    .sold-out {
        display: flex;
        flex: 1;
        align-items: center;
        align-self: stretch;
        justify-content: center;
    }

    .empty-slot {
        box-sizing: border-box;
        border: 1.5px dashed #c4b496;
        border-radius: 2px;
    }

    .count {
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
    }

    .rows {
        display: flex;
        flex: 1;
        flex-direction: column;
    }

    .entry {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        padding-left: 8px;
        border-bottom: 1px solid #cfd7dd;
    }

    .entry:last-child {
        border-bottom: 0;
    }

    .entry:nth-child(even) {
        background: rgba(48, 69, 94, 0.07);
    }

    .money {
        display: flex;
        align-items: center;
        align-self: stretch;
        justify-content: flex-end;
        min-width: 52px;
        padding: 0 8px;
        border-left: 1px solid #d9b98a;
        font-size: 15px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .closed-note {
        display: flex;
        flex: 1;
        align-items: center;
        padding: 0 8px;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
        color: #2f445c;
    }
</style>
