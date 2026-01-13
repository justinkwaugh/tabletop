<script lang="ts">
    import { Alert, Input, Modal } from 'flowbite-svelte'

    let {
        open = $bindable(),
        oncancel,
        onconfirm
    }: { open: boolean; oncancel?: () => void; onconfirm?: (name: string) => void } = $props()

    let gameName = $state('')

    function cancel() {
        open = false
        oncancel?.()
    }

    function confirm(event: Event) {
        event.preventDefault()
        const trimmedName = gameName.trim()
        if (!trimmedName) {
            return
        }
        open = false
        onconfirm?.(trimmedName)
    }
</script>

<Modal bind:open class="max-w-md">
    <!-- Modal content -->
    <div class="relative p-4 text-center bg-transparent rounded-lg shadow sm:p-5">
        <svg
            class="w-[48px] h-[48px] dark:text-gray-500 mx-auto mb-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1"
                d="M12 12v4m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            ></path>
        </svg>

        <p class="mb-4 text-gray-500 dark:text-gray-300">
            This will create a new game with the same players from the current point in the game
            history.
            {#if false}
                <br /><br />
                <Alert border color="sky" class="">
                    This is a hotseat game. If you just want to see what would happen if things went
                    differently, consider clicking the lightbulb icon and using the exploration
                    feature instead.
                </Alert>
            {/if}
        </p>
        <form class="flex flex-col space-y-6 mb-4" action="/" onsubmit={confirm}>
            <Input
                bind:value={gameName}
                type="text"
                name="gameName"
                placeholder="Enter new game name"
                required
            />

            <div class="flex justify-center items-center space-x-4">
                <button
                    onclick={cancel}
                    type="button"
                    class="py-2 px-3 text-sm font-medium text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    class="py-2 px-3 text-sm font-medium text-center text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 dark:bg-green-700 dark:hover:bg-green-600 dark:focus:ring-green-900"
                >
                    Fork it!
                </button>
            </div>
        </form>
    </div>
</Modal>
