<script lang="ts">
    import { externalIdsByService, type User } from '@tabletop/common'
    import { LINKABLE_SERVICE_DISPLAY, LINKABLE_SERVICES } from '$lib/components/linkableServices'

    let { user }: { user: User } = $props()

    let linkedServices = $derived(externalIdsByService(user))
</script>

<section
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Linked accounts for ${user.username ?? user.id}`}
>
    <h3 class="text-sm font-medium">Linked accounts</h3>
    <ul class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {#each LINKABLE_SERVICES as service (service)}
            {@const { label, logo } = LINKABLE_SERVICE_DISPLAY[service]}
            {@const linked = linkedServices.has(service)}
            <li class="flex items-center gap-2">
                <img src={logo} alt="" class="h-5 w-5 rounded-sm" class:opacity-40={!linked} />
                <span>{label}</span>
                <span
                    class={linked
                        ? 'font-medium text-green-700 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'}
                    >{linked ? 'Linked' : 'Not linked'}</span
                >
            </li>
        {/each}
    </ul>
</section>
