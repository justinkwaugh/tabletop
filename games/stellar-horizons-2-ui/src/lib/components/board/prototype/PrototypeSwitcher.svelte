<script lang="ts">
    // PROTOTYPE: floating variant switcher for the compact ship display. Dev builds only.
    import { SHIP_VARIANTS, shipPrototype } from './prototypeState.svelte.js'

    const index = $derived(
        SHIP_VARIANTS.findIndex((variant) => variant.key === shipPrototype.variant)
    )
    const current = $derived(SHIP_VARIANTS[index])

    function step(delta: number) {
        const next = SHIP_VARIANTS[(index + delta + SHIP_VARIANTS.length) % SHIP_VARIANTS.length]
        shipPrototype.setVariant(next.key)
    }

    function onKeydown(event: KeyboardEvent) {
        const target = event.target
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            (target instanceof HTMLElement && target.isContentEditable)
        )
            return
        if (event.key === 'ArrowLeft') step(-1)
        if (event.key === 'ArrowRight') step(1)
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#if import.meta.env.DEV && current}
    <div class="switcher">
        <button type="button" onclick={() => step(-1)} aria-label="Previous variant">◀</button>
        <span class="label">{current.key} · {current.name}</span>
        <button type="button" onclick={() => step(1)} aria-label="Next variant">▶</button>
        <label class="crowd"
            >Crowd
            <select bind:value={shipPrototype.crowd}>
                <option value="off">Off (real ships)</option>
                <option value="typical">Typical (1–3 factions × 1–3)</option>
                <option value="heavy">Heavy (6 factions × 2–8)</option>
            </select></label
        >
    </div>
{/if}

<style>
    .switcher {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        border-radius: 999px;
        background: #fff;
        color: #111;
        font:
            600 15px system-ui,
            sans-serif;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    }

    .switcher button {
        padding: 2px 10px;
        border-radius: 999px;
        background: #111;
        color: #fff;
    }

    .crowd {
        display: flex;
        gap: 6px;
        align-items: center;
        font-weight: 400;
    }
</style>
