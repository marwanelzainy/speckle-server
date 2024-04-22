// TODO: Move this to helpers, add Record suffix to DB types & fix up results schema type

export type AutomationTrigger = {
  triggeringId: string
  triggerType: 'versionCreation'
}

export type AutomationTriggerModelVersion = {
  versionId: string
  // i know, im force narrowing the potential union type
  triggerType: 'versionCreation'
} & AutomationTrigger

export type AutomationRevisionTrigger = {
  automationRevisionId: string
} & AutomationTrigger

export type Automation = {
  id: string
  name: string
  projectId: string
  userId: string | null
  enabled: boolean
  createdAt: Date
  executionEngineAutomationId: string
}

export type AutomateFunction = {
  functionId: string
  functionReleaseId: string
  functionInputs: Record<string, unknown> | null
}

export type AutomationRevision = {
  id: string
  automationId: string
  triggers: AutomationTrigger[]
  functions: AutomateFunction[]
  active: boolean
  createdAt: Date
  userId: string | null
}

export type AutomationWithRevision = Automation & AutomationRevision

export type AutomationToken = {
  automationId: string
  automateToken: string
  automateRefreshToken: string
}

export type AutomationRunTrigger = {
  modelId: string
  versionId: string
  triggerType: 'versionCreation'
}

export type AutomationRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failure'
  | 'error'

export type AutomationRun = {
  id: string
  automationRevisionId: string
  createdAt: Date
  updatedAt: Date
  status: AutomationRunStatus
  functionRuns: AutomationFunctionRun[]
  triggers: AutomationTrigger[]
  executionEngineRunId: string | null
}

export type ObjectResultLevel = 'info' | 'warning' | 'error'

export type AutomationFunctionRun = {
  id: string
  runId: string
  functionId: string
  functionReleaseId: string
  functionInputs: Record<string, unknown> | null
  elapsed: number
  status: AutomationRunStatus
  contextView: string | null
  resultVersions: string[]
  statusMessage: string | null
  results: {
    version: '1.0.0'
    values: {
      objectResults: Record<
        string,
        {
          category: string
          level: ObjectResultLevel
          objectIds: string[]
          message: string | null
          metadata: Record<string, unknown> | null
          visualoverrides: Record<string, unknown> | null
        }[]
      >
      blobIds?: string[]
    }
  } | null
}
