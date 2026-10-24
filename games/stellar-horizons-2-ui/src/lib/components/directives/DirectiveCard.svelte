<script lang="ts">
    import { directiveDefinition, directiveType } from '@tabletop/stellar-horizons-2'
    import {
        DIRECTIVE_TYPE_COLORS,
        DIRECTIVE_TYPE_LABELS,
        directiveText
    } from '$lib/utils/directives.js'

    // A directive marker as printed: its type, its condition and its points; or, for a
    // directive the viewer may not see, its back.
    let {
        directiveId,
        size = 116,
        note,
        onclick
    }: {
        directiveId?: string
        size?: number
        note?: string
        onclick?: () => void
    } = $props()

    const directive = $derived(directiveId ? directiveDefinition(directiveId) : undefined)
    const type = $derived(directive ? directiveType(directive) : undefined)
    const text = $derived(directive ? directiveText(directive.condition) : 'Directive')
</script>

{#snippet face()}
    {#if directive && type}
        <span class="type" style:color={DIRECTIVE_TYPE_COLORS[type]}
            >{DIRECTIVE_TYPE_LABELS[type]}</span
        >
        <span class="text">{text}</span>
        {#if note}<span class="note">{note}</span>{/if}
        <span class="points" title="{directive.points} VP">{directive.points}</span>
    {:else}
        <span class="back-title">Directive</span>
    {/if}
{/snippet}

{#if onclick}
    <button
        type="button"
        class="directive"
        class:back={!directive}
        style:--size="{size}px"
        aria-label={directive ? `${text}, ${directive.points} VP` : 'Directive'}
        {onclick}>{@render face()}</button
    >
{:else}
    <span
        class="directive"
        class:back={!directive}
        style:--size="{size}px"
        role="img"
        aria-label={directive ? `${text}, ${directive.points} VP` : 'A hidden directive'}
        >{@render face()}</span
    >
{/if}

<style>
    .directive {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        width: var(--size);
        min-height: var(--size);
        box-sizing: border-box;
        padding: 8px 7px 26px;
        border: 1px solid #2b3550;
        border-radius: 12px;
        background: #07090f;
        color: #f3f6fb;
        text-align: center;
        font: inherit;
    }

    button.directive {
        cursor: pointer;
    }

    .type {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .text {
        font-size: 12px;
        line-height: 1.25;
    }

    .note {
        font-size: 11px;
        color: #9fb4d0;
    }

    .points {
        position: absolute;
        bottom: 5px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #d4a93b;
        color: #1b1405;
        font-size: 12px;
        font-weight: 800;
    }

    .back {
        justify-content: center;
        padding-bottom: 8px;
        background: #101a33;
    }

    .back-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #d4c08a;
    }
</style>
