<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { orderEffect } from '$lib/utils/describeAction.js'
    import { locomotiveName } from '$lib/utils/locomotives.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'

    // One line per werk with orders to fill: what selling does, and a press to hold it back or
    // sell it again.
    const gameSession = getGameSession()
</script>

<ul class="sales" aria-label="Your sales">
    {#each gameSession.shipments as shipment (shipment.locomotiveId)}
        {@const held = gameSession.held.includes(shipment.locomotiveId)}
        {@const name = locomotiveName(shipment.locomotiveId)}
        <li class:held>
            <span class="what">
                <LocomotiveBadge locomotiveId={shipment.locomotiveId} />
                <span class="effect"
                    >{shipment.plan.units}
                    {shipment.plan.units === 1 ? 'unit' : 'units'}, {orderEffect(
                        shipment.plan
                    )}</span
                >
            </span>
            <button
                type="button"
                class="toggle"
                aria-pressed={!held}
                onclick={() => gameSession.toggleHold(shipment.locomotiveId)}
                aria-label={held
                    ? `Sell ${name}, now held back`
                    : `Hold back ${name}, now selling ${shipment.plan.units}: ${orderEffect(shipment.plan)}, for $${shipment.income}`}
                >{held ? 'Held' : `Selling · +$${shipment.income}`}</button
            >
        </li>
    {/each}
</ul>

<style>
    .sales {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        max-width: 480px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 4px 10px;
        border-bottom: 1px solid #b2c1cc;
        padding-bottom: 4px;
    }

    li:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .what {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .held .what {
        opacity: 0.45;
    }

    .effect {
        font-size: 15px;
        white-space: nowrap;
    }

    .toggle {
        min-width: 104px;
        min-height: 32px;
        border: 1.5px dashed #627688;
        border-radius: 999px;
        padding: 2px 12px;
        font-size: 14px;
        font-weight: 700;
        color: #46596b;
        white-space: nowrap;
    }

    .toggle[aria-pressed='true'] {
        border: 1.5px solid #d39a12;
        background: rgba(242, 193, 78, 0.45);
        color: #232d36;
    }
</style>
