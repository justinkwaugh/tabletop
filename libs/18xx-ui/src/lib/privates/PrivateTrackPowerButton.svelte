<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type {
        PrivateTrackPower,
        TitlePrivatePower
    } from '../session/privateActionsModule.svelte.js'

    let {
        session,
        power,
        label = 'Use'
    }: {
        session: EighteenXXSessionView
        power: PrivateTrackPower | TitlePrivatePower
        label?: string
    } = $props()
    const selected = $derived.by(() => {
        const chosen =
            session.privateActions.titlePower ?? session.privateActions.trackPowerSelection?.value
        return (
            chosen?.privateCompanyId === power.privateCompanyId &&
            chosen.playerId === power.playerId
        )
    })
    function start() {
        if ('kind' in power) session.privateActions.startTitlePower(power)
        else session.privateActions.startTrackPower(power)
    }
</script>

<button
    class="power"
    data-description-exclude
    aria-label={`Use ${getCompany(session.gameState, power.privateCompanyId).name}`}
    aria-pressed={selected}
    disabled={session.busy}
    onclick={start}>{label}</button
>

<style>
    .power {
        display: inline-flex;
        align-items: center;
        padding: 1px 8px;
        border: 1px solid var(--rail-border, #a99983);
        border-radius: 10px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.4;
        cursor: pointer;
    }
    .power:hover:enabled,
    .power[aria-pressed='true'] {
        background: var(--rail-surface-raised, #eee5d8);
        border-color: var(--rail-focus, #796047);
    }
    .power:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
    .power:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
