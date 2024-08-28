<script lang="ts">
    import { Card, Label, Button, Alert, Helper, Toggle } from 'flowbite-svelte'
    import { PlayerColor, UserPreferences } from '@tabletop/common'
    import { flip } from 'svelte/animate'
    import { getContext } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    let { authorizationService, api } = getContext('appContext') as AppContext

    let errors: Record<string, string[]> = $state({})
    let errorMessage: string | undefined = $state(undefined)
    let success = $state(false)

    let sessionUser = authorizationService.getSessionUser()

    let preferences: UserPreferences = $state(
        sessionUser?.preferences ?? {
            preventWebNotificationPrompt: false,
            preferredColors: Object.values(PlayerColor),
            preferredColorsEnabled: false
        }
    )

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let bgColorForColor = (color?: PlayerColor) => {
        switch (color) {
            case PlayerColor.Red:
                return 'bg-red-700'
            case PlayerColor.Orange:
                return 'bg-orange-500'
            case PlayerColor.Yellow:
                return 'bg-yellow-300'
            case PlayerColor.Green:
                return 'bg-green-600'
            case PlayerColor.Blue:
                return 'bg-blue-600'
            case PlayerColor.Purple:
                return 'bg-purple-600'
            case PlayerColor.Pink:
                return 'bg-pink-500'
            case PlayerColor.Brown:
                return 'bg-yellow-900'
            case PlayerColor.Gray:
                return 'bg-gray-500'
            case PlayerColor.Black:
                return 'bg-black'
            case PlayerColor.White:
                return 'bg-white'
            default:
                return 'bg-transparent'
        }
    }

    async function submit(event: SubmitEvent) {
        if (!user) return
        event.preventDefault()
        clearErrors()

        try {
            const newUser = await api.updateUserPreferences(user.id, preferences)
            success = true
            authorizationService.setSessionUser(newUser)
        } catch (e) {
            console.log(e)
            errorMessage = 'An unexpected error occurred, please try again'
        }
    }

    function clearErrors() {
        errorMessage = undefined
        errors = {}
    }

    let draggedColor: PlayerColor | undefined = $state(undefined)
    let draggedIndex: number | undefined = $state(undefined)

    function dragStart(event: DragEvent, source: string, index: number, color?: PlayerColor) {
        draggedColor = color
        draggedIndex = index
    }

    function dragEnter(event: DragEvent, from: string, index: number) {
        if (!preferences.preferredColors || draggedIndex === undefined || !draggedColor) return
        if (preferences.preferredColors[index] === draggedColor) {
            return
        }

        preferences.preferredColors.splice(draggedIndex, 1)
        preferences.preferredColors.splice(index, 0, draggedColor)

        draggedIndex = index
    }

    function allowDrop(event: DragEvent) {
        event.preventDefault()
    }

    function drop(event: DragEvent) {
        event.preventDefault()
        draggedIndex = undefined
        draggedColor = undefined
    }
</script>

<div>
    <script
        src="https://drag-drop-touch-js.github.io/dragdroptouch/dist/drag-drop-touch.esm.min.js?autoload"
        type="module"
    ></script>
</div>

<div class="h-[calc(100vh-70px)] flex flex-col items-center justify-center space-y-6">
    <Card class="bg-gray-300">
        <form class="flex flex-col space-y-6" action="/" onsubmit={submit}>
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                Set your preferences...
            </h3>
            {#if errorMessage}
                <Alert color="none" class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Update Failed</span><br />
                    {errorMessage}
                </Alert>
            {/if}
            {#if success}
                <Alert color="none" class="dark:bg-green-200 dark:text-green-700 my-4">
                    <span class="font-bold text-lg">Preferences Updated</span><br />
                </Alert>
            {/if}

            <Toggle bind:checked={preferences.preventWebNotificationPrompt}
                >Prevent Web Notifications Prompt</Toggle
            >
            <!-- <Input
                    bind:value={email}
                    type="email"
                    name="email"
                    placeholder="name@company.com"
                    required
                />
                {#if errors?.email}
                    {#each errors.email as error}
                        <Helper class="mb-2" color="red"
                            ><span class="font-medium">{error}</span></Helper
                        >
                    {/each}
                {/if} -->

            <div>
                <Toggle bind:checked={preferences.preferredColorsEnabled}
                    >Preferred Player Colors</Toggle
                >

                {#if preferences.preferredColorsEnabled}
                    <div class="mt-4 flex flex-col rounded-lg border-gray-600 border p-2">
                        <div class="flex flex-row justify-between items-center">
                            {#each preferences.preferredColors as color, i (color)}
                                <div
                                    role="button"
                                    tabindex="0"
                                    draggable={color !== undefined}
                                    ondragover={(e) => allowDrop(e)}
                                    ondrop={(e) => drop(e)}
                                    ondragstart={(e) => dragStart(e, 'colors', i, color)}
                                    ondragenter={(e) => dragEnter(e, 'colors', i)}
                                    animate:flip={{ duration: 100 }}
                                    class="{color === draggedColor
                                        ? ''
                                        : ''} rounded-lg h-[40px] w-[26px] {bgColorForColor(
                                        color
                                    )} border-gray-800 border-2"
                                ></div>
                            {/each}
                        </div>
                        <div class="flex flex-row justify-center items-center">
                            <Helper class="mt-2" color="gray"
                                ><span class="font-medium">drag to reorder</span></Helper
                            >
                        </div>
                    </div>
                {/if}
            </div>
            <div class="flex justify-end"><Button type="submit" class="">Save</Button></div>
        </form>
    </Card>
</div>
