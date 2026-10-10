<script lang="ts">
    import {
        SANTON_LOCALE,
        initialResult,
        santonBatteryPresent,
        type Side
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const attack = $derived(gameSession.attack)
    const draft = $derived(gameSession.battleDraft)
    const approachWide = $derived(attack ? game.map.approach(attack.attackApproach).wide : false)

    const stage = $derived(gameSession.battleStage)
    const picked = $derived(stage?.picked ?? [])
    const wide = $derived(stage?.wide === true)
    const leaders = $derived(stage?.leaders ?? [])
    const orders = $derived(gameSession.battleStage?.orders)
    const defenseLeaders = $derived(attack?.defenseLeaderIds ?? [])
    const needsTarget = $derived(!wide && defenseLeaders.length === 2)
    const target = $derived(needsTarget ? (draft.targetLeaderId ?? defenseLeaders[0]) : undefined)

    const preview = $derived.by(() => {
        if (!attack) {
            return undefined
        }
        const defenseApproach = game.map.approach(attack.defenseApproach)
        const struck = target ? [target] : defenseLeaders
        const faces = (ids: string[]) => ids.flatMap((id) => gameSession.visibleFace(game.unit(id)) ?? [])
        return initialResult({
            attackLeaders: faces(leaders),
            defenseLeaders: faces(struck),
            defendersBlocking: attack.defendersBlocking === true,
            approachPenalties: defenseApproach.penalties,
            penaltiesApplyInReserve: defenseApproach.locale === SANTON_LOCALE && santonBatteryPresent(game),
            guardAttack: attack.guardAttack === true
        })
    })
</script>

<div class="nt-battle-prompt">
    Tap units, here or on the map, to attack with them; tap again to lead.
</div>
<AttackerPicker {side} />
<div class="flex flex-wrap items-center gap-2 pt-1">
    {#if approachWide}
        <button
            type="button"
            class="nt-plain-button nt-battle-small"
            class:nt-chosen={wide}
            aria-pressed={wide}
            onclick={() => gameSession.updateBattleDraft({ pieces: picked, leaders, wide: true })}>Wide attack</button
        >
        <button
            type="button"
            class="nt-plain-button nt-battle-small"
            class:nt-chosen={!wide}
            aria-pressed={!wide}
            onclick={() => gameSession.updateBattleDraft({ pieces: picked, leaders, wide: false })}>Narrow attack</button
        >
    {/if}
    {#if needsTarget}
        {#each defenseLeaders as id, index (id)}
            <button
                type="button"
                class="nt-plain-button nt-battle-small"
                class:nt-chosen={target === id}
                aria-pressed={target === id}
                onclick={() => gameSession.updateBattleDraft({ pieces: picked, leaders, targetLeaderId: id })}
                >Strike the {index === 0 ? 'first' : 'second'} leading unit</button
            >
        {/each}
    {/if}
</div>
<div class="flex flex-wrap items-center gap-3 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!orders || stage?.problem !== undefined}
        onclick={() => orders && gameSession.declareAttack(orders, wide, leaders, target)}
    >
        Attack{leaders.length === 0 ? ' with no leading unit' : ''}
    </button>
    {#if stage?.problem}
        <span class="nt-battle-warning">{stage.problem}.</span>
    {:else if preview !== undefined && orders}
        <span class="nt-battle-result">Initial result {preview > 0 ? '+' : ''}{preview}</span>
    {/if}
</div>
