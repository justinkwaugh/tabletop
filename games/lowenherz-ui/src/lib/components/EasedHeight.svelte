<script lang="ts">
    import type { Snippet } from 'svelte'

    // Eases a block's height as its content comes and goes, so whatever sits below glides instead
    // of jumping. Local layout settling only: nothing waits on it and it depicts no action. The
    // first measurement snaps, since browsers do not interpolate from height auto - so mounting and
    // silent restores get no motion. minHeight is folded into the eased height rather than set as
    // min-height, so releasing a reservation glides too.
    let {
        children,
        minHeight = 0,
        centerContent = false,
        clip = false
    }: { children: Snippet; minHeight?: number; centerContent?: boolean; clip?: boolean } = $props()

    let contentHeight: number | undefined = $state(undefined)
</script>

<div
    class="eased-height {centerContent ? 'flex flex-col justify-center' : ''} {clip ? 'overflow-hidden' : ''}"
    style:height={contentHeight === undefined ? 'auto' : `${Math.max(contentHeight, minHeight)}px`}
    style:min-height={contentHeight === undefined && minHeight > 0 ? `${minHeight}px` : undefined}
>
    <div bind:clientHeight={contentHeight}>
        {@render children()}
    </div>
</div>

<style>
    .eased-height {
        transition: height 200ms ease-out;
    }
</style>
