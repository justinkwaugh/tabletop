import * as Type from 'typebox'

export const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 2000
export const BUG_REPORT_SCREENSHOT_MAX_COUNT = 3
export const BUG_REPORT_SCREENSHOT_MAX_BYTES = 1_500_000
export const BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH = Math.ceil(BUG_REPORT_SCREENSHOT_MAX_BYTES / 3) * 4

export type BugReportView = Type.Static<typeof BugReportView>
export const BugReportView = Type.Object({
    actionCount: Type.Optional(Type.Integer({ minimum: 0 })),
    inHistory: Type.Boolean(),
    exploring: Type.Boolean()
})

export type BugReportVersions = Type.Static<typeof BugReportVersions>
export const BugReportVersions = Type.Object({
    site: Type.Optional(Type.String({ maxLength: 64 })),
    logic: Type.Optional(Type.String({ maxLength: 64 })),
    ui: Type.Optional(Type.String({ maxLength: 64 }))
})

export type BugReportClient = Type.Static<typeof BugReportClient>
export const BugReportClient = Type.Object({
    userAgent: Type.String({ maxLength: 512 }),
    viewport: Type.String({ maxLength: 64 }),
    installedApp: Type.Boolean()
})

// A JPEG begins with the bytes FF D8 FF, which base64 encodes as "/9j/".
export type BugReportScreenshot = Type.Static<typeof BugReportScreenshot>
export const BugReportScreenshot = Type.String({
    maxLength: BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH,
    pattern: '^/9j/[A-Za-z0-9+/]*={0,2}$'
})

export type BugReportRequest = Type.Static<typeof BugReportRequest>
export const BugReportRequest = Type.Object(
    {
        gameId: Type.String({ minLength: 1 }),
        description: Type.String({
            minLength: 1,
            maxLength: BUG_REPORT_DESCRIPTION_MAX_LENGTH
        }),
        view: BugReportView,
        versions: BugReportVersions,
        client: BugReportClient,
        screenshots: Type.Optional(
            Type.Array(BugReportScreenshot, { minItems: 1, maxItems: BUG_REPORT_SCREENSHOT_MAX_COUNT })
        )
    },
    { additionalProperties: false }
)
