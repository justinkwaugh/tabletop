<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        MAX_CORPS_UNITS,
        MAX_FRENCH_DETACHMENTS,
        commanderDefinition,
        setupLocaleOf
    } from '@tabletop/napoleons-triumph'
    import { OnMapStart, RoomLimit } from '$lib/model/armySetup.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DestinationKind } from '$lib/model/setupSelection.js'
    import type { CorpsSeat, DetachedSeat, FixedBatterySeat } from '$lib/model/setupTable.js'
    import { faceName } from '$lib/utils/faceName.js'
    import { standingAt, type Standing } from '$lib/utils/standing.js'
    import UnitTile from './UnitTile.svelte'

    const SLOT_SCALE = 0.7
    const POOL_SCALE = 0.82

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const table = $derived(gameSession.setupTable)
    const playerId = $derived(gameSession.myPlayerId)
    const openCorps = $derived(table?.corps.find((seat) => seat.open))
    const heldStack = $derived(table?.stacks.find((stack) => stack.held))
    const openKey = $derived(
        openCorps?.commanderId ?? (table?.detached?.open ? 'detached' : 'fixed-battery')
    )
    const corpsToStart = $derived(table?.corpsStillToStartOnMap ?? 0)

    function standingOf(seat: CorpsSeat): Standing {
        if (seat.offMap) {
            return {
                place: 'off the map',
                stance: commanderDefinition(seat.commanderId).reinforcement ? 'enters later' : ''
            }
        }
        return standingAt(game.map, {
            locale: setupLocaleOf(game.map, seat.commanderId).id,
            approach: seat.approach
        })
    }

    const batteryStanding = $derived(
        table?.fixedBattery?.position
            ? standingAt(game.map, table.fixedBattery.position)
            : { place: 'not placed', stance: '' }
    )

    function whyFull(seat: CorpsSeat): string {
        const home = setupLocaleOf(game.map, seat.commanderId)
        return seat.fullBecause === RoomLimit.Locale
            ? `${game.map.label(home.id)} holds only ${home.capacity} units`
            : `a corps holds ${MAX_CORPS_UNITS} units at most`
    }

    function corpsGuidance(seat: CorpsSeat): string {
        const name = commanderDefinition(seat.commanderId).name
        if (seat.room === 0) {
            return `${name}’s corps can take no more: ${whyFull(seat)}.`
        }
        const adding = `Tap units to add them to ${name}’s corps.`
        if (seat.needsOtherKind) {
            return `${adding} One of them must be something other than 2-strength infantry.`
        }
        return seat.offMap
            ? adding
            : `${adding} On the map, tap an approach of its locale to block it.`
    }

    const ON_MAP_REFUSALS: Record<Exclude<OnMapStart, OnMapStart.Offered>, string> = {
        [OnMapStart.TwoChosen]: 'two chosen',
        [OnMapStart.TooManyUnits]: 'too many units'
    }

    function onMapSwitch(seat: CorpsSeat, start: OnMapStart): string {
        if (start !== OnMapStart.Offered) {
            return ON_MAP_REFUSALS[start]
        }
        return seat.offMap ? 'start on map' : 'hold off map'
    }

    function detachedGuidance(seat: DetachedSeat): string {
        if (seat.heldAtItsPost) {
            const { place, stance } = standingAt(game.map, seat.heldAtItsPost.position)
            return `It stands ${stance} at ${place}. Tap an approach of the locale to block it.`
        }
        if (heldStack) {
            return 'Now tap the locale it stands in.'
        }
        return seat.room === 0
            ? `All ${MAX_FRENCH_DETACHMENTS} detachments are made.`
            : 'Tap a unit to set it up on its own, then its locale on the map.'
    }

    function batteryGuidance(seat: FixedBatterySeat): string {
        if (game.santon) {
            return seat.unitId === undefined
                ? 'Tap an artillery unit to make it the fixed battery. With the Santon in use it stands on the Santon.'
                : 'The fixed battery holds the Santon. Tap it to take it back.'
        }
        if (seat.position?.approach !== undefined) {
            return 'The fixed battery is placed. Tap another approach of its locale to turn it, or the battery to take it back.'
        }
        if (seat.position) {
            return 'Now tap the approach the fixed battery blocks.'
        }
        return heldStack
            ? 'Now tap the locale the fixed battery stands in.'
            : 'Tap an artillery unit to make it the fixed battery: it blocks an approach and never moves again.'
    }

    const guidance = $derived.by(() => {
        if (openCorps) {
            return corpsGuidance(openCorps)
        }
        if (table?.detached?.open) {
            return detachedGuidance(table.detached)
        }
        return table?.fixedBattery ? batteryGuidance(table.fixedBattery) : ''
    })

    const progress = $derived.by(() => {
        if (!table) {
            return ''
        }
        if (table.unassigned > 0) {
            const units = table.unassigned === 1 ? '1 unit' : `${table.unassigned} units`
            return corpsToStart > 0
                ? `${units} to assign · choose ${corpsToStart === 1 ? 'one more corps' : 'two corps'} to start on the map`
                : `${units} to assign`
        }
        return table.problem ?? ''
    })

    // Only the row is scrolled: scrollIntoView would scroll the page as well and take the map from under the finger that tapped a corps on it.
    const scrollToOpenSeat: Attachment<HTMLElement> = (row) => {
        void openKey
        const seat = row.querySelector('.nt-setup-seat-open')?.getBoundingClientRect()
        const view = row.getBoundingClientRect()
        if (seat && seat.left < view.left) {
            row.scrollLeft -= view.left - seat.left
        } else if (seat && seat.right > view.right) {
            row.scrollLeft += seat.right - view.right
        }
    }

    const ready = $derived(table?.unassigned === 0 && table.problem === undefined)
</script>

{#snippet emptySlots(needed: number, room: number, lastNeedsOtherKind = false)}
    {#each { length: needed }, index (index)}
        <span class="nt-setup-slot nt-setup-slot-needed"
            >{lastNeedsOtherKind && index === needed - 1 ? 'not 2-str. infantry' : ''}</span
        >
    {:else}
        {#if room > 0}
            <span class="nt-setup-slot"></span>
        {/if}
    {/each}
{/snippet}

{#if table && playerId}
    <div class="nt-setup" style:--nt-army={gameSession.armyColors(playerId).block}>
        <div class="nt-setup-prompt">{guidance}</div>
        <div class="nt-setup-pool" aria-label="Units to assign">
            {#each table.stacks as stack (faceName(stack.face))}
                {@const name = faceName(stack.face)}
                <div class="nt-setup-stack" class:nt-setup-stack-spent={stack.count === 0}>
                    <UnitTile
                        {playerId}
                        face={stack.face}
                        scale={POOL_SCALE}
                        selected={stack.held}
                        dimmed={!stack.offered}
                        label={stack.held ? `Put the ${name} down` : `Take ${name}`}
                        onclick={stack.offered ? () => gameSession.takeFromPool(stack) : undefined}
                    />
                    <span class="nt-setup-stack-count">×{stack.count}</span>
                </div>
            {/each}
        </div>
        <div class="nt-setup-seats" {@attach scrollToOpenSeat}>
            {#each table.corps as seat (seat.commanderId)}
                {@const definition = commanderDefinition(seat.commanderId)}
                {@const standing = standingOf(seat)}
                <div
                    class="nt-setup-seat"
                    class:nt-setup-seat-open={seat.open}
                    data-seat={seat.commanderId}
                >
                    <button
                        type="button"
                        class="nt-setup-head"
                        aria-pressed={seat.open}
                        aria-label="Open {definition.name}’s corps"
                        onclick={() =>
                            gameSession.openSetupDestination({
                                kind: DestinationKind.Corps,
                                commanderId: seat.commanderId
                            })}
                    >
                        <span class="nt-setup-name">{definition.name}</span>
                        <span class="nt-setup-where">{standing.place}</span>
                        <span class="nt-setup-where">{standing.stance}</span>
                    </button>
                    {#if seat.onMapStart !== undefined}
                        <button
                            type="button"
                            class="nt-setup-switch"
                            disabled={seat.onMapStart !== OnMapStart.Offered}
                            onclick={() =>
                                gameSession.startCorpsOnMap(seat.commanderId, seat.offMap)}
                            >{onMapSwitch(seat, seat.onMapStart)}</button
                        >
                    {/if}
                    <div class="nt-setup-slots">
                        {#each seat.unitIds as unitId (unitId)}
                            <UnitTile
                                {playerId}
                                face={game.unit(unitId).face}
                                scale={SLOT_SCALE}
                                label="Take this unit back"
                                onclick={() => gameSession.returnToPool(unitId)}
                            />
                        {/each}
                        {#each seat.creditedIds as unitId (unitId)}
                            <span
                                class="nt-setup-credited"
                                title="Detached; counts towards this corps"
                            >
                                <UnitTile
                                    {playerId}
                                    face={game.unit(unitId).face}
                                    scale={SLOT_SCALE}
                                    dimmed
                                    label="Detached unit that counts towards this corps"
                                />
                            </span>
                        {/each}
                        {@render emptySlots(seat.stillNeeded, seat.room, seat.needsOtherKind)}
                    </div>
                </div>
            {/each}
            {#if table.fixedBattery}
                {@const battery = table.fixedBattery}
                <div
                    class="nt-setup-seat"
                    class:nt-setup-seat-open={battery.open}
                    data-seat="fixed-battery"
                >
                    <button
                        type="button"
                        class="nt-setup-head"
                        aria-pressed={battery.open}
                        aria-label="Open the fixed battery"
                        onclick={() =>
                            gameSession.openSetupDestination({
                                kind: DestinationKind.FixedBattery
                            })}
                    >
                        <span class="nt-setup-name">Fixed battery</span>
                        <span class="nt-setup-where">{batteryStanding.place}</span>
                        <span class="nt-setup-where">{batteryStanding.stance}</span>
                    </button>
                    <div class="nt-setup-slots">
                        {#if battery.unitId !== undefined}
                            {@const unitId = battery.unitId}
                            <UnitTile
                                {playerId}
                                face={game.unit(unitId).face}
                                scale={SLOT_SCALE}
                                label="Take this unit back"
                                onclick={() => gameSession.returnToPool(unitId)}
                            />
                        {:else}
                            {@render emptySlots(1, 1)}
                        {/if}
                    </div>
                </div>
            {/if}
            {#if table.detached}
                {@const detached = table.detached}
                <div
                    class="nt-setup-seat"
                    class:nt-setup-seat-open={detached.open}
                    data-seat="detached"
                >
                    <button
                        type="button"
                        class="nt-setup-head"
                        aria-pressed={detached.open}
                        aria-label="Open the detached units"
                        onclick={() =>
                            gameSession.openSetupDestination({ kind: DestinationKind.Detached })}
                    >
                        <span class="nt-setup-name">Detached</span>
                        <span class="nt-setup-where">on their own</span>
                        <span class="nt-setup-where">{detached.room} left</span>
                    </button>
                    <div class="nt-setup-slots">
                        {#each detached.unitIds as unitId (unitId)}
                            <UnitTile
                                {playerId}
                                face={game.unit(unitId).face}
                                scale={SLOT_SCALE}
                                selected={detached.heldAtItsPost?.unitId === unitId}
                                label="Take this unit back"
                                onclick={() => gameSession.returnToPool(unitId)}
                            />
                        {/each}
                        {@render emptySlots(0, detached.room)}
                    </div>
                </div>
            {/if}
        </div>
        <div class="nt-setup-footer">
            <button
                type="button"
                class="nt-plain-button"
                disabled={!ready}
                onclick={() => gameSession.commitSetup()}>Deploy the army</button
            >
            <span class="nt-setup-progress" class:nt-setup-problem={table.unassigned === 0}
                >{progress}</span
            >
        </div>
    </div>
{/if}

<style>
    .nt-setup {
        --nt-slot-width: 83px;
        --nt-slot-height: 23px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        font-size: 13px;
    }

    .nt-setup-prompt {
        font-size: 15px;
        line-height: 1.3;
        min-height: 1.3em;
    }

    .nt-setup-pool {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 8px;
    }

    .nt-setup-stack {
        display: flex;
        align-items: center;
        gap: 3px;
    }

    .nt-setup-stack-count {
        min-width: 2.2ch;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }

    .nt-setup-stack-spent .nt-setup-stack-count {
        color: color-mix(in srgb, var(--nt-ink) 40%, var(--nt-ground));
    }

    .nt-setup-seats {
        display: flex;
        gap: 5px;
        overflow-x: auto;
    }

    .nt-setup-seat {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: none;
        padding: 5px 5px 5px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--nt-ink) 6%, transparent);
    }

    .nt-setup-seat-open {
        background: color-mix(in srgb, var(--nt-ink) 19%, transparent);
    }

    .nt-setup-head {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: var(--nt-slot-width);
        text-align: left;
        line-height: 1.15;
        cursor: pointer;
    }

    .nt-setup-name {
        font-style: italic;
        font-size: 13px;
        white-space: nowrap;
    }

    .nt-setup-where {
        min-height: 1.15em;
        font-size: 10.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        opacity: 0.8;
    }

    .nt-setup-switch {
        width: var(--nt-slot-width);
        font-size: 10.5px;
        line-height: 1.15;
        text-align: left;
        white-space: nowrap;
        text-decoration: underline dotted;
    }

    .nt-setup-switch[disabled] {
        opacity: 0.55;
        text-decoration: none;
    }

    .nt-setup-slots {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .nt-setup-slots :global(.nt-unit-tile) {
        height: var(--nt-slot-height);
        justify-content: center;
    }

    .nt-setup-credited {
        display: flex;
    }

    .nt-setup-slot {
        width: var(--nt-slot-width);
        height: var(--nt-slot-height);
        border-radius: 3px;
        background: color-mix(in srgb, var(--nt-ink) 5%, transparent);
        background-clip: content-box;
        padding: 3px 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8.5px;
        white-space: nowrap;
    }

    .nt-setup-slot-needed {
        background-color: color-mix(in srgb, var(--nt-army) 30%, transparent);
    }

    .nt-setup-footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }

    .nt-setup-footer .nt-plain-button[disabled] {
        opacity: 0.4;
    }

    .nt-setup-progress {
        opacity: 0.8;
    }

    .nt-setup-problem {
        color: var(--nt-warn);
        opacity: 1;
    }
</style>
