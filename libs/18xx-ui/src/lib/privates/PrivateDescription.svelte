<script lang="ts">
    import { flip, shift, offset, hide } from '@floating-ui/dom'
    import { assertExists } from '@tabletop/common'
    import { Floater } from '@tabletop/frontend-components'

    let { name, description }: { name: string; description: string } = $props()
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
{#if open}
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
            <strong>{name}</strong>
            <p>{description}</p>
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
        outline: 1px solid #796047;
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
        padding: 10px 12px;
        border: 1px solid #d2c5b7;
        border-radius: 7px;
        background: #faf7f1;
        color: #514538;
        box-shadow:
            0 6px 20px #281d183d,
            0 2px 5px #281d1826;
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
    strong {
        font-weight: 650;
    }
    p {
        margin: 4px 0 0;
    }
</style>
