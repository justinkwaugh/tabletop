<script lang="ts" generics="Value extends string">
    import type { Snippet } from 'svelte'

    interface Choice {
        value: Value
        name: string
        unavailable?: boolean
    }

    let {
        label,
        choices,
        chosen,
        onchoose,
        mark,
        chip = false
    }: {
        label: string
        choices: readonly Choice[]
        chosen?: Value
        onchoose: (value: Value) => void
        /** Something drawn after a choice's name, for the choices that have it. */
        mark?: Snippet<[Value]>
        /** Drawn as one of the light chips of the map menu, its thumb a tint and never dark. */
        chip?: boolean
    } = $props()

    const chosenIndex = $derived(choices.findIndex((choice) => choice.value === chosen))

    // Each choice is as wide as its name, so the thumb takes the measure of the chosen one.
    const buttons: HTMLButtonElement[] = $state([])
    let thumb: { left: number; width: number } | undefined = $state()

    $effect(() => {
        const button = buttons[chosenIndex]
        if (!button) {
            thumb = undefined
            return
        }
        const measure = () => {
            thumb = { left: button.offsetLeft, width: button.offsetWidth }
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(button)
        return () => observer.disconnect()
    })
</script>

<div
    class="nt-switch"
    class:nt-switch-chip={chip}
    role="group"
    aria-label={label}
    style:--count={choices.length}
>
    {#if chosenIndex >= 0 && thumb}
        <span
            class="nt-switch-thumb"
            style:--left="{thumb.left}px"
            style:width="{thumb.width}px"
            aria-hidden="true"
        ></span>
    {/if}
    {#each choices as choice, index (choice.value)}
        <button
            bind:this={buttons[index]}
            type="button"
            aria-pressed={choice.value === chosen}
            disabled={choice.unavailable}
            onclick={() => onchoose(choice.value)}
            >{choice.name}{@render mark?.(choice.value)}</button
        >
    {/each}
</div>

<style>
    .nt-switch {
        --inset: 2px;
        position: relative;
        display: inline-grid;
        grid-template-columns: repeat(var(--count), auto);
        padding: var(--inset);
        border-radius: 4px;
        background: color-mix(in srgb, var(--nt-ink) 11%, transparent);
        font-size: 13px;
        line-height: 1.5;
    }

    .nt-switch-thumb {
        position: absolute;
        top: var(--inset);
        bottom: var(--inset);
        left: 0;
        border-radius: 3px;
        background: var(--nt-ink);
        transform: translateX(var(--left));
        transition:
            transform 140ms ease-out,
            width 140ms ease-out;
    }

    button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35em;
        padding: 1px 12px;
        color: var(--nt-ink);
        text-align: center;
        white-space: nowrap;
        transition: color 140ms ease-out;
    }

    button:not([disabled]) {
        cursor: pointer;
    }

    button[aria-pressed='true'] {
        color: var(--nt-ground);
        opacity: 1;
    }

    button[disabled]:not([aria-pressed='true']) {
        opacity: 0.36;
    }

    .nt-switch-chip {
        border-radius: 7px;
        background: var(--nt-ground);
        font-size: 12px;
        line-height: 16px;
    }

    .nt-switch-chip .nt-switch-thumb {
        border-radius: 5px;
        background: color-mix(in srgb, var(--nt-ground) 78%, var(--nt-ink));
    }

    .nt-switch-chip button {
        padding: 1px 9px;
    }

    .nt-switch-chip button[aria-pressed='true'] {
        color: var(--nt-ink);
    }

    @media (prefers-reduced-motion: reduce) {
        .nt-switch-thumb,
        button {
            transition: none;
        }
    }

    @media (max-width: 639px) {
        .nt-switch {
            font-size: 12px;
        }

        button {
            padding: 2px 8px;
        }

        .nt-switch-chip {
            font-size: 13px;
        }

        .nt-switch-chip button {
            padding: 3px 10px;
        }
    }
</style>
