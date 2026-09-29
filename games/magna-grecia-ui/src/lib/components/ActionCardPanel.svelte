<script lang="ts">
    import { enhancedResupply } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CityIcon from './icons/CityIcon.svelte'
    import OracleIcon from './icons/OracleIcon.svelte'
    import ResupplyIcon from './icons/ResupplyIcon.svelte'
    import RoadIcon from './icons/RoadIcon.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const card = $derived(state.currentCard())
    const rows = $derived([
        { key: 'roads', label: 'Roads', basic: card.roads, enhanced: card.roads + 1 },
        { key: 'cities', label: 'Cities', basic: card.cities, enhanced: card.cities + 1 },
        {
            key: 'resupply',
            label: 'Resupply',
            basic: card.resupply,
            enhanced: enhancedResupply(card.resupply)
        }
    ])
    const turnOrder = $derived(
        state.roundOrder.map((playerId, index) => ({
            playerId,
            name: gameSession.getPlayerName(playerId),
            color: gameSession.colors.getPlayerUiColor(playerId),
            done: !!state.result || index < state.turnIndex,
            current: !state.result && index === state.turnIndex
        }))
    )
    const remaining = $derived(state.roundCount - state.round - 1)
    const upcoming = $derived(state.result ? undefined : state.upcomingCard())
    const upcomingValues = $derived(
        upcoming
            ? [
                  { key: 'roads', label: 'Roads', value: upcoming.roads },
                  { key: 'cities', label: 'Cities', value: upcoming.cities },
                  { key: 'resupply', label: 'Resupply', value: upcoming.resupply }
              ]
            : []
    )
    const upcomingOrder = $derived(
        upcoming
            ? state.turnOrderForCard(upcoming).map((playerId) => ({
                  playerId,
                  name: gameSession.getPlayerName(playerId),
                  color: gameSession.colors.getPlayerUiColor(playerId)
              }))
            : []
    )
</script>

<aside class="card-panel">
    <div class="round-label">
        Round <strong>{state.round + 1}</strong> of {state.roundCount}
    </div>

    <div class="action-card">
        <div class="card-face">
            <div class="card-actions">
                {#each rows as row (row.key)}
                    <div class="card-row">
                        {#if row.key === 'roads'}
                            <RoadIcon size={42} />
                        {:else if row.key === 'cities'}
                            <CityIcon size={42} />
                        {:else}
                            <ResupplyIcon size={42} />
                        {/if}
                        <span class="basic">{row.basic}</span>
                        <span class="enhanced" title="Enhanced: take only this action"
                            >{row.enhanced}</span
                        >
                    </div>
                {/each}
            </div>
            <div class="herm">
                <OracleIcon size={42} />
                <ol class="order">
                    {#each turnOrder as seat (seat.playerId)}
                        <li
                            class:done={seat.done}
                            class:current={seat.current}
                            style:--seat={seat.color}
                            title={seat.name}
                        >
                            <span class="chip"></span>
                            <span class="seat-name">{seat.name}</span>
                        </li>
                    {/each}
                </ol>
            </div>
        </div>
    </div>

    <p class="hint">Take two actions, or one enhanced to the higher number.</p>

    {#if upcoming}
        <section class="upcoming" aria-label="Upcoming round">
            <div class="upcoming-label">Upcoming round <strong>{state.round + 2}</strong></div>
            <div class="upcoming-card">
                <div class="upcoming-values">
                    {#each upcomingValues as item (item.key)}
                        <span class="upcoming-value" title={item.label}>
                            {#if item.key === 'roads'}
                                <RoadIcon size={28} />
                            {:else if item.key === 'cities'}
                                <CityIcon size={28} />
                            {:else}
                                <ResupplyIcon size={28} />
                            {/if}
                            {item.value}
                        </span>
                    {/each}
                </div>
                <ol class="upcoming-order">
                    {#each upcomingOrder as seat (seat.playerId)}
                        <li style:--seat={seat.color} title={seat.name}>
                            <span class="chip"></span>
                            <span class="seat-name">{seat.name}</span>
                        </li>
                    {/each}
                </ol>
            </div>
        </section>
    {/if}

    <div class="deck">
        <div class="deck-stack" aria-hidden="true">
            {#each Array.from({ length: Math.min(remaining, 4) }) as _, index (index)}
                <div
                    class="deck-card"
                    style:transform="translate({index * 4}px, {index * -4}px)"
                ></div>
            {/each}
        </div>
        <span
            >{remaining === 0
                ? 'Final round'
                : `${remaining} ${remaining === 1 ? 'card' : 'cards'} to come`}</span
        >
    </div>
</aside>

<style>
    .card-panel {
        width: 360px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        color: #4a2c12;
        font-family: Georgia, 'Times New Roman', serif;
    }

    .round-label {
        font-size: 30px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
    }

    .round-label strong {
        font-size: 40px;
    }

    .action-card {
        border-radius: 14px;
        padding: 10px;
        background: linear-gradient(135deg, #c98b45, #8c5527);
        box-shadow:
            0 8px 18px rgba(40, 24, 8, 0.35),
            inset 0 0 0 2px rgba(255, 230, 180, 0.35);
    }

    .card-face {
        display: flex;
        gap: 10px;
        border-radius: 8px;
        padding: 14px 12px;
        background:
            repeating-linear-gradient(90deg, rgba(90, 55, 20, 0.08) 0 2px, transparent 2px 6px),
            #c9955a;
        border: 3px double #f3dfb4;
    }

    .card-actions {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .card-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .basic {
        font-size: 48px;
        font-weight: 700;
        line-height: 1;
        color: #4a2208;
        text-shadow: 0 1px 0 rgba(255, 235, 200, 0.5);
    }

    .enhanced {
        font-size: 26px;
        color: rgba(74, 34, 8, 0.55);
        border: 1.5px solid rgba(74, 34, 8, 0.35);
        border-radius: 999px;
        padding: 0 8px;
    }

    .herm {
        width: 150px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        border-radius: 999px 999px 10px 10px;
        padding: 6px 6px 8px;
        background: linear-gradient(#f4efe3, #d9d1bf);
        box-shadow: inset 0 0 0 1px rgba(80, 60, 30, 0.35);
    }

    .order {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .order li {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 5px;
        border-radius: 6px;
        font-size: 21px;
        color: #3b2a18;
    }

    .order li.done {
        opacity: 0.45;
    }

    .order li.current {
        background: rgba(255, 250, 230, 0.95);
        box-shadow: 0 0 0 2px var(--seat);
        font-weight: 700;
    }

    .chip {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        background: var(--seat);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    }

    .seat-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .hint {
        margin: 0;
        font-size: 21px;
        line-height: 1.35;
        text-align: center;
        color: #6b4a2a;
    }

    .deck {
        display: flex;
        align-items: center;
        gap: 18px;
        font-size: 23px;
    }

    .deck-stack {
        position: relative;
        width: 70px;
        height: 50px;
    }

    .deck-card {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 58px;
        height: 36px;
        border-radius: 5px;
        background:
            repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.07) 0 3px, transparent 3px 7px),
            #2d241c;
        box-shadow:
            inset 0 0 0 2px #c9a25a,
            0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .upcoming {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .upcoming-label {
        font-size: 20px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
    }

    .upcoming-card {
        display: flex;
        gap: 10px;
        border-radius: 10px;
        padding: 10px 12px;
        background: rgba(201, 149, 90, 0.35);
        border: 2px dashed rgba(74, 34, 8, 0.4);
    }

    .upcoming-values {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .upcoming-value {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 26px;
        font-weight: 700;
        color: #4a2208;
    }

    .upcoming-order {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .upcoming-order li {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 18px;
        color: #3b2a18;
    }

    .upcoming-order .chip {
        width: 18px;
        height: 18px;
    }
</style>
