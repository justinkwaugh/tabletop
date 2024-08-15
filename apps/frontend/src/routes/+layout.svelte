<script lang="ts">
    import RunOnceMounted from '$lib/components/RunOnceMounted.svelte'
    import { setContext } from 'svelte'
    import { Toaster } from 'svelte-sonner'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import TimeAgo from 'javascript-time-ago'
    import en from 'javascript-time-ago/locale/en'
    TimeAgo.addDefaultLocale(en)

    let { children } = $props()
    setContext('appContext', getAppContext())
</script>

<Toaster position={'top-center'} richColors />
{@render children()}
<RunOnceMounted />
