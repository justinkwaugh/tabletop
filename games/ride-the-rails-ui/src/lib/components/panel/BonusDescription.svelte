<script lang="ts">
    import type { Snippet } from 'svelte'
    import { Floater } from '@tabletop/frontend-components'
    import type { BonusDescription } from '$lib/utils/bonusDescription.js'
    import { acrossView } from '$lib/utils/popupPlacement.js'

    let {
        description,
        id,
        chipId,
        onClose,
        children
    }: {
        description: BonusDescription
        /** The description's id, which the chip controls; its text is `${id}-text`. */
        id: string
        /** The chip that opened it, which a press on toggles it rather than closing it here. */
        chipId: string
        onClose: () => void
        children?: Snippet
    } = $props()

    // The phone's page gutter.
    const GUTTER = 16

    let panel: HTMLElement | undefined = $state()

    function chip(): HTMLElement | null | undefined {
        return panel?.ownerDocument.getElementById(chipId)
    }

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onClose()
            chip()?.focus()
        }
    }

    // A press outside the description and its chip closes it.
    function onpointerdown(event: PointerEvent) {
        const target = event.target
        if (!(target instanceof Node)) return
        if (panel?.contains(target) || chip()?.contains(target)) return
        onClose()
    }
</script>

<svelte:window {onkeydown} {onpointerdown} />

<!-- Contract, Turn header: the bonus chip's description, beside the chip. It only looks. -->
<Floater
    reference="#{chipId}"
    placement="bottom"
    offset={6}
    middlewares={[acrossView(GUTTER)]}
    trigger="manual"
>
    <div
        bind:this={panel}
        {id}
        class="description rounded-lg border border-rtr-card-edge bg-rtr-panel text-rtr-ink shadow-md"
        data-bonus-description={description.bonusId}
    >
        <div id="{id}-text">
            <p class="heading">
                <span class="rtr-serif name">{description.name}</span>
                <span class="terms">{description.terms}</span>
            </p>
            <p>{description.rule}</p>
            {#each description.places as place (place)}
                <p>{place}</p>
            {/each}
            <p class="status">{description.status}</p>
        </div>
        {@render children?.()}
    </div>
</Floater>

<style>
    .description {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(20rem, calc(100vw - 32px));
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.4;
        white-space: normal;
    }

    .description p + p {
        margin-top: 6px;
    }

    .heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
    }

    .name {
        font-size: 16px;
        font-weight: 700;
    }

    .terms {
        font-weight: 700;
    }

    .status {
        font-weight: 600;
        color: var(--rtr-ink-muted);
    }
</style>
