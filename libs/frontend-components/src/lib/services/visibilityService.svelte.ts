export class VisibilityService {
    visible: boolean = $state(false)

    setDocument(document: Document) {
        this.visible = document.visibilityState === 'visible'
        document.addEventListener('visibilitychange', () => {
            this.visible = !document.hidden
        })
    }
}
