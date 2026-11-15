<script lang="ts">
    import type { GameProgress } from '@tabletop/common'

    let {
        progress,
        class: className = '',
        labelClass = ''
    }: { progress: GameProgress; class?: string; labelClass?: string } = $props()
</script>

<div class="flex min-w-0 items-center gap-2 {className}" title={progress.label}>
    <span
        class="min-w-0 truncate text-[0.7rem] leading-4 {labelClass} {progress.final
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-gray-500 dark:text-gray-400'}">{progress.label}</span
    >
    <div
        class="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-label={progress.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.fraction * 100)}
    >
        <div
            class="h-full rounded-full {progress.final ? 'bg-amber-500' : 'bg-blue-500'}"
            style:width={`${progress.fraction * 100}%`}
        ></div>
    </div>
</div>
