<script lang="ts">
    import { HOUSES_PER_PLAYER, PAYMENTS, playerCountRules } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PHASES, phaseNumber } from '$lib/utils/phases.js'
    import House from '../House.svelte'

    let { width }: { width: number } = $props()

    const session = getGameSession()
    const state = $derived(session.gameState)
    const phase = $derived(phaseNumber(state.machineState))
    const rules = $derived(playerCountRules(state.players.length))

    const TRACK_PAD = 18
    const trackWidth = $derived(width - 2 * TRACK_PAD - 8)
    const space = $derived(trackWidth / (HOUSES_PER_PLAYER + 1))
    const markers = $derived.by(() => {
        const byCount = new Map<number, string[]>()
        for (const playerId of state.playerOrder) {
            const count = state.cityCount(playerId)
            byCount.set(count, [...(byCount.get(count) ?? []), playerId])
        }
        return [...byCount.entries()].flatMap(([count, playerIds]) =>
            playerIds.map((playerId, level) => ({ playerId, count, level }))
        )
    })
    const paymentColumns = [0, 7, 14].map((start) =>
        PAYMENTS.slice(start, start + 7).map((amount, index) => ({ cities: start + index, amount }))
    )
</script>

<section class="panel" style:width="{width}px">
    <header>
        <h2>Round {state.round}</h2>
        <ol class="lamps">
            {#each PHASES as name, index (name)}
                <li class:lit={phase === index + 1}>
                    <span class="lamp">{index + 1}</span>
                    <span class="phase">{name}</span>
                </li>
            {/each}
        </ol>
    </header>

    <div class="section-label">Connected cities</div>
    <svg
        width={width - 2 * TRACK_PAD}
        height="74"
        class="track"
        aria-label="Cities connected by each player"
    >
        {#each { length: HOUSES_PER_PLAYER + 1 } as _, count (count)}
            {@const x = 4 + count * space}
            <rect
                x={x + 1}
                y="34"
                width={space - 2}
                height="26"
                rx="3"
                fill={count % 5 === 0 ? '#3b4529' : '#46522f'}
            ></rect>
            <text
                class="tick"
                x={x + space / 2}
                y="48"
                text-anchor="middle"
                dominant-baseline="central">{count}</text
            >
        {/each}
        {#each [{ at: rules.step2Cities, label: 'Step 2' }, { at: rules.endCities, label: 'End' }] as barrier (barrier.label)}
            {@const x = 4 + barrier.at * space}
            <rect x={x - 2} y="30" width="4" height="34" fill="#f3c534"></rect>
            <text class="barrier" {x} y="70" text-anchor="middle">{barrier.label}</text>
        {/each}
        {#each markers as marker (marker.playerId)}
            <House
                x={4 + marker.count * space + space / 2}
                y={22 - marker.level * 7}
                color={session.colors.getPlayerUiColor(marker.playerId)}
                size={1.25}
            />
        {/each}
    </svg>

    <div class="section-label">Payment for cities powered</div>
    <div class="payments">
        {#each paymentColumns as column, index (index)}
            <div class="pay-column">
                {#each column as row (row.cities)}
                    <div class="pay-row">
                        <span class="cities">{row.cities}</span>
                        <span class="amount">{row.amount}</span>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</section>

<style>
    .panel {
        background: #56643f;
        border-radius: 10px;
        border: 3px solid #2f3825;
        box-shadow: inset 0 0 0 2px #6b7a4f;
        color: #ecebe1;
        padding: 10px 18px 16px;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 2px solid #3a4528;
        padding-bottom: 8px;
    }
    h2 {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 30px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
    }
    .lamps {
        display: flex;
        gap: 10px;
    }
    .lamps li {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 76px;
    }
    .lamp {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #2a3220;
        border: 3px solid #1c2216;
        display: grid;
        place-items: center;
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        color: #6d7562;
    }
    .lit .lamp {
        background: #f3c534;
        color: #231d0c;
    }
    .phase {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #aab198;
        white-space: nowrap;
    }
    .lit .phase {
        color: #ecebe1;
        font-weight: 700;
    }
    .section-label {
        font-weight: 600;
        font-size: 15px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #cfd4bd;
        margin: 10px 0 2px;
    }
    .track {
        display: block;
    }
    .tick {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 13px;
        fill: #cfd4bd;
    }
    .barrier {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 11px;
        fill: #f3c534;
        text-transform: uppercase;
    }
    .payments {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px 16px;
        background: #e9e3cc;
        color: #231d0c;
        border-radius: 6px;
        padding: 8px 14px;
    }
    .pay-row {
        display: grid;
        grid-template-columns: 2.2em 1fr;
        align-items: baseline;
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 19px;
        line-height: 1.25;
        border-bottom: 1px solid #cfc7aa;
    }
    .cities {
        color: #6b6250;
        font-size: 15px;
    }
    .cities::after {
        content: ' ⌂';
        font-size: 13px;
    }
    .amount {
        text-align: right;
        padding-right: 0.4em;
    }
</style>
