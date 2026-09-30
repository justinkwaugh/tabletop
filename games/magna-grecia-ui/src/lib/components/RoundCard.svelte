<script module lang="ts">
    export type RoundCardSeat = {
        playerId: string
        name: string
        color: string
        done?: boolean
        current?: boolean
    }
</script>

<script lang="ts">
    import { enhancedResupply, type ActionCard } from '@tabletop/magna-grecia'
    import CityTileIcon from './icons/CityTileIcon.svelte'
    import ResupplyIcon from './icons/ResupplyIcon.svelte'
    import RoadIcon from './icons/RoadIcon.svelte'

    let {
        card,
        seats,
        upcoming = false
    }: { card: ActionCard; seats: RoundCardSeat[]; upcoming?: boolean } = $props()

    const iconSize = $derived(upcoming ? 32 : 42)
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
</script>

<div class="action-card" class:upcoming>
    <div class="card-face">
        <div class="card-actions">
            {#each rows as row (row.key)}
                <div class="card-row" title={row.label}>
                    {#if row.key === 'roads'}
                        <RoadIcon size={iconSize} />
                    {:else if row.key === 'cities'}
                        <CityTileIcon size={iconSize} />
                    {:else}
                        <ResupplyIcon size={iconSize} />
                    {/if}
                    <span class="basic">{row.basic}</span>
                    <span class="enhanced" title="Enhanced: take only this action"
                        >{row.enhanced}</span
                    >
                </div>
            {/each}
        </div>
        <div class="herm">
            <div class="order-title">Player Order</div>
            <ol class="order">
                {#each seats as seat (seat.playerId)}
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

<style>
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
        color: #a2412a;
        border: 1.5px solid rgba(162, 65, 42, 0.55);
        border-radius: 999px;
        padding: 0 8px;
    }

    .herm {
        width: 150px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        border-radius: 48px 48px 10px 10px;
        padding: 14px 6px 8px;
        background: linear-gradient(#f4efe3, #d9d1bf);
        box-shadow: inset 0 0 0 1px rgba(80, 60, 30, 0.35);
    }

    .order-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
        color: #6b4a2a;
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

    .action-card.upcoming {
        padding: 7px;
        background: linear-gradient(135deg, #a89680, #6f5f4c);
        box-shadow:
            0 4px 10px rgba(40, 24, 8, 0.25),
            inset 0 0 0 2px rgba(255, 240, 215, 0.3);
    }

    .upcoming .card-face {
        gap: 8px;
        padding: 10px;
        background:
            repeating-linear-gradient(90deg, rgba(90, 70, 45, 0.07) 0 2px, transparent 2px 6px),
            #d8c4a5;
        border: 2px dashed rgba(90, 60, 30, 0.45);
    }

    .upcoming .card-actions {
        gap: 7px;
    }

    .upcoming .basic {
        font-size: 34px;
    }

    .upcoming .enhanced {
        font-size: 20px;
        padding: 0 6px;
    }

    .upcoming .herm {
        width: 132px;
        border-radius: 36px 36px 8px 8px;
        padding: 10px 5px 6px;
    }

    .upcoming .order-title {
        font-size: 13px;
    }

    .upcoming .order li {
        padding: 1px 4px;
        font-size: 17px;
    }

    .upcoming .chip {
        width: 17px;
        height: 17px;
    }
</style>
