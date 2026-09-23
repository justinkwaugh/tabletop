<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { stockInstructionText } from './stockInstructionText.js'
    import SlidingToggle from '../table/SlidingToggle.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let { session }: { session: EighteenXXSession } = $props()
    const gameState = $derived(session.gameState)
    const instructions = $derived(session.instructions)
    const names = $derived({
        companyName: (id: string) => getCompany(gameState, id).name,
        poolName: (id: string) =>
            gameState.certificatePools.find((pool) => pool.id === id)?.name ?? id
    })
    const disabled = $derived(session.busy || session.isViewingHistory || !instructions.canDeclare)
    let chosenMode = $state<'pass' | 'buy'>()
    let chosenCompanyId = $state<string>()
    let chosenPoolId = $state<string>()
    let goal = $state<'floated' | 'shares'>('floated')
    let shareCount = $state(2)
    let thenPass = $state(true)
    const mode = $derived(instructions.mine?.instruction.kind ?? chosenMode)
    const modeIndex = $derived(mode === 'pass' ? 0 : mode === 'buy' ? 1 : -1)
    const choice = $derived(
        instructions.buyChoices.find((choice) => choice.company.id === chosenCompanyId)
    )
    const pickerId = $props.id()
    let pickerPanel: HTMLDivElement | undefined = $state()
    let pickerButton: HTMLButtonElement | undefined = $state()
    let pickerOpen = $state(false)
    let pickerBounds = $state({ left: 0, bottom: 0 })
    function preparePicker(event: ToggleEvent) {
        pickerOpen = event.newState === 'open'
        if (!pickerOpen || !pickerButton) return
        const bounds = pickerButton.getBoundingClientRect()
        pickerBounds = { left: bounds.left, bottom: window.innerHeight - bounds.top + 6 }
    }
    function pickCompany(companyId: string) {
        chosenCompanyId = companyId
        pickerPanel?.hidePopover()
    }
    const pool = $derived(
        choice?.pools.find((pool) => pool.id === chosenPoolId) ?? choice?.pools[0]
    )
    const poolIndex = $derived(choice?.pools.findIndex((item) => item.id === pool?.id) ?? -1)
    function enable() {
        if (mode === 'pass') {
            chosenMode = undefined
            void instructions.declarePass()
            return
        }
        if (!choice || !pool) return
        chosenMode = undefined
        void instructions.declareBuy({
            companyId: choice.company.id,
            preferredPoolId: pool.id,
            until: goal === 'floated' ? { kind: 'floated' } : { kind: 'shares', count: shareCount },
            thenPass
        })
    }
</script>

{#if instructions.mine || instructions.available}
    <footer class="standing-bar" aria-label="Standing instruction">
        <div class="row">
            <div class="segment" role="group" aria-label="Standing instruction kind">
                <SlidingToggle count={2} selectedIndex={modeIndex}>
                    <button
                        disabled={disabled || !!instructions.mine}
                        aria-pressed={mode === 'pass'}
                        onclick={() => (chosenMode = chosenMode === 'pass' ? undefined : 'pass')}
                        >Autopass</button
                    >
                    <button
                        disabled={disabled ||
                            !!instructions.mine ||
                            instructions.buyChoices.length === 0}
                        aria-pressed={mode === 'buy'}
                        onclick={() => (chosenMode = chosenMode === 'buy' ? undefined : 'buy')}
                        >Autobuy</button
                    >
                </SlidingToggle>
            </div>
            {#if instructions.mine}
                <span class="summary"
                    >{stockInstructionText(instructions.mine.instruction, names)}</span
                >
                {#if instructions.warning}<span class="warning" role="status"
                        >Stops next turn: {instructions.warning}</span
                    >{/if}
                <button class="commit muted" {disabled} onclick={() => instructions.clear()}
                    >Cancel</button
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
                        aria-label={choice ? `Company: ${choice.company.name}` : 'Choose company'}
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
                                    <span>{option.company.name}</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                    {#if choice && pool}
                        <span class="label">from</span>
                        {#if choice.pools.length > 1}
                            <div class="segment" role="group" aria-label="Preferred pool">
                                <SlidingToggle
                                    count={choice.pools.length}
                                    selectedIndex={poolIndex}
                                >
                                    {#each choice.pools as option (option.id)}
                                        <button
                                            {disabled}
                                            aria-pressed={option.id === pool.id}
                                            onclick={() => (chosenPoolId = option.id)}
                                            >{option.name}</button
                                        >
                                    {/each}
                                </SlidingToggle>
                            </div>
                        {:else}<span class="pool-name">{pool.name}</span>{/if}
                        <span class="label">until</span>
                        <div class="segment" role="group" aria-label="Goal">
                            <SlidingToggle count={2} selectedIndex={goal === 'floated' ? 0 : 1}>
                                <button
                                    {disabled}
                                    aria-pressed={goal === 'floated'}
                                    onclick={() => (goal = 'floated')}>Floats</button
                                >
                                <button
                                    {disabled}
                                    aria-pressed={goal === 'shares'}
                                    onclick={() => (goal = 'shares')}>Shares</button
                                >
                            </SlidingToggle>
                        </div>
                        {#if goal === 'shares'}
                            <div class="stepper" role="group" aria-label="Share count">
                                <button
                                    {disabled}
                                    aria-label="Fewer shares"
                                    onclick={() => (shareCount = Math.max(1, shareCount - 1))}
                                    >−</button
                                >
                                <span>{shareCount}</span>
                                <button
                                    {disabled}
                                    aria-label="More shares"
                                    onclick={() => (shareCount += 1)}>+</button
                                >
                            </div>
                        {/if}
                        <button
                            class="switch"
                            role="switch"
                            aria-checked={thenPass}
                            {disabled}
                            onclick={() => (thenPass = !thenPass)}
                            ><span class="knob" aria-hidden="true"></span>then pass</button
                        >
                    {/if}
                </div>
                <button class="commit" disabled={disabled || !choice || !pool} onclick={enable}
                    >Enable</button
                >
            {/if}
        </div>
    </footer>
{/if}

<style>
    .standing-bar {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px 4px 0;
        border-top: 1px solid var(--rail-border, #485666);
        font-size: 12px;
        color: var(--rail-text, #e3e9ef);
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-height: 26px;
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
        border-radius: 999px;
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
    .knob {
        position: relative;
        width: 26px;
        height: 14px;
        border-radius: 999px;
        background: var(--rail-surface-inset, #1b232d);
        border: 1px solid var(--rail-border, #485666);
        transition: background 150ms ease;
    }
    .knob::after {
        content: '';
        position: absolute;
        top: 1px;
        left: 1px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--rail-muted, #7f8e9e);
        transition: transform 150ms ease;
    }
    .switch[aria-checked='true'] .knob {
        background: var(--rail-solid, #40576b);
        border-color: transparent;
    }
    .switch[aria-checked='true'] .knob::after {
        transform: translateX(12px);
        background: #ffffff;
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
