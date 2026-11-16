import type { GameChatMessage } from '@tabletop/common'

export type ContentReportOpening = { message: GameChatMessage } | { message?: undefined }

class ContentReportState {
    current: ContentReportOpening | undefined = $state(undefined)

    open(opening: ContentReportOpening = {}) {
        this.current = opening
    }

    close() {
        this.current = undefined
    }
}

export const contentReport = new ContentReportState()
