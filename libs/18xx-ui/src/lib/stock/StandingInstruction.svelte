<script lang="ts">
    import { ignorableStop, type IgnorableStockInstructionStop } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import {
        ignorableStopNoun,
        ignoredStopsText,
        stockInstructionKindLabel,
        stockInstructionText,
        stopReasonText
    } from './stockInstructionText.js'
    import StopConditions, { type StopChoice } from './StopConditions.svelte'
    import { popoverAbove } from '../presentation/popoverPlacement.js'
    import { shareGoalWithin } from '../session/stockInstructionModule.svelte.js'
    import HelpPopover from '../table/HelpPopover.svelte'
    import StopNotice from '../table/StopNotice.svelte'
    import SlidingToggle from '../table/SlidingToggle.svelte'
    import SwitchTrack from '../table/SwitchTrack.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let { session }: { session: EighteenXXSessionView } = $props()
    const gameState = $derived(session.gameState)
    const instructions = $derived(session.instructions)
    const names = $derived({
        companyName: (id: string) => session.companyName(id),
        poolName: (id: string) => session.poolName(id)
    })
    const disabled = $derived(session.busy || session.isViewingHistory || !instructions.canDeclare)
    type InstructionDraft = {
        playerId: string | undefined
        stockRoundNumber: number
        mode?: 'pass' | 'buy'
        companyId?: string
        poolId?: string
        goal: 'floated' | 'shares'
        shareCount: number
        thenPass: boolean
        ignoredStops: IgnorableStockInstructionStop[]
    }
    const playerId = $derived(session.myPlayer?.id)
    const stockRoundNumber = $derived(gameState.stockRound.number)
    let draft = $derived<InstructionDraft>({
        playerId,
        stockRoundNumber,
        goal: 'floated',
        shareCount: 2,
        thenPass: false,
        ignoredStops: []
    })
    function updateDraft(change: Partial<Omit<InstructionDraft, 'playerId' | 'stockRoundNumber'>>) {
        draft = { ...draft, ...change }
    }
    function toggleMode(next: 'pass' | 'buy') {
        updateDraft({ mode: draft.mode === next ? undefined : next, ignoredStops: [] })
    }
    const mode = $derived(instructions.mine?.instruction.kind ?? draft.mode)
    const stopChoice = $derived.by((): StopChoice | undefined => {
        if (instructions.mine)
            return {
                intro: `This ${stockInstructionKindLabel(instructions.mine.instruction.kind)} stops on its own when:`,
                ignoredStops: instructions.mine.instruction.ignoredStops ?? [],
                change: (ignoredStops) => void instructions.setIgnoredStops(ignoredStops)
            }
        if (!mode) return undefined
        return {
            intro: `This ${stockInstructionKindLabel(mode)} will stop on its own when:`,
            ignoredStops: draft.ignoredStops,
            change: (ignoredStops) => updateDraft({ ignoredStops })
        }
    })
    const warningStop = $derived(instructions.warning && ignorableStop(instructions.warning))
    const resumableStop = $derived(
        instructions.lastStop && ignorableStop(instructions.lastStop.stopReason)
    )
    const modeIndex = $derived(mode === 'pass' ? 0 : mode === 'buy' ? 1 : -1)
    const choice = $derived(
        instructions.buyChoices.find((choice) => choice.company.id === draft.companyId)
    )
    const pickerId = $props.id()
    let pickerPanel: HTMLDivElement | undefined = $state()
    let pickerButton: HTMLButtonElement | undefined = $state()
    let pickerOpen = $state(false)
    let pickerBounds = $state({ left: 0, bottom: 0 })
    function preparePicker(event: ToggleEvent) {
        pickerOpen = event.newState === 'open'
        if (pickerOpen && pickerButton) pickerBounds = popoverAbove(pickerButton)
    }
    function pickCompany(companyId: string) {
        updateDraft({ companyId })
        pickerPanel?.hidePopover()
    }
    const pool = $derived(
        choice?.pools.find((pool) => pool.id === draft.poolId) ?? choice?.pools[0]
    )
    const helpInTray = $derived(!instructions.mine && mode === 'buy' && !!choice && !!pool)
    const showsStopReason = $derived(
        instructions.mine ? !!instructions.warning : mode === undefined && !!instructions.lastStop
    )
    const poolIndex = $derived(choice?.pools.findIndex((item) => item.id === pool?.id) ?? -1)
    const shareRange = $derived(
        choice && pool ? instructions.shareGoalRange(choice, pool.id) : undefined
    )
    const floatGoal = $derived(!!choice && !choice.company.floated)
    const goalKind = $derived(!floatGoal ? 'shares' : shareRange ? draft.goal : 'floated')
    const shareGoal = $derived(
        shareRange ? shareGoalWithin(shareRange, draft.shareCount) : draft.shareCount
    )
    function enable() {
        const { ignoredStops } = draft
        if (mode === 'pass') {
            updateDraft({ mode: undefined, ignoredStops: [] })
            void instructions.declarePass(ignoredStops)
            return
        }
        if (!choice || !pool) return
        updateDraft({ mode: undefined, ignoredStops: [] })
        void instructions.declareBuy(
            {
                companyId: choice.company.id,
                preferredPoolId: pool.id,
                until:
                    goalKind === 'floated'
                        ? { kind: 'floated' }
                        : { kind: 'shares', count: shareGoal },
                thenPass: draft.thenPass
            },
            ignoredStops
        )
    }
</script>

{#if instructions.shown}
    <div class="row" role="group" aria-label="Standing instruction">
        <div class="segment" role="group" aria-label="Standing instruction kind">
            <SlidingToggle count={2} selectedIndex={modeIndex}>
                <button
                    disabled={disabled || !!instructions.mine}
                    aria-pressed={mode === 'pass'}
                    onclick={() => toggleMode('pass')}>Autopass</button
                >
                <button
                    disabled={disabled ||
                        !!instructions.mine ||
                        instructions.buyChoices.length === 0}
                    aria-pressed={mode === 'buy'}
                    onclick={() => toggleMode('buy')}>Autobuy</button
                >
            </SlidingToggle>
        </div>
        {#if instructions.mine}
            {@const ignored = ignoredStopsText(instructions.mine.instruction.ignoredStops)}
            <span class="summary"
                >{stockInstructionText(instructions.mine.instruction, names)}{#if ignored}<span
                        class="ignored">{` · ${ignored}`}</span
                    >{/if}</span
            >
            {#if instructions.warning}<span class="warning" role="status"
                    >Stops next turn: {stopReasonText(
                        instructions.warning,
                        names,
                        session.presentation.instructionStopText
                    )}</span
                >{#if warningStop}<button
                        class="link"
                        {disabled}
                        onclick={() => instructions.ignoreWarning()}>Ignore</button
                    >{/if}{/if}
            <button class="commit muted" {disabled} onclick={() => instructions.clear()}
                >Cancel</button
            >
        {:else if mode === undefined && instructions.lastStop}
            <span class="connector" aria-hidden="true">›</span>
            <span class="tray notice" role="status"
                ><StopNotice
                    subject={stockInstructionKindLabel(instructions.lastStop.instruction.kind)}
                    reason={stopReasonText(
                        instructions.lastStop.stopReason,
                        names,
                        session.presentation.instructionStopText
                    )}
                    keepGoing={resumableStop
                        ? {
                              ignoring: ignorableStopNoun[resumableStop],
                              resume: () => void instructions.keepGoing()
                          }
                        : undefined}
                    {disabled}
                /></span
            >
        {:else if mode === 'pass'}
            <button class="commit" {disabled} onclick={enable}>Enable</button>
        {:else if mode === 'buy'}
            <span class="connector" aria-hidden="true">›</span>
            <div class="tray" class:bare={!choice} role="group" aria-label="Autobuy settings">
                <button
                    class="token picker"
                    bind:this={pickerButton}
                    popovertarget={pickerId}
                    aria-expanded={pickerOpen}
                    aria-controls={pickerId}
                    aria-label={choice
                        ? `Company: ${session.companyName(choice.company.id)}`
                        : 'Choose company'}
                    {disabled}
                >
                    {#if choice}
                        <CompanyToken
                            appearance={session.mapView.stations[choice.company.id]}
                            size={24}
                        />
                    {:else}<span class="unknown" aria-hidden="true">?</span>{/if}
                </button>
                <div
                    id={pickerId}
                    bind:this={pickerPanel}
                    class="company-menu"
                    popover="auto"
                    onbeforetoggle={preparePicker}
                    style:left={`${pickerBounds.left}px`}
                    style:bottom={`${pickerBounds.bottom}px`}
                >
                    <div role="listbox" aria-label="Company">
                        {#each instructions.buyChoices as option (option.company.id)}
                            <button
                                role="option"
                                aria-selected={option.company.id === choice?.company.id}
                                onclick={() => pickCompany(option.company.id)}
                            >
                                <CompanyToken
                                    appearance={session.mapView.stations[option.company.id]}
                                    size={22}
                                />
                                <span>{session.companyName(option.company.id)}</span>
                            </button>
                        {/each}
                    </div>
                </div>
                {#if choice && pool}
                    <span class="label">from</span>
                    {#if choice.pools.length > 1}
                        <div class="segment" role="group" aria-label="Preferred pool">
                            <SlidingToggle count={choice.pools.length} selectedIndex={poolIndex}>
                                {#each choice.pools as option (option.id)}
                                    <button
                                        {disabled}
                                        aria-pressed={option.id === pool.id}
                                        onclick={() => updateDraft({ poolId: option.id })}
                                        >{session.poolName(option.id)}</button
                                    >
                                {/each}
                            </SlidingToggle>
                        </div>
                    {:else}<span class="pool-name">{session.poolName(pool.id)}</span>{/if}
                    <span class="label">until</span>
                    <div class="segment" role="group" aria-label="Goal">
                        <SlidingToggle
                            count={floatGoal && shareRange ? 2 : 1}
                            selectedIndex={goalKind === 'floated' || !floatGoal ? 0 : 1}
                        >
                            {#if floatGoal}
                                <button
                                    {disabled}
                                    aria-pressed={goalKind === 'floated'}
                                    onclick={() => updateDraft({ goal: 'floated' })}>Float</button
                                >
                            {/if}
                            {#if shareRange}
                                <button
                                    {disabled}
                                    aria-pressed={goalKind === 'shares'}
                                    onclick={() => updateDraft({ goal: 'shares' })}>I own</button
                                >
                            {/if}
                        </SlidingToggle>
                    </div>
                    {#if goalKind === 'shares' && shareRange}
                        <div class="stepper" role="group" aria-label="Share count">
                            <button
                                disabled={disabled || shareGoal <= shareRange.min}
                                aria-label="Fewer shares"
                                onclick={() => updateDraft({ shareCount: shareGoal - 1 })}>−</button
                            >
                            <span>{shareGoal}</span>
                            <button
                                disabled={disabled || shareGoal >= shareRange.max}
                                aria-label="More shares"
                                onclick={() => updateDraft({ shareCount: shareGoal + 1 })}>+</button
                            >
                        </div>
                    {/if}
                    <button
                        class="switch"
                        role="switch"
                        aria-checked={draft.thenPass}
                        {disabled}
                        onclick={() => updateDraft({ thenPass: !draft.thenPass })}
                        ><SwitchTrack on={draft.thenPass} />then pass</button
                    >
                    {@render help()}
                {/if}
            </div>
            <button class="commit" disabled={disabled || !choice || !pool} onclick={enable}
                >Enable</button
            >
        {/if}
        {#if !helpInTray && !showsStopReason}{@render help()}{/if}
    </div>
{/if}

{#snippet help()}
    <HelpPopover label="When a standing instruction stops">
        <StopConditions choice={stopChoice} {disabled} />
    </HelpPopover>
{/snippet}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-height: 26px;
    }
    @container instruction-bar (max-width: 759px) {
        .tray:not(.notice, .bare) {
            order: 1;
            flex: 1 0 100%;
            box-sizing: border-box;
        }
        .connector:has(+ .tray:not(.notice, .bare)) {
            display: none;
        }
    }
    .summary {
        color: var(--rail-text, #e3e9ef);
    }
    .label {
        color: var(--rail-muted, #7f8e9e);
    }
    .warning {
        color: var(--rail-negative, #d0655c);
    }
    .ignored {
        color: var(--rail-muted, #7f8e9e);
    }
    .link {
        padding: 0;
        color: var(--rail-text, #e3e9ef);
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    button {
        font: inherit;
        line-height: 16px;
        border: 0;
        background: transparent;
        color: var(--rail-muted, #7f8e9e);
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .connector {
        margin-inline: -2px;
        font-size: 16px;
        color: var(--rail-muted, #7f8e9e);
    }
    .tray {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 3px 10px 3px 6px;
        border: 1px solid var(--rail-border, #485666);
        border-radius: 17px;
    }
    .tray.notice {
        display: inline-block;
        padding: 4px 12px;
        color: var(--rail-muted, #7f8e9e);
    }
    .tray.bare {
        padding: 0;
        border-color: transparent;
    }
    .pool-name {
        line-height: 22px;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--rail-text, #e3e9ef);
    }
    .switch {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        color: var(--rail-muted, #7f8e9e);
    }
    .switch[aria-checked='true'] {
        color: var(--rail-text, #e3e9ef);
    }
    .commit {
        padding: 4px 12px;
        border-radius: 6px;
        background: var(--rail-positive, #2e7d5b);
        color: #ffffff;
        font-weight: 600;
    }
    .commit.muted {
        background: transparent;
        border: 1px solid var(--rail-border, #485666);
        color: var(--rail-muted, #7f8e9e);
        font-weight: 400;
    }
    .commit:hover:not(:disabled) {
        background: var(--rail-positive-hover, #35916a);
        color: #ffffff;
    }
    .commit.muted:hover:not(:disabled) {
        background: var(--rail-surface-selected, #3a4c5e);
    }
    .token {
        padding: 0;
        border-radius: 999px;
        border: 2px solid transparent;
        line-height: 0;
        opacity: 0.55;
    }
    .token:hover:not(:disabled) {
        opacity: 1;
    }
    .picker {
        opacity: 1;
        border-color: var(--rail-border, #485666);
    }
    .picker[aria-expanded='true'] {
        border-color: var(--rail-focus, #b8cddd);
    }
    .unknown {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: var(--rail-surface-inset, #1b232d);
        color: var(--rail-muted, #7f8e9e);
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
    }
    .company-menu {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 4px;
        border: 1px solid var(--rail-border, #485666);
        border-radius: 8px;
        background: var(--rail-surface-raised, #222c37);
        box-shadow: 0 6px 18px var(--rail-shadow, #00000066);
    }
    .company-menu [role='listbox'] {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .company-menu [role='option'] {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 4px 4px;
        border-radius: 6px;
        color: var(--rail-text, #e3e9ef);
        font-size: 12px;
        white-space: nowrap;
    }
    .company-menu [role='option']:hover,
    .company-menu [role='option'][aria-selected='true'] {
        background: var(--rail-surface-selected, #3a4c5e);
    }
    .segment {
        --rail-surface: var(--rail-surface-inset, #1b232d);
    }
    .segment button {
        position: relative;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
    }
    .segment button[aria-pressed='true'] {
        color: #ffffff;
        font-weight: 600;
    }
    .stepper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--rail-border, #485666);
        border-radius: 999px;
    }
    .stepper button {
        padding: 2px 8px;
        font-size: 13px;
    }
    .stepper span {
        min-width: 1.5em;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
</style>
