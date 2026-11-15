<script lang="ts">
    import type { Snippet } from 'svelte'
    import { ArrowRightOutline } from 'flowbite-svelte-icons'

    let {
        action,
        label,
        name,
        cover,
        caption
    }: {
        action: { href: string } | { onclick: () => void }
        label: string
        name: string
        cover: Snippet<[boolean]>
        caption: Snippet
    } = $props()

    let hovered = $state(false)
    let focused = $state(false)
    const engagement = {
        onpointerenter: () => (hovered = true),
        onpointerleave: () => (hovered = false),
        onfocusin: () => (focused = true),
        onfocusout: () => (focused = false)
    }
</script>

{#snippet content()}
    <div class="cover-stage">
        {@render cover(hovered || focused)}
        <span class="play-arrow"><ArrowRightOutline class="h-5 w-5" /></span>
    </div>
    <h3>{name}</h3>
    <p class="caption">{@render caption()}</p>
{/snippet}

{#if 'href' in action}
    <a class="game" href={action.href} aria-label={label} {...engagement}>
        {@render content()}
    </a>
{:else}
    <button class="game" onclick={action.onclick} aria-label={label} {...engagement}>
        {@render content()}
    </button>
{/if}

<style>
    .game {
        display: block;
        width: 100%;
        text-align: left;
        cursor: pointer;
    }

    a:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 6px;
        border-radius: 6px;
    }

    .cover-stage {
        position: relative;
        isolation: isolate;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 186px;
        padding: 16px;
        border: 1px solid #ffffff0a;
        border-radius: 10px;
        background: linear-gradient(145deg, #263244, var(--color-gray-800));
        transition: border-color 250ms ease;
    }

    .cover-stage::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: #293950;
        opacity: 0;
        transition: opacity 250ms ease;
    }

    .cover-stage :global(img) {
        max-width: 100%;
        max-height: 100%;
        height: auto;
        border-radius: 5px;
        object-fit: contain;
        filter: drop-shadow(0 8px 6px #0006);
        transition: transform 180ms;
    }

    .cover-stage:has(:global(.maturity-label)) {
        overflow: hidden;
    }

    .play-arrow {
        position: absolute;
        bottom: 10px;
        right: 10px;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--color-blue-600);
        color: white;
        opacity: 0;
        transition: opacity 180ms;
    }

    .game:hover .cover-stage,
    .game:focus-visible .cover-stage {
        border-color: var(--color-highlight-border);
    }

    .game:hover .cover-stage::before,
    .game:focus-visible .cover-stage::before {
        opacity: 1;
    }

    .game:hover :global(img),
    .game:focus-visible :global(img) {
        transform: translateY(-4px) rotate(-2deg);
    }

    .game:hover .play-arrow,
    .game:focus-visible .play-arrow {
        opacity: 1;
    }

    h3 {
        margin-top: 12px;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
    }

    .caption {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 5px;
        color: var(--color-gray-400);
        font-size: 12px;
    }

    @media (max-width: 1000px) {
        .cover-stage {
            height: 210px;
        }
    }

    @media (max-width: 700px) {
        .cover-stage {
            height: clamp(142px, 40vw, 230px);
            padding: 12px;
        }
        h3 {
            font-size: 14px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .cover-stage,
        .cover-stage::before,
        .cover-stage :global(img),
        .play-arrow {
            transition: none;
        }
        .game:hover :global(img),
        .game:focus-visible :global(img) {
            transform: none;
        }
    }
</style>
