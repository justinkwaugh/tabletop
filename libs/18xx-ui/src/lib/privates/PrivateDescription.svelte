<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { flip, shift, offset, hide } from '@floating-ui/dom'
    import { assertExists } from '@tabletop/common'
    import PrivateCard from './PrivateCard.svelte'
    import CardLightbox from './CardLightbox.svelte'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import { Floater } from '@tabletop/frontend-components'

    let {
        money,
        name,
        description,
        value,
        income,
        token,
        phaseColors = {},
        imageUrl
    }: {
        money: MoneyFormat
        name: string
        description: string
        value?: number
        income?: number
        token?: StationAppearance
        phaseColors?: Readonly<Record<string, string>>
        imageUrl?: string
    } = $props()
    const id = $props.id()
    let open = $state(false)
    let triggerEvent: Event | undefined
    function toggle(event: Event) {
        if (event.target instanceof Element && event.target.closest('[data-description-exclude]'))
            return
        triggerEvent = event
        open = !open
    }
    function triggerRow(node: HTMLButtonElement) {
        const row = node.closest('[data-private-description-row]')
        assertExists(row, 'Private description requires a private-company row')
        row.id = `${id}-row`
        row.addEventListener('click', toggle)

        return {
            destroy() {
                row.removeEventListener('click', toggle)
            }
        }
    }
</script>

<svelte:window
    onclick={(event) => {
        if (event !== triggerEvent) open = false
    }}
    onkeydown={(event) => {
        if (event.key === 'Escape') open = false
    }}
/>

<button
    {id}
    class="name"
    use:triggerRow
    aria-expanded={open}
    aria-describedby={open ? `${id}-description` : undefined}>{name}</button
>
{#if open && imageUrl}
    <CardLightbox
        {imageUrl}
        {name}
        onclose={() => {
            open = false
        }}
    />
{:else if open}
    <Floater
        reference={`[id="${id}-row"]`}
        placement="top"
        trigger="manual"
        strategy="fixed"
        offset={0}
        middlewares={[
            offset(8),
            flip({ boundary: [], rootBoundary: 'viewport', padding: 8 }),
            shift({ boundary: [], rootBoundary: 'viewport', padding: 8, crossAxis: true }),
            hide({ elementContext: 'reference' })
        ]}
        onClose={() => {
            open = false
        }}
    >
        <div id={`${id}-description`} class="description" role="tooltip">
            <PrivateCard {money} {phaseColors} {name} {description} {value} {income} {token} />
        </div>
    </Floater>
{/if}

<style>
    .name {
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .name:focus-visible {
        outline: 1px solid var(--rail-focus, #796047);
        outline-offset: 2px;
        border-radius: 2px;
    }
    :global([popover]):has(> .description) {
        overflow: visible;
    }
    .description {
        width: 280px;
        max-width: calc(100vw - 24px);
        max-height: calc(100dvh - 24px);
        overflow-y: auto;
        padding: 0;
        border-radius: 7px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #514538);
        box-shadow:
            0 6px 20px var(--rail-shadow, #281d183d),
            0 2px 5px var(--rail-shadow, #281d1826);
        font-size: 12px;
        line-height: 1.45;
        font-weight: 400;
        animation: rise 140ms ease-out;
    }
    @keyframes rise {
        from {
            transform: translateY(6px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .description {
            animation: none;
        }
    }
</style>
