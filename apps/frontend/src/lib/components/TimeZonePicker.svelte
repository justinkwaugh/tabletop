<script lang="ts">
    import { Button, Label, Select } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { getAppContext } from '@tabletop/frontend-components'
    import { browserTimeZone, timeZoneName, timeZoneOptions } from '$lib/utils/timeZones'

    const { authorizationService, api } = getAppContext()

    const user = $derived(authorizationService.getSessionUser())
    const browserZone = browserTimeZone()
    const timeZone = $derived(user?.timeZone ?? browserZone)
    const options = $derived(timeZoneOptions(new Date(), [timeZone, browserZone]))
    let saving = $state(false)

    async function save(zone: string) {
        saving = true
        try {
            authorizationService.setSessionUser(await api.updateUserTimeZone(zone))
        } catch (error) {
            console.error('Could not save time zone', error)
            toast.error('Could not save your time zone. Please try again.')
        } finally {
            saving = false
        }
    }
</script>

<div class="flex flex-col gap-2">
    <Label for="time-zone">Time zone</Label>
    <Select
        id="time-zone"
        size="sm"
        placeholder=""
        value={timeZone}
        disabled={saving}
        onchange={(event) => void save(event.currentTarget.value)}
    >
        {#each options as option (option.value)}
            <option value={option.value}>{option.name}</option>
        {/each}
    </Select>
    {#if user?.timeZone && user.timeZone !== browserZone}
        <div
            class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-600 p-3 text-sm text-gray-700 dark:text-gray-300"
        >
            <span>
                Your browser is set to {timeZoneName(browserZone)}, but your account uses {timeZoneName(
                    user.timeZone
                )}.
            </span>
            <Button size="xs" disabled={saving} onclick={() => void save(browserZone)}
                >Use {timeZoneName(browserZone)}</Button
            >
        </div>
    {/if}
</div>
