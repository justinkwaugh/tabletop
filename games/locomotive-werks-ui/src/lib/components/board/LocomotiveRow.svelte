<script lang="ts">
    import { locomotiveData, type LocomotiveSpace } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        BOARD_WIDTH,
        BOX,
        CARDS_X,
        COSTS_X,
        COSTS_WIDTH,
        CUSTOMER_BASE_X,
        DIE,
        INITIAL_X,
        NUMERAL,
        ROW_HEIGHT,
        STACK_COUNT_X,
        STRIPE_WIDTH,
        WORKS,
        centredBaseline,
        existingOrderBox,
        rowTop
    } from '$lib/utils/boardLayout.js'
    import { kindColor, kindInk, kindOf, locomotiveName } from '$lib/utils/locomotives.js'
    import KindShape from '../KindShape.svelte'
    import Die from './Die.svelte'
    import OrderBox from './OrderBox.svelte'
    import WorksPlaque from './WorksPlaque.svelte'
    import { orderDieId } from '$lib/animators/shipmentDice.js'
    import { orderEffect } from '$lib/utils/describeAction.js'

    let { space, index }: { space: LocomotiveSpace; index: number } = $props()

    const gameSession = getGameSession()

    const locomotive = $derived(locomotiveData(space.locomotiveId))
    const top = $derived(rowTop(index))
    const middle = $derived(top + ROW_HEIGHT / 2)
    const boxTop = $derived(middle - BOX / 2)
    const color = $derived(kindColor(space.locomotiveId, gameSession.kindPalette))
    const ink = $derived(kindInk(space.locomotiveId, gameSession.kindPalette))
    // Seat order, which never changes, keeps each player's werks in one column.
    const owners = $derived(
        gameSession.boardState.players.flatMap((player, column) => {
            const plant = player.plant(space.locomotiveId)
            return plant ? [{ playerId: player.playerId, plant, column }] : []
        })
    )
    // The Customer Base is one box holding its dice as a stack, the newest on top.
    const STACK_OFFSET = 3
    const MAX_STACK_LAYERS = 3
    const stackLayers = $derived(Math.min(space.customerBase.length, MAX_STACK_LAYERS))
    const COST_LINE = 21
    const costs = $derived([
        { label: 'PURCHASE', value: locomotive.developmentCost },
        { label: 'UPGRADE', value: locomotive.productionCost },
        { label: 'INCOME', value: locomotive.income }
    ])

    const name = $derived(locomotiveName(space.locomotiveId))
    const mine = (playerId: string) => playerId === gameSession.myPlayerId

    // Shipments the player is holding back.
    function held(playerId: string): boolean {
        return mine(playerId) && gameSession.held.includes(space.locomotiveId)
    }

    const developable = $derived(gameSession.developTargets.includes(space.locomotiveId))
    const chosen = $derived(gameSession.chosenLocomotive === space.locomotiveId)
    const shipment = $derived(gameSession.shipmentOf(space.locomotiveId))
    const shipHeld = $derived(gameSession.held.includes(space.locomotiveId))
    // The order die the planned shipment fills or lowers.
    const shipmentSlot = $derived(
        shipment && !shipHeld ? space.existingOrders.indexOf(shipment.plan.face) : -1
    )

    const myPlant = $derived(owners.find((owner) => mine(owner.playerId))?.plant)
    const plannedUnits = $derived(
        myPlant && gameSession.expanding
            ? (gameSession.plannedUnits.get(space.locomotiveId) ?? myPlant.units)
            : undefined
    )

    type WerkView = {
        units?: number
        note?: string
        closing?: boolean
        target?: { selected: boolean }
    }

    // How the acting player's own werk shows while they choose on the board.
    function werkView(playerId: string, units: number): WerkView {
        if (!mine(playerId)) {
            return {}
        }
        if (plannedUnits !== undefined) {
            return {
                units: plannedUnits,
                note: plannedUnits === units ? undefined : `was ${units}`,
                closing: plannedUnits === 0,
                target: { selected: gameSession.openedWerk === space.locomotiveId }
            }
        }
        if (shipment) {
            return {
                note: shipHeld ? 'held' : `+$${shipment.income}`,
                target: { selected: !shipHeld }
            }
        }
        return {}
    }

    type RowTarget = { label: string; pressed: boolean; onselect: () => void }

    // The row takes the press, so the target is easy to hit on a phone.
    const rowTarget: RowTarget | undefined = $derived.by(() => {
        const locomotiveId = space.locomotiveId
        if (developable) {
            return {
                label: `Develop ${name} for $${locomotive.developmentCost}`,
                pressed: chosen,
                onselect: () => gameSession.chooseLocomotive(locomotiveId)
            }
        }
        if (plannedUnits !== undefined) {
            return {
                label: `Buy or upgrade units of your ${name} werk, ${plannedUnits} planned`,
                pressed: gameSession.openedWerk === locomotiveId,
                onselect: () => gameSession.chooseWerk(locomotiveId)
            }
        }
        if (shipment) {
            return {
                label: shipHeld
                    ? `Ship ${name}, now held back`
                    : `Hold back ${name}, now shipping ${shipment.plan.units}: ${orderEffect(shipment.plan)}, for $${shipment.income}`,
                pressed: !shipHeld,
                onselect: () => gameSession.toggleHold(locomotiveId)
            }
        }
        return undefined
    })

    function onRowKey(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            rowTarget?.onselect()
        }
    }
</script>

<g id="lw-row-{space.locomotiveId}" aria-label={name}>
    <line x1="0" x2={BOARD_WIDTH} y1={top + ROW_HEIGHT} y2={top + ROW_HEIGHT} stroke="#b2c1cc"
    ></line>
    <rect x="0" y={top} width={STRIPE_WIDTH} height={ROW_HEIGHT} fill={color}></rect>
    <rect
        x={BOARD_WIDTH - STRIPE_WIDTH}
        y={top}
        width={STRIPE_WIDTH}
        height={ROW_HEIGHT}
        fill={color}
    ></rect>
    {#if gameSession.colorBlind}
        {#each [STRIPE_WIDTH / 2, BOARD_WIDTH - STRIPE_WIDTH / 2] as stripeX (stripeX)}
            <KindShape kind={kindOf(space.locomotiveId)} x={stripeX} y={middle} size={16} />
        {/each}
    {/if}

    {#each Array.from({ length: locomotive.customerBaseBoxes }, (_, slot) => slot) as slot (slot)}
        <OrderBox x={existingOrderBox(slot)} y={boxTop} />
    {/each}
    <OrderBox x={CUSTOMER_BASE_X} y={boxTop} />
    <g id="lw-customer-base-{space.locomotiveId}">
        {#each Array.from({ length: stackLayers }, (_, layer) => layer) as layer (layer)}
            {@const depth = stackLayers - 1 - layer}
            <Die
                x={CUSTOMER_BASE_X + BOX / 2 + depth * STACK_OFFSET}
                y={middle - depth * STACK_OFFSET}
                size={DIE}
                face={depth === 0 ? (space.customerBase.at(-1) ?? 0) : 0}
            />
        {/each}
        {#if space.customerBase.length > 1}
            <text
                class="stack-count"
                x={STACK_COUNT_X}
                y={centredBaseline(middle, 28)}
                fill="#232d36"
                aria-label="{space.customerBase.length} dice in the Customer Base"
                >×{space.customerBase.length}</text
            >
        {/if}
    </g>

    <g pointer-events="none">
        <rect
            x={NUMERAL.x - NUMERAL.width / 2}
            y={top + 6}
            width={NUMERAL.width}
            height={ROW_HEIGHT - 12}
            rx="4"
            fill={color}
        ></rect>
        <text
            class="numeral"
            x={NUMERAL.x}
            y={centredBaseline(middle, 58)}
            text-anchor="middle"
            fill="#16140f">{locomotive.generation}</text
        >
        <text
            class="cards-count"
            x={CARDS_X}
            y={centredBaseline(middle - 6, 30)}
            text-anchor="middle"
            fill={space.cards === 0 ? '#7f8f9b' : '#232d36'}>{space.cards}</text
        >
        <text class="cards-label" x={CARDS_X} y={middle + 25} text-anchor="middle" fill={ink}
            >{space.cards === 1 ? 'CARD' : 'CARDS'}</text
        >
        {#each costs as cost, line (cost.label)}
            {@const baseline = centredBaseline(middle + (line - 1) * COST_LINE, 15)}
            <text class="cost-label" x={COSTS_X} y={baseline} fill={ink}>{cost.label}</text>
            <text
                class="cost"
                x={COSTS_X + COSTS_WIDTH}
                y={centredBaseline(middle + (line - 1) * COST_LINE, 19)}
                text-anchor="end"
                fill="#232d36">${cost.value}</text
            >
        {/each}
    </g>

    <OrderBox x={INITIAL_X} y={boxTop} dashed />
    {#if space.initialOrder !== undefined}
        <Die x={INITIAL_X + BOX / 2} y={middle} size={DIE} face={space.initialOrder} />
    {/if}

    {#if developable}
        <rect
            id="lw-develop-{space.locomotiveId}"
            x={NUMERAL.x - NUMERAL.width / 2 - 8}
            y={top + 3}
            width={INITIAL_X + BOX + 8 - (NUMERAL.x - NUMERAL.width / 2 - 8)}
            height={ROW_HEIGHT - 6}
            rx="8"
            fill={chosen ? '#f2c14e' : 'none'}
            fill-opacity="0.3"
            stroke="#d39a12"
            stroke-width={chosen ? 3.5 : 2.5}
            pointer-events="none"
        ></rect>
    {/if}
    {#each owners as owner (owner.playerId)}
        <WorksPlaque
            x={WORKS.x + owner.column * WORKS.step}
            y={middle - WORKS.height / 2}
            playerId={owner.playerId}
            plant={owner.plant}
            held={held(owner.playerId)}
            {...werkView(owner.playerId, owner.plant.units)}
        />
    {/each}
    {#if shipmentSlot >= 0}
        <rect
            x={existingOrderBox(shipmentSlot) - 4}
            y={boxTop - 4}
            width={BOX + 8}
            height={BOX + 8}
            rx="9"
            fill="none"
            stroke="#d39a12"
            stroke-width="3"
            pointer-events="none"
            aria-hidden="true"
        ></rect>
    {/if}
    <!-- Last in the row, so a die sliding to the Customer Base passes over the rest. -->
    {#each space.existingOrders as face, slot (slot)}
        <g id={orderDieId(space.locomotiveId, slot)}>
            <Die x={existingOrderBox(slot) + BOX / 2} y={middle} size={DIE} {face} />
        </g>
    {/each}
    {#if rowTarget}
        {@const target = rowTarget}
        <rect
            class="row-target"
            x={STRIPE_WIDTH}
            y={top}
            width={BOARD_WIDTH - 2 * STRIPE_WIDTH}
            height={ROW_HEIGHT}
            fill="transparent"
            role="button"
            tabindex="0"
            aria-label={target.label}
            aria-pressed={target.pressed}
            onclick={() => target.onselect()}
            onkeydown={onRowKey}
        ></rect>
    {/if}
</g>

<style>
    .row-target {
        cursor: pointer;
        outline: none;
    }

    .row-target:focus-visible {
        stroke: #232d36;
        stroke-width: 2;
    }

    .numeral {
        font-family: 'LW Abril', Georgia, serif;
        font-size: 58px;
    }

    .stack-count {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 26px;
        font-weight: 700;
    }

    .cards-count {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 30px;
        font-weight: 700;
    }

    .cards-label {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
    }

    .cost-label {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .cost {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 19px;
        font-weight: 700;
    }
</style>
