<script module lang="ts">
    type callback = () => void
    let mounted = false
    let functionsToRunOnMount: callback[] = []

    export const onceMounted = (callback: callback) => {
        if (mounted) {
            callback()
        } else {
            functionsToRunOnMount.push(callback)
        }
    }

    const runAll = () => {
        for (const callback of functionsToRunOnMount) {
            callback()
        }

        functionsToRunOnMount = []
    }
</script>

<script>
    import { onMount } from 'svelte'

    onMount(() => {
        mounted = true
        runAll()
    })
</script>
