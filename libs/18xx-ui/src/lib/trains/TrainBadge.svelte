<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import type { TrainTokens } from '../session/titlePresentation.js'
    import TrainTokenPips from './TrainTokenPips.svelte'
    let {
        name,
        color,
        title,
        obsolete = false,
        tokens
    }: {
        name: string
        color: string
        title?: string
        obsolete?: boolean
        tokens?: TrainTokens
    } = $props()
    const textColor = $derived(contrastingTextColor(color))
    const description = $derived(
        [title, obsolete ? 'Obsolete: removed after its next run' : '', tokens?.description]
            .filter(Boolean)
            .join('. ') || undefined
    )
</script>

{#snippet badge()}
    <span
        class="train-badge"
        class:obsolete
        class:lapsing={tokens?.lapsing}
        style:background={color}
        style:color={textColor}
        title={description}
        >{name}{#if obsolete}<span class="sr-only">, obsolete</span
            >{/if}{#if tokens?.description}<span class="sr-only">, {tokens.description}</span
            >{/if}</span
    >
{/snippet}

{#if tokens}<span class="with-tokens" class:carrying={tokens.count > 0}
        >{@render badge()}{#if tokens.count}<TrainTokenPips
                count={tokens.count}
                lapsing={tokens.lapsing}
            />{/if}</span
    >{:else}{@render badge()}{/if}

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
    /* Badges in a row line up at the top, so a row where none carries a token is no taller. */
    .with-tokens {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        align-self: flex-start;
        vertical-align: top;
        font-size: var(--train-badge-font, 12px);
    }
    .carrying {
        gap: 2px;
        padding-bottom: 2px;
    }
    .obsolete {
        clip-path: inset(0 round 3px);
    }
    /* Stripes over the badge's colour and under its name. */
    .lapsing {
        isolation: isolate;
    }
    .lapsing::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: repeating-linear-gradient(135deg, transparent 0 4px, currentColor 4px 6px);
        opacity: 0.3;
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
