export interface NoticeStore {
    findQueuedAt(noticeId: string): Promise<Date | undefined>
    recordQueued(noticeId: string, queuedAt: Date, queued: number): Promise<void>
}
