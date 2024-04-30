import { getLogger } from '@/modules/automate'
import { FunctionRunReportStatusesError } from '@/modules/automate/errors/runs'
import {
  AutomationRunStatus,
  AutomationRunStatuses
} from '@/modules/automate/helpers/types'
import {
  getFunctionRuns,
  updateAutomationRun,
  updateFunctionRun
} from '@/modules/automate/repositories/automations'
import {
  AutomateFunctionRunStatusReportInput,
  AutomateRunStatus
} from '@/modules/core/graph/generated/graphql'
import { Automate } from '@speckle/shared'
import { difference, groupBy, keyBy, uniqBy } from 'lodash'

const AutomationRunStatusOrder: Array<AutomationRunStatus | AutomationRunStatus[]> = [
  AutomationRunStatuses.pending,
  AutomationRunStatuses.running,
  [
    AutomationRunStatuses.error,
    AutomationRunStatuses.failure,
    AutomationRunStatuses.success
  ]
]

const mapGqlStatusToDbStatus = (status: AutomateRunStatus) => {
  switch (status) {
    case AutomateRunStatus.Initializing:
      return AutomationRunStatuses.pending
    case AutomateRunStatus.Running:
      return AutomationRunStatuses.running
    case AutomateRunStatus.Succeeded:
      return AutomationRunStatuses.success
    case AutomateRunStatus.Failed:
      return AutomationRunStatuses.failure
  }
}

const validateStatusChange = (
  previousStatus: AutomationRunStatus,
  newStatus: AutomationRunStatus
) => {
  if (previousStatus === newStatus) return

  const previousStatusIndex = AutomationRunStatusOrder.findIndex((s) =>
    Array.isArray(s) ? s.includes(previousStatus) : s === previousStatus
  )
  const newStatusIndex = AutomationRunStatusOrder.findIndex((s) =>
    Array.isArray(s) ? s.includes(newStatus) : s === newStatus
  )

  if (newStatusIndex <= previousStatusIndex) {
    throw new FunctionRunReportStatusesError(
      `Invalid status change. Attempting to move from '${previousStatus}' to '${newStatus}'.`
    )
  }
}

type ValidatedRunStatusUpdateItem = {
  update: AutomateFunctionRunStatusReportInput
  run: Awaited<ReturnType<typeof getFunctionRuns>>[0]
  newStatus: AutomationRunStatus
}

const resolveNewAutomationStatus = (functionRunStatuses: AutomationRunStatus[]) => {
  const anyPending = functionRunStatuses.includes(AutomationRunStatuses.pending)
  if (anyPending) return AutomationRunStatuses.pending

  const anyRunning = functionRunStatuses.includes(AutomationRunStatuses.running)
  if (anyRunning) return AutomationRunStatuses.running

  const anyError = functionRunStatuses.includes(AutomationRunStatuses.error)
  if (anyError) return AutomationRunStatuses.error

  const anyFailure = functionRunStatuses.includes(AutomationRunStatuses.failure)
  if (anyFailure) return AutomationRunStatuses.failure

  return AutomationRunStatuses.success
}

export type ReportFunctionRunStatusesDeps = {
  getFunctionRuns: typeof getFunctionRuns
  updateFunctionRun: typeof updateFunctionRun
  updateAutomationRun: typeof updateAutomationRun
}

export const reportFunctionRunStatuses =
  (deps: ReportFunctionRunStatusesDeps) =>
  async (params: { inputs: AutomateFunctionRunStatusReportInput[] }) => {
    const { inputs } = params
    const { getFunctionRuns, updateFunctionRun, updateAutomationRun } = deps

    const uniqueInputs = uniqBy(inputs, (i) => i.functionRunId)
    const existingRuns = keyBy(
      await getFunctionRuns({
        functionRunIds: uniqueInputs.map((i) => i.functionRunId)
      }),
      (r) => r.id
    )

    const errorsByRunId: Record<string, string> = {}
    const validatedUpdates: Array<ValidatedRunStatusUpdateItem> = []
    for (const input of uniqueInputs) {
      const run = existingRuns[input.functionRunId]
      if (!run) {
        errorsByRunId[input.functionRunId] = `Function run not found`
        continue
      }

      const newStatus = mapGqlStatusToDbStatus(input.status)

      try {
        validateStatusChange(run.status, newStatus)
      } catch (e) {
        if (e instanceof FunctionRunReportStatusesError) {
          errorsByRunId[
            input.functionRunId
          ] = `Invalid status change for function run: ${e.message}`
          continue
        } else {
          throw e
        }
      }

      if (input.results) {
        try {
          Automate.AutomateTypes.formatResultsSchema(input.results)
        } catch (e) {
          if (e instanceof Automate.UnformattableResultsSchemaError) {
            errorsByRunId[input.functionRunId] = `Invalid results schema: ${e.message}`
            continue
          } else {
            throw e
          }
        }
      }

      validatedUpdates.push({ update: input, run, newStatus })
    }

    // Group by automation run
    const groupedRuns = groupBy(validatedUpdates, (r) => r.run.runId)
    for (const [runId, updates] of Object.entries(groupedRuns)) {
      try {
        const newAutomationStatus = resolveNewAutomationStatus(
          updates.map((u) => u.newStatus)
        )

        // Update function runs
        await Promise.all(
          updates.map((u) =>
            updateFunctionRun({
              id: u.update.functionRunId,
              status: u.newStatus,
              ...(u.update.contextView?.length
                ? { contextView: u.update.contextView }
                : {}),
              ...(u.update.results
                ? { results: u.update.results as Automate.AutomateTypes.ResultsSchema }
                : {}),
              ...(u.update.statusMessage?.length
                ? { statusMessage: u.update.statusMessage }
                : {})
            })
          )
        )

        // Update automation run
        await updateAutomationRun({
          id: runId,
          status: newAutomationStatus,
          updatedAt: new Date()
        })
      } catch (e) {
        getLogger().error('Automation run status update failed', e, {
          runId,
          updates
        })

        for (const update of updates) {
          errorsByRunId[
            update.update.functionRunId
          ] = `Unexpectedly failed to update status`
        }
        continue
      }
    }

    const successfulUpdates = difference(
      validatedUpdates.map((u) => u.update.functionRunId),
      Object.keys(errorsByRunId)
    )

    return {
      successfullyUpdatedFunctionRunIds: successfulUpdates,
      errorsByFunctionRunId: errorsByRunId
    }
  }
