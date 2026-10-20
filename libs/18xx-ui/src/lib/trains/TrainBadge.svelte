<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    let {
        name,
        color,
        title,
        obsolete = false
    }: { name: string; color: string; title?: string; obsolete?: boolean } = $props()
    const textColor = $derived(contrastingTextColor(color))
    const description = $derived(
        obsolete
            ? [title, 'Obsolete: removed after its next run'].filter(Boolean).join('. ')
            : title
    )
</script>

<span
    class="train-badge"
    class:obsolete
    style:background={color}
    style:color={textColor}
    title={description}
    >{name}{#if obsolete}<span class="sr-only">, obsolete</span>{/if}</span
>

<style>
    .train-badge {
        display: inline-block;
        position: relative;
        padding: 0 0.333em;
        border-radius: 3px;
        color: #181818;
        filter: var(--rail-phase-filter, saturate(0.6));
        font-size: var(--train-badge-font, 12px);
        font-weight: 600;
        line-height: calc(4em / 3);
        white-space: nowrap;
    }
    .obsolete {
        clip-path: inset(0 round 3px);
    }
    .obsolete::after {
        content: '';
        position: absolute;
        left: -1px;
        right: -1px;
        top: 50%;
        height: 1.5px;
        background: currentColor;
        transform: rotate(-30deg);
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
</style>
