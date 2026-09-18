class PwaInstallPrompt {
    private promptEvent: BeforeInstallPromptEvent | undefined = $state()

    get available(): boolean {
        return this.promptEvent !== undefined
    }

    capture(event: BeforeInstallPromptEvent): void {
        event.preventDefault()
        this.promptEvent = event
    }

    clear(): void {
        this.promptEvent = undefined
    }

    async prompt(): Promise<void> {
        const event = this.promptEvent
        if (!event) return

        this.promptEvent = undefined
        await event.prompt()
        await event.userChoice
    }
}

export const pwaInstallPrompt = new PwaInstallPrompt()

let registered = false

export function registerPwaInstallPrompt(): void {
    if (registered) return
    registered = true
    window.addEventListener('beforeinstallprompt', (event) => pwaInstallPrompt.capture(event))
    window.addEventListener('appinstalled', () => pwaInstallPrompt.clear())
}
