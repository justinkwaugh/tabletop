<script lang="ts">
    import type { Snippet } from 'svelte'
    import {
        EighteenXXPreferenceDefinition,
        type EighteenXXDisplayPreferences
    } from '@tabletop/18xx'
    import { popoverBelowEnd } from '../presentation/popoverPlacement.js'
    import { capitalized } from '../presentation/words.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import {
        MoreTableColorFields,
        TableColorFields,
        TableStyleOptions,
        tableColor,
        type TableColorField
    } from '../colors/tablePalette.js'
    import {
        PresetSwatchColors,
        TileColorFields,
        TileStyleOptions,
        TokenStyleOptions,
        tilePresetColors,
        type DisplayChoiceOption
    } from './displayChoices.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import { DefaultRouteColors } from '../routes/routePresentation.js'
    import ViewSwitch from './ViewSwitch.svelte'
    import ModalPanel from '../presentation/ModalPanel.svelte'

    let {
        session,
        id,
        anchor,
        open = $bindable(false),
        modalOpen = $bindable(false)
    }: {
        session: EighteenXXSessionView
        id: string
        anchor: HTMLElement | undefined
        open?: boolean
        modalOpen?: boolean
    } = $props()

    type Display = EighteenXXDisplayPreferences
    const DefaultPlayerTint = EighteenXXPreferenceDefinition.family.defaults.playerTint
    const width = 380
    let bounds = $state({ right: 0, top: 0 })
    const display = $derived(session.display)
    const tablePalette = $derived(session.tablePresentation.palette)
    const previewCompanies = $derived(
        session.gameState.companies
            .filter((company) => session.mapView.stations[company.id])
            .slice(0, 5)
    )

    function tileColorName(key: string, name: string): string {
        const printed = session.tileAppearance.colorNames?.[key]
        return printed ? capitalized(printed) : name
    }
    function withPick<Picks extends Readonly<Record<string, string>>>(
        picks: Picks,
        key: string,
        value: string
    ): Picks {
        return { ...picks, [key]: value }
    }
    let queuedPreview: Partial<Display> | undefined
    // A picker sends a value on every pointer move; redraw the table once a frame at most.
    function preview(values: Partial<Display>) {
        if (!queuedPreview)
            requestAnimationFrame(() => {
                if (queuedPreview) session.previewDisplay(queuedPreview)
                queuedPreview = undefined
            })
        queuedPreview = { ...queuedPreview, ...values }
    }
    function save(values: Partial<Display>) {
        queuedPreview = undefined
        session.setDisplay(values)
    }
    function prepare(event: ToggleEvent) {
        open = event.newState === 'open'
        if (open && anchor) bounds = popoverBelowEnd(anchor, width)
        if (!open) closed()
    }
    function closed() {
        open = false
        modalOpen = false
        queuedPreview = undefined
        session.endDisplayPreview()
    }
</script>

{#snippet colorField(
    name: string,
    value: string,
    changed: boolean,
    pick: (value: string) => Partial<Display>
)}
    <label class="color-field" class:changed>
        <input
            type="color"
            {value}
            oninput={(event) => preview(pick(event.currentTarget.value))}
            onchange={(event) => save(pick(event.currentTarget.value))}
        />
        <span>{name}</span>
    </label>
{/snippet}

{#snippet heading(key: string, title: string, changed: boolean, reset: () => void)}
    <div class="heading">
        <h3 id="{id}-{key}">{title}</h3>
        {#if changed}<button class="reset" onclick={reset}>Reset</button>{/if}
    </div>
{/snippet}

{#snippet choices(
    key: string,
    options: readonly DisplayChoiceOption[],
    current: string,
    choose: (value: string) => void,
    swatch?: Snippet<[string]>
)}
    <div class="choices" class:presets={!!swatch} role="radiogroup" aria-labelledby="{id}-{key}">
        {#each options as option (option.value)}
            <button
                role="radio"
                aria-checked={current === option.value}
                onclick={() => choose(option.value)}
                >{@render swatch?.(option.value)}{option.name}</button
            >
        {/each}
    </div>
{/snippet}

{#snippet presetSwatch(style: string)}
    {@const colors = tilePresetColors(style, session.titleTileColors)}
    <span class="swatches" aria-hidden="true"
        >{#each PresetSwatchColors as color (color)}<span style:background={colors[color]}
            ></span>{/each}</span
    >
{/snippet}

{#snippet tableFields(fields: readonly TableColorField[])}
    <div class="color-fields">
        {#each fields as field (field.key)}
            {@render colorField(
                field.name,
                tableColor(tablePalette, field.key),
                field.key in display.tableColors,
                (value) => ({ tableColors: withPick(display.tableColors, field.key, value) })
            )}
        {/each}
    </div>
{/snippet}

{#snippet content()}
    <p class="scope">Applies to every 18xx game.</p>

    <section aria-labelledby="{id}-tokens">
        <h3 id="{id}-tokens">Tokens</h3>
        {@render choices('tokens', TokenStyleOptions, display.tokenStyle, (tokenStyle) =>
            session.setDisplay({ tokenStyle })
        )}
        {#if previewCompanies.length}
            <div class="token-preview" aria-hidden="true">
                {#each previewCompanies as company (company.id)}
                    <CompanyToken appearance={session.mapView.stations[company.id]} size={28} />
                {/each}
            </div>
        {/if}
    </section>

    <section aria-labelledby="{id}-map">
        {@render heading('map', 'Map colors', Object.keys(display.tileColors).length > 0, () =>
            session.setDisplay({ tileColors: {} })
        )}
        {@render choices(
            'map',
            TileStyleOptions,
            display.tileStyle,
            (tileStyle) => session.setDisplay({ tileStyle, tileColors: {} }),
            presetSwatch
        )}
        <div class="color-fields">
            {#each TileColorFields as field (field.key)}
                {@render colorField(
                    tileColorName(field.key, field.name),
                    display.tileColors[field.key] ?? session.tileStyleColors[field.key],
                    field.key in display.tileColors,
                    (value) => ({ tileColors: withPick(display.tileColors, field.key, value) })
                )}
            {/each}
        </div>
    </section>

    <section aria-labelledby="{id}-routes">
        {@render heading(
            'routes',
            'Route colors',
            Object.keys(display.routeColors).length > 0,
            () => session.setDisplay({ routeColors: {} })
        )}
        <div class="color-fields routes">
            {#each DefaultRouteColors as color, place (place)}
                {@render colorField(
                    `${place + 1}`,
                    display.routeColors[place] ?? color,
                    place in display.routeColors,
                    (value) => ({ routeColors: withPick(display.routeColors, `${place}`, value) })
                )}
            {/each}
        </div>
    </section>

    <section aria-labelledby="{id}-players">
        {@render heading(
            'players',
            'Player colors',
            Object.keys(display.playerColors).length > 0 ||
                display.playerTint !== DefaultPlayerTint,
            () => session.setDisplay({ playerColors: {}, playerTint: DefaultPlayerTint })
        )}
        <div class="color-fields players">
            {#each session.seatColors as color (color)}
                {@render colorField(
                    capitalized(color),
                    session.seatColorValue(color),
                    color in display.playerColors,
                    (value) => ({ playerColors: withPick(display.playerColors, color, value) })
                )}
            {/each}
        </div>
        <label class="tint-field" class:changed={display.playerTint !== DefaultPlayerTint}>
            <span>Card tint</span>
            <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={display.playerTint}
                oninput={(event) => preview({ playerTint: event.currentTarget.valueAsNumber })}
                onchange={(event) => save({ playerTint: event.currentTarget.valueAsNumber })}
            />
            <output>{display.playerTint}%</output>
        </label>
    </section>

    <section aria-labelledby="{id}-table">
        {@render heading('table', 'Table colors', Object.keys(display.tableColors).length > 0, () =>
            session.setDisplay({ tableColors: {} })
        )}
        {@render choices('table', TableStyleOptions, display.tableStyle, (tableStyle) =>
            session.setDisplay({ tableStyle, tableColors: {} })
        )}
        {@render tableFields(TableColorFields)}
        <details
            class="more"
            open={MoreTableColorFields.some((field) => field.key in display.tableColors)}
        >
            <summary>More colors</summary>
            {@render tableFields(MoreTableColorFields)}
        </details>
    </section>

    {#if session.publishedArtworkAvailable}
        <section aria-label="Published artwork">
            <ViewSwitch
                enabled={session.publishedArtwork}
                onToggle={() => session.toggleArtwork()}
                label="Published artwork"
                title="Draw this game with its published board, cards and tokens"
            />
            <p class="scope">This game only.</p>
        </section>
    {/if}
{/snippet}

{#if modalOpen}
    <ModalPanel
        label="Display"
        title="Display"
        closeLabel="Close display"
        maxWidth="420px"
        onclose={closed}
    >
        <div class="modal-content">{@render content()}</div>
    </ModalPanel>
{/if}
<div
    {id}
    class="display-settings"
    role="dialog"
    aria-label="Display"
    popover="auto"
    onbeforetoggle={prepare}
    style:right={`${bounds.right}px`}
    style:top={`${bounds.top}px`}
    style:width={`min(${width}px, calc(100vw - 16px))`}
>
    {#if open}{@render content()}{/if}
</div>

<style>
    .display-settings {
        position: fixed;
        inset: auto;
        margin: 0;
        box-sizing: border-box;
        max-height: calc(100dvh - 64px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 12px 14px 14px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 8px;
        background: var(--rail-surface-raised, #fffaf3);
        color: var(--rail-text, #5e4937);
        box-shadow: 0 6px 18px var(--rail-shadow, #00000033);
        font-size: 12.5px;
    }
    .modal-content {
        font-size: 12.5px;
    }
    .modal-content .color-fields:not(.routes, .players) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 0;
        border-top: 1px solid var(--rail-border, #b8a995);
    }
    section:first-of-type {
        border-top: 0;
        padding-top: 4px;
    }
    section:last-of-type {
        padding-bottom: 0;
    }
    .heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .scope {
        margin: 0;
        color: var(--rail-muted, #786550);
        font-size: 12px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .choices button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 4px;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .choices button:hover {
        background: var(--rail-hover, #ffffff66);
    }
    .choices button[aria-checked='true'] {
        border-color: var(--rail-focus, #9e7752);
        background: var(--rail-surface-selected, #e9e1d5);
        font-weight: 650;
    }
    .presets {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }
    .swatches {
        display: inline-flex;
    }
    .swatches span {
        width: 9px;
        height: 14px;
    }
    .swatches span:first-child {
        border-radius: 2px 0 0 2px;
    }
    .swatches span:last-child {
        border-radius: 0 2px 2px 0;
    }
    .token-preview {
        display: flex;
        gap: 6px;
    }
    .color-fields {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px 8px;
    }
    .routes {
        grid-template-columns: repeat(8, minmax(0, 1fr));
        column-gap: 4px;
    }
    .routes .color-field,
    .players .color-field {
        gap: 4px;
    }
    .routes .color-field input,
    .players .color-field input {
        width: 24px;
    }
    .players {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        column-gap: 6px;
    }
    .more .color-fields {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .more summary {
        color: var(--rail-muted, #786550);
        cursor: pointer;
    }
    .more[open] summary {
        margin-bottom: 8px;
    }
    .color-field {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        cursor: pointer;
    }
    .color-field input {
        flex: none;
        width: 26px;
        height: 22px;
        padding: 0;
        border: 1px solid color-mix(in oklab, var(--rail-text, #5e4937) 40%, transparent);
        border-radius: 4px;
        background: none;
        cursor: pointer;
    }
    .color-field input::-webkit-color-swatch-wrapper {
        padding: 0;
    }
    .color-field input::-webkit-color-swatch {
        border: 0;
        border-radius: 3px;
    }
    .color-field input::-moz-color-swatch {
        border: 0;
        border-radius: 3px;
    }
    .color-field span {
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .color-field.changed span {
        font-weight: 650;
    }
    .tint-field {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) 3.5em;
        align-items: center;
        gap: 8px;
    }
    .tint-field.changed span {
        font-weight: 650;
    }
    .tint-field input {
        width: 100%;
        accent-color: var(--rail-focus, #9e7752);
    }
    .tint-field output {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .reset {
        padding: 2px 8px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--rail-muted, #786550);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .reset:hover {
        background: var(--rail-hover, #ffffff66);
        color: inherit;
    }
</style>
