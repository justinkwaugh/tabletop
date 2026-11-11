<script lang="ts">
    import { actionName } from '$lib/model/actionCatalogue.js'
    import { scepterActions } from '$lib/model/cardUses.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.6.1, R-6.7, R-6.8 — the Grand Scepter's one "Use" offers the uses the seat can take now;
    // a tap opens that action, as its minor chip does.
    let gameSession = getGameSession()
    let uses = $derived(scepterActions(gameSession.validActionTypes))
    const width = new ChoiceWidth()
</script>

<!-- 44 px tall at every width; the two share the wider one's width. -->
<div class="flex flex-wrap gap-2" data-scepter-choice>
    {#each uses as type (type)}
        <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded border-[1.5px] border-oath-accent
                   bg-oath-surface-raised px-3 text-sm font-semibold text-oath-accent
                   hover:bg-oath-accent-soft disabled:opacity-40"
            disabled={gameSession.busy}
            onclick={() => gameSession.chooseAction(type)}
        >
            <span class="flex justify-center" style:min-width="{width.widest}px">
                <span class="block w-max whitespace-nowrap" {@attach width.measure}
                    >{actionName(type)}</span
                >
            </span>
        </button>
    {/each}
</div>
