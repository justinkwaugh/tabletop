<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { PrivatePower } from '../session/privateActionsModule.svelte.js'

    let {
        session,
        power,
        label = 'Use'
    }: {
        session: EighteenXXSessionView
        power: PrivatePower
        label?: string
    } = $props()
    const selected = $derived(session.privateActions.isChosen(power))
</script>

<button
    class="power"
    data-description-exclude
    aria-label={'label' in power
        ? power.label
        : `Use ${session.companyName(power.privateCompanyId)}`}
    aria-pressed={selected}
    disabled={session.busy}
    onclick={() => session.privateActions.startPower(power)}>{label}</button
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
