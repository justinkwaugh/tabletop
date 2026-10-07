<script lang="ts">
    import type { Snippet } from 'svelte'
    import { QueueEnd } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { refillNote, RefillNote } from '$lib/utils/queueChoices.js'

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()

    let note = $derived(
        refillNote(gameSession.showQueueTooShort, gameSession.fillableEntranceIds.length > 0)
    )
    let singleCount = $derived(
        gameSession.visitorCountOptions.length === 1
            ? gameSession.visitorCountOptions[0]
            : undefined
    )
</script>

{#snippet toggle<T>(
    label: string,
    options: readonly T[],
    chosen: T | undefined,
    text: (option: T) => string,
    name: (option: T) => string,
    choose: (option: T) => void
)}
    <span
        role="group"
        aria-label={label}
        class="inline-flex overflow-hidden rounded-md border border-[#8a6a46] align-middle"
    >
        {#each options as option, index (option)}
            <button
                type="button"
                aria-pressed={chosen === option}
                aria-label={name(option)}
                disabled={gameSession.busy}
                class="min-w-9 px-2.5 py-0.5 text-sm {index > 0
                    ? 'border-l border-[#8a6a46]'
                    : ''} {chosen === option
                    ? 'bg-[#8a6a46] font-semibold text-white'
                    : 'hover:bg-[#8a6a46]/15'} disabled:opacity-50"
                onclick={() => choose(option)}>{text(option)}</button
            >
        {/each}
    </span>
{/snippet}

<div class="flex flex-col items-center gap-2">
    <p class="marracash-prompt">
        {@render lead?.()}
        Bring new visitors to the empty entrance{gameSession.gameState.emptyEntranceIds().length > 1
            ? 's'
            : ''}.
    </p>
    <p class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        Take
        {#if singleCount === undefined}
            {@render toggle(
                'How many visitors',
                gameSession.visitorCountOptions,
                gameSession.chosenVisitorCount,
                (count) => `${count}`,
                (count) => `${count}`,
                (count) => gameSession.chooseVisitorCount(count)
            )}
        {:else}
            <span class="font-semibold">{singleCount}</span>
        {/if}
        from the
        {@render toggle(
            'Which end of the queue',
            Object.values(QueueEnd),
            gameSession.chosenQueueEnd,
            (end) => (end === QueueEnd.Front ? 'front' : 'back'),
            (end) => (end === QueueEnd.Front ? 'Front of queue' : 'Back of queue'),
            (end) => gameSession.chooseQueueEnd(end)
        )}
        of the queue.
    </p>
    <!-- One reserved line, so the board below never shifts as this message changes -->
    <div class="min-h-5 text-sm">
        {#if note === RefillNote.QueueTooShort}
            <p role="alert" class="text-[#9b2c2c]">
                <span class="font-semibold">Queue is too short.</span> Please use the buttons above to
                make your selection.
            </p>
        {:else if note === RefillNote.ChooseEntrance}
            <p>Choose a highlighted entrance to place them.</p>
        {/if}
    </div>
</div>
