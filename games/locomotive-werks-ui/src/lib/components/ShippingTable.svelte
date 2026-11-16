<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { orderEffect } from '$lib/utils/describeAction.js'
    import { locomotiveName } from '$lib/utils/locomotives.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'

    // A selling turn as a table: each werk that can ship, how many units go, what happens to the
    // order die they fill, and the income, with a button to hold it back.
    const gameSession = getGameSession()

    const plannedIncome = $derived(
        gameSession.plannedShipments.reduce((sum, shipment) => sum + shipment.income, 0)
    )
</script>

<div class="scroll">
    <table>
        <thead>
            <tr>
                <th>Werk</th>
                <th class="number">Units</th>
                <th>Order</th>
                <th class="number">Income</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {#each gameSession.shipments as shipment (shipment.locomotiveId)}
                {@const held = gameSession.held.includes(shipment.locomotiveId)}
                <tr class:held>
                    <td><LocomotiveBadge locomotiveId={shipment.locomotiveId} /></td>
                    <td class="number strong">{shipment.plan.units}</td>
                    <td>{held ? 'Holding' : orderEffect(shipment.plan)}</td>
                    <td class="number strong">{held ? '—' : `$${shipment.income}`}</td>
                    <td>
                        <button
                            type="button"
                            class="toggle"
                            aria-pressed={!held}
                            aria-label="{held ? 'Ship' : 'Hold'} {locomotiveName(
                                shipment.locomotiveId
                            )}"
                            onclick={() => gameSession.toggleHold(shipment.locomotiveId)}
                            >{held ? 'Ship' : 'Hold'}</button
                        >
                    </td>
                </tr>
            {/each}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3">Total</td>
                <td class="number strong">${plannedIncome}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</div>

<style>
    .scroll {
        max-width: 100%;
        overflow-x: auto;
    }

    table {
        border-collapse: collapse;
        font-size: 14px;
    }

    th {
        border-bottom: 1.5px solid #a7b8c5;
        padding: 2px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-align: left;
        text-transform: uppercase;
        color: #46596b;
    }

    td {
        border-bottom: 1px solid #d0dae2;
        padding: 4px 10px;
        vertical-align: middle;
        white-space: nowrap;
    }

    tfoot td {
        border-bottom: none;
        border-top: 1.5px solid #a7b8c5;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #46596b;
    }

    tfoot .strong {
        color: #232d36;
    }

    .number {
        text-align: center;
    }

    .strong {
        font-size: 17px;
        font-weight: 700;
    }

    tr.held td:not(:last-child) {
        color: #627688;
        font-style: italic;
    }

    .toggle {
        min-width: 52px;
        border: 1.5px solid #232d36;
        border-radius: 999px;
        padding: 0 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    @media (max-width: 639px) {
        th,
        td {
            padding-inline: 4px;
        }

        th {
            font-size: 9.5px;
            letter-spacing: 0.02em;
        }

        .toggle {
            padding-inline: 6px;
        }
    }
</style>
