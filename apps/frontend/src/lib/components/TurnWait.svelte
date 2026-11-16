<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { TurnWaitDisplay } from '$lib/utils/gamePace'

    let { wait, label, prefix }: { wait: TurnWaitDisplay; label?: string; prefix?: Snippet } =
        $props()
</script>

<span aria-hidden="true" title={wait.pastPace ? wait.description : undefined}
    >{@render prefix?.()}{wait.wait}</span
><span class="sr-only">{label ? `${label} ${wait.description}` : wait.description}</span>
