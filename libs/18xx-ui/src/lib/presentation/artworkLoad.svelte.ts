/** Whether published artwork has loaded, so the generated presentation can stand in until it has. */
export class ArtworkLoad {
    #url: () => string | undefined
    #loadedUrl: string | undefined = $state()

    constructor(url: () => string | undefined) {
        this.#url = url
    }

    get shown() {
        const url = this.#url()
        return !!url && this.#loadedUrl === url
    }

    get standingIn() {
        return !!this.#url() && !this.shown
    }

    markLoaded = () => {
        this.#loadedUrl = this.#url()
    }

    markLoadedIfCached = (image: HTMLImageElement) => {
        const url = this.#url()
        if (image.complete && image.naturalWidth > 0) this.#loadedUrl = url
    }
}
