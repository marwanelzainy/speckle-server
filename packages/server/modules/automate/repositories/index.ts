import {
  AutomationRecord,
  AutomationRevisionRecord,
  AutomationTriggerDefinitionRecord,
  AutomationRunRecord,
  AutomationTokenRecord,
  AutomationTriggerRecordBase,
  AutomationWithRevision,
  AutomateRevisionFunctionRecord,
  AutomationRunWithTriggersFunctionRuns,
  AutomationRunTriggerRecord,
  AutomationFunctionRunRecord,
  AutomationRevisionWithTriggersFunctions,
  AutomationTriggerType
} from '@/modules/automate/helpers/types'
import {
  AutomationFunctionRuns,
  AutomationRevisionFunctions,
  AutomationRevisions,
  AutomationRunTriggers,
  AutomationRuns,
  AutomationTokens,
  AutomationTriggers,
  Automations
} from '@/modules/core/dbSchema'
import _, { pick } from 'lodash'

export async function getActiveTriggerDefinitions<
  T extends AutomationTriggerType = AutomationTriggerType
>(
  params: AutomationTriggerRecordBase<T>
): Promise<AutomationTriggerDefinitionRecord<T>[]> {
  const { triggeringId, triggerType } = params
  console.log(triggeringId, triggerType)
  return []
}

export async function getAutomationRevision(
  revisionId: string
): Promise<AutomationWithRevision<AutomationRevisionWithTriggersFunctions> | null> {
  const query = AutomationRevisions.knex<AutomationRevisionRecord>()
    .where(AutomationRevisions.col.id, revisionId)
    .first()

  const automationRevision = await query
  if (!automationRevision) return null

  const [functions, triggers, automation] = await Promise.all([
    AutomationRevisionFunctions.knex()
      .select()
      .where(AutomationRevisionFunctions.col.automationRevisionId, revisionId),
    AutomationTriggers.knex()
      .select()
      .where(AutomationTriggers.col.automationRevisionId, revisionId),
    Automations.knex<AutomationRecord>()
      .where(Automations.col.id, automationRevision.automationId)
      .first()
  ])
  if (!automation) return null

  return {
    ...automation,
    revision: {
      ...automationRevision,
      functions,
      triggers
    }
  }
}

export type InsertableAutomationRun = AutomationRunRecord & {
  triggers: Omit<AutomationRunTriggerRecord, 'automationRunId'>[]
  functionRuns: AutomationFunctionRunRecord[]
}

export async function upsertAutomationRun(automationRun: InsertableAutomationRun) {
  await AutomationRuns.knex()
    .insert(_.pick(automationRun, AutomationRuns.withoutTablePrefix.cols))
    .onConflict(AutomationRuns.withoutTablePrefix.col.id)
    .merge([
      AutomationRuns.withoutTablePrefix.col.status,
      AutomationRuns.withoutTablePrefix.col.updatedAt,
      AutomationRuns.withoutTablePrefix.col.executionEngineRunId
    ])
  await Promise.all([
    AutomationRunTriggers.knex()
      .insert(
        automationRun.triggers.map((t) => ({ automationRunId: automationRun.id, ...t }))
      )
      .onConflict()
      .ignore(),
    AutomationFunctionRuns.knex()
      .insert(
        automationRun.functionRuns.map((f) =>
          _.pick(f, AutomationFunctionRuns.withoutTablePrefix.cols)
        )
      )
      .onConflict(AutomationFunctionRuns.withoutTablePrefix.col.id)
      .merge(AutomationFunctionRuns.withoutTablePrefix.cols)
  ])
  return
}

export async function getAutomationRun(
  automationRunId: string
): Promise<AutomationRunWithTriggersFunctionRuns | null> {
  const run = await AutomationRuns.knex<AutomationRunRecord>()
    .select()
    .where({ id: automationRunId })
    .first()
  if (!run) return null

  const [triggers, functionRuns] = await Promise.all([
    AutomationRunTriggers.knex()
      .select<AutomationRunTriggerRecord[]>()
      .where(AutomationRunTriggers.col.automationRunId, automationRunId),
    AutomationFunctionRuns.knex()
      .select<AutomationFunctionRunRecord[]>()
      .where(AutomationFunctionRuns.col.runId, automationRunId)
  ])

  return { ...run, triggers, functionRuns }
}

export async function storeAutomation(
  automation: AutomationRecord,
  automationToken: AutomationTokenRecord
) {
  await Automations.knex().insert(pick(automation, Automations.withoutTablePrefix.cols))
  await AutomationTokens.knex().insert(
    pick(automationToken, AutomationTokens.withoutTablePrefix.cols)
  )
}

export type InsertableAutomationRevision = AutomationRevisionRecord & {
  functions: Omit<AutomateRevisionFunctionRecord, 'automationRevisionId'>[]
  triggers: Omit<AutomationTriggerDefinitionRecord, 'automationRevisionId'>[]
}

export async function storeAutomationRevision(revision: InsertableAutomationRevision) {
  const rev = _.pick(revision, AutomationRevisions.withoutTablePrefix.cols)
  await AutomationRevisions.knex().insert(rev)
  await Promise.all([
    AutomationRevisionFunctions.knex().insert(
      revision.functions.map(
        (f): AutomateRevisionFunctionRecord => ({
          ...f,
          automationRevisionId: revision.id
        })
      )
    ),
    AutomationTriggers.knex().insert(
      revision.triggers.map(
        (t): AutomationTriggerDefinitionRecord => ({
          ...t,
          automationRevisionId: revision.id
        })
      )
    )
  ])
}

export async function getAutomationToken(
  automationId: string
): Promise<AutomationTokenRecord | null> {
  const token = await AutomationTokens.knex<AutomationTokenRecord>()
    .where(AutomationTokens.col.automationId, automationId)
    .first()
  return token || null
}
