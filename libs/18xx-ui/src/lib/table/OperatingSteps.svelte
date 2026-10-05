<script lang="ts">
    import { historicalOperatingStepIndex, operatingStepIndex } from './operatingStep.js'
    import OperatingPrivateActions from './OperatingPrivateActions.svelte'
    import OperatingLoanActions from '../loans/OperatingLoanActions.svelte'
    import { operatingStepStatuses } from './operatingStepStatuses.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        privatePurchaseLabel = 'Buy privates',
        readOnly = false
    }: {
        session: EighteenXXSessionView
        privatePurchaseLabel?: string
        readOnly?: boolean
    } = $props()
    const money = $derived(session.presentation.money)
    const context = $derived(session.history.visibleContext)
    const gameState = $derived(readOnly ? context.state : session.gameState)
    const titleSteps = $derived(session.presentation.operatingSteps)
    const currentStep = $derived.by(() => {
        if (titleSteps) {
            const action = session.isViewingHistory ? context.actions.at(-1) : undefined
            const index = titleSteps.findIndex(
                (step) => action && step.actions.includes(action.type)
            )
            const current =
                index >= 0
                    ? index
                    : titleSteps.findIndex((step) => step.states.includes(gameState.machineState))
            return current >= 0 ? current : undefined
        }
        return session.isViewingHistory
            ? historicalOperatingStepIndex(context.actions.at(-1), gameState.machineState)
            : operatingStepIndex(gameState.machineState)
    })
    const steps = $derived(
        titleSteps?.map((step) => step.label) ?? [
            'Track',
            'Station',
            'Run',
            'Payout',
            'Trains',
            ...(session.loans.rules ? ['Loans'] : [])
        ]
    )
    const statuses = $derived.by(() => {
        const actions = readOnly
            ? context.actions
            : session.actions.slice(0, session.gameState.actionCount)
        const summaries = operatingStepStatuses(gameState, actions, money)
        return titleSteps
            ? titleSteps.map((step) => step.status?.(gameState, actions, summaries))
            : Object.values(summaries)
    })
</script>

{#if currentStep !== undefined}
    <nav
        aria-label="Operating steps"
        style:--start-color={currentStep === 0
            ? 'var(--rail-solid, #695543)'
            : 'var(--rail-surface-selected, #ded0c2)'}
        style:--end-color={currentStep === steps.length - 1
            ? 'var(--rail-solid, #695543)'
            : 'var(--rail-surface-raised, #e8ded4)'}
    >
        <div class="steps">
            {#each steps as step, index (step)}
                <button
                    class:current={index === currentStep}
                    class:completed={index < currentStep}
                    aria-current={index === currentStep ? 'step' : undefined}
                    disabled={readOnly || !session.operating.canSkipTo(index)}
                    title={!readOnly && session.operating.canSkipTo(index)
                        ? `Proceed to ${step}, stopping for any required decision`
                        : undefined}
                    onclick={() => session.operating.skipTo(index)}
                >
                    <span>{step}</span>
                    {#if statuses[index]}<small>{statuses[index]}</small>{/if}
                </button>
            {/each}
        </div>
        {#if !readOnly}<div class="privates">
                <OperatingLoanActions {session} />
                <OperatingPrivateActions {session} purchaseLabel={privatePurchaseLabel} />
            </div>{/if}
    </nav>
{/if}

<style>
    nav {
        display: flex;
        align-items: stretch;
        justify-content: center;
        flex-wrap: wrap;
        padding: 0;
        border-bottom: 1px solid var(--rail-border, #cbbcad);
        flex: none;
        width: 100%;
        min-width: 0;
        container-type: inline-size;
        background: linear-gradient(to right, var(--start-color) 50%, var(--end-color) 50%);
    }
    .steps {
        display: flex;
        flex: 1;
        min-width: 0;
        justify-content: center;
    }
    button {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        min-width: 0;
        flex: 0 1 110px;
        border: none;
        padding: 5px clamp(9px, 2cqi, 22px) 5px clamp(14px, 2.5cqi, 27px);
        margin-left: -11px;
        background: var(--rail-surface-raised, #e2d6ca);
        color: var(--rail-text, #685948);
        font: inherit;
        font-size: 12px;
        white-space: nowrap;
        cursor: pointer;
        clip-path: polygon(
            0 0,
            calc(100% - 11px) 0,
            100% 50%,
            calc(100% - 11px) 100%,
            0 100%,
            11px 50%
        );
    }
    button > span {
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    small {
        font-size: 9px;
        line-height: 1.1;
        font-weight: 400;
    }
    button:first-child {
        margin-left: 0;
        padding-left: 17px;
        clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 50%, calc(100% - 11px) 100%, 0 100%);
    }
    button:last-child {
        padding-right: 17px;
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 11px 50%);
    }
    .privates {
        display: flex;
        flex: none;
        align-items: center;
    }
    .privates:empty {
        display: none;
    }
    @container (max-width: 480px) {
        .steps,
        .privates {
            flex-basis: 100%;
        }
        .privates {
            justify-content: center;
            border-top: 1px solid var(--rail-border, #cbbcad);
            background: var(--rail-surface-raised, #e8ded4);
        }
    }
    @container (max-width: 420px) {
        button {
            font-size: 11px;
            padding-block: 4px;
        }
        small {
            font-size: 8px;
            letter-spacing: -0.02em;
        }
        button > span {
            letter-spacing: 0.02em;
        }
        button:first-child {
            padding-left: 4px;
        }
        button:last-child {
            padding-right: 4px;
        }
    }
    button:disabled {
        cursor: default;
        color: var(--rail-muted, #968574);
        background: var(--rail-surface-raised, #e8ded4);
    }
    button.completed {
        color: var(--rail-text, #796856);
        background: var(--rail-surface-selected, #ded0c2);
    }
    button.current {
        background: var(--rail-solid, #695543);
        color: #fffaf3;
    }
    button:not(:disabled):hover {
        background: var(--rail-surface-selected, #cdbba9);
        color: var(--rail-text, #443c34);
    }
    button:focus-visible {
        outline: none;
        background: var(--rail-surface-selected, #bda68f);
        color: var(--rail-text, #30291f);
    }
</style>
