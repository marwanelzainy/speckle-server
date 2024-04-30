import {
  AutomationCreationError,
  AutomationUpdateError
} from '@/modules/automate/errors/management'
import {
  getAutomation,
  updateAutomation as updateDbAutomation
} from '@/modules/automate/repositories/automations'
import { updateAutomation } from '@/modules/automate/services/automationManagement'
import { createStoredAuthCode } from '@/modules/automate/services/executionEngine'
import { getGenericRedis } from '@/modules/core'
import { ProjectAutomationRevisionCreateInput } from '@/modules/core/graph/generated/graphql'
import { BranchRecord } from '@/modules/core/helpers/types'
import { getLatestStreamBranch } from '@/modules/core/repositories/branches'
import { expectToThrow } from '@/test/assertionHelper'
import { BasicTestUser, createTestUsers } from '@/test/authHelper'
import { AutomateValidateAuthCodeDocument } from '@/test/graphql/generated/graphql'
import { TestApolloServer, testApolloServer } from '@/test/graphqlHelper'
import { beforeEachContext } from '@/test/hooks'
import {
  buildAutomationCreate,
  buildAutomationRevisionCreate,
  createTestFunction
} from '@/test/speckle-helpers/automationHelper'
import { BasicTestStream, createTestStreams } from '@/test/speckle-helpers/streamHelper'
import { Automate, Environment, Roles } from '@speckle/shared'
import { expect } from 'chai'

const { FF_AUTOMATE_MODULE_ENABLED } = Environment.getFeatureFlags()

const buildAutomationUpdate = () => {
  const update = updateAutomation({
    getAutomation,
    updateAutomation: updateDbAutomation
  })

  return update
}

;(FF_AUTOMATE_MODULE_ENABLED ? describe : describe.skip)(
  'Automations @automate',
  () => {
    const me: BasicTestUser = {
      id: '',
      name: 'Itsa Me!',
      email: 'me@automate.com',
      role: Roles.Server.User
    }

    const otherGuy: BasicTestUser = {
      id: '',
      name: 'Other dude',
      email: 'otherguy@automate.com',
      role: Roles.Server.User
    }

    const myStream: BasicTestStream = {
      id: '',
      name: 'First stream',
      isPublic: true,
      ownerId: ''
    }

    before(async () => {
      await beforeEachContext()
      await createTestUsers([me, otherGuy])
      await createTestStreams([[myStream, me]])
    })

    describe('creation', () => {
      ;[
        { name: '', error: 'too short' },
        { name: 'a'.repeat(256), error: 'too long' }
      ].forEach(({ name, error }) => {
        it(`fails if name is ${error}`, async () => {
          const create = buildAutomationCreate()

          const e = await expectToThrow(
            async () =>
              await create({
                input: { name, enabled: true },
                projectId: myStream.id,
                userId: me.id
              })
          )
          expect(e).to.have.property('name', AutomationCreationError.name)
          expect(e).to.have.property(
            'message',
            'Automation name should be a string between the length of 1 and 255 characters.'
          )
        })
      })

      it('fails if refering to a project that doesnt exist', async () => {
        const create = buildAutomationCreate()

        const e = await expectToThrow(
          async () =>
            await create({
              input: { name: 'Automation', enabled: true },
              projectId: 'non-existent',
              userId: me.id
            })
        )
        expect(e)
          .to.have.property('message')
          .match(/^User does not have required access to stream/)
      })

      it('fails if user does not have access to the project', async () => {
        const create = buildAutomationCreate()

        const e = await expectToThrow(
          async () =>
            await create({
              input: { name: 'Automation', enabled: true },
              projectId: myStream.id,
              userId: otherGuy.id
            })
        )
        expect(e)
          .to.have.property('message')
          .match(/^User does not have required access to stream/)
      })

      it('creates an automation', async () => {
        const create = buildAutomationCreate()

        const automation = await create({
          input: { name: 'Automation #1', enabled: true },
          projectId: myStream.id,
          userId: me.id
        })

        expect(automation).to.be.ok
        expect(automation.automation).to.be.ok
        expect(automation.token).to.be.ok
      })
    })

    describe('updating', () => {
      let createdAutomation: Awaited<
        ReturnType<ReturnType<typeof buildAutomationCreate>>
      >
      const create = buildAutomationCreate()

      before(async () => {
        const create = buildAutomationCreate()
        createdAutomation = await create({
          input: { name: 'Automation #1', enabled: true },
          projectId: myStream.id,
          userId: me.id
        })
      })

      it('fails if refering to an automation that doesnt exist', async () => {
        const update = buildAutomationUpdate()

        const e = await expectToThrow(
          async () =>
            await update({
              input: { id: 'non-existent', enabled: false },
              userId: me.id,
              projectId: myStream.id
            })
        )
        expect(e).to.have.property('name', AutomationUpdateError.name)
        expect(e).to.have.property('message', 'Automation not found')
      })

      it('fails if refering to an automation in a project owned by someone else', async () => {
        const update = buildAutomationUpdate()

        const e = await expectToThrow(
          async () =>
            await update({
              input: { id: createdAutomation.automation.id, enabled: false },
              userId: otherGuy.id,
              projectId: myStream.id
            })
        )
        expect(e)
          .to.have.property('message')
          .match(/^User does not have required access to stream/)
      })

      it('fails if automation is mismatched with specified project id', async () => {
        const update = buildAutomationUpdate()

        const e = await expectToThrow(
          async () =>
            await update({
              input: { id: createdAutomation.automation.id, enabled: false },
              userId: me.id,
              projectId: 'non-existent'
            })
        )
        expect(e).to.have.property('message', 'Automation not found')
      })

      it('only updates set & non-null values', async () => {
        const update = buildAutomationUpdate()
        const { automation: initAutomation } = await create({
          input: { name: 'Automation #2', enabled: true },
          projectId: myStream.id,
          userId: me.id
        })

        const updatedAutomation = await update({
          input: { id: initAutomation.id, enabled: false },
          userId: me.id,
          projectId: myStream.id
        })

        expect(updatedAutomation).to.be.ok
        expect(updatedAutomation.enabled).to.be.false
        expect(updatedAutomation.name).to.equal(initAutomation.name)
      })

      it('updates all available properties', async () => {
        const update = buildAutomationUpdate()
        const { automation: initAutomation } = await create({
          input: { name: 'Automation #3', enabled: true },
          projectId: myStream.id,
          userId: me.id
        })

        const input = {
          id: initAutomation.id,
          name: 'Updated Automation',
          enabled: false
        }
        const updatedAutomation = await update({
          input,
          userId: me.id,
          projectId: myStream.id
        })

        expect(updatedAutomation).to.be.ok
        expect(updatedAutomation.enabled).to.eq(input.enabled)
        expect(updatedAutomation.name).to.equal(input.name)
      })
    })

    describe('revision creation', () => {
      let createdAutomation: Awaited<
        ReturnType<ReturnType<typeof buildAutomationCreate>>
      >
      let createdFunction: Awaited<ReturnType<typeof createTestFunction>>
      let projectModel: BranchRecord

      const validAutomationRevisionCreateInput =
        (): ProjectAutomationRevisionCreateInput => ({
          automationId: createdAutomation.automation.id,
          functions: [
            {
              functionReleaseId: createdFunction.release!.functionReleaseId,
              parameters: null
            }
          ],
          triggerDefinitions: <Automate.AutomateTypes.TriggerDefinitionsSchema>{
            version: 1.0,
            definitions: [
              {
                type: 'VERSION_CREATED',
                modelId: projectModel.id
              }
            ]
          }
        })

      before(async () => {
        const createAutomation = buildAutomationCreate()
        const createFunction = createTestFunction

        createdAutomation = await createAutomation({
          input: { name: 'Automation #2', enabled: true },
          projectId: myStream.id,
          userId: me.id
        })
        createdFunction = await createFunction({
          userId: me.id
        })
        projectModel = await getLatestStreamBranch(myStream.id)
      })

      it('works successfully', async () => {
        const create = buildAutomationRevisionCreate()

        const ret = await create({
          userId: me.id,
          input: validAutomationRevisionCreateInput(),
          projectId: myStream.id
        })
        expect(ret).to.be.ok
        expect(ret.id).to.be.ok
        expect(ret.active).to.be.true
        expect(ret.automationId).to.equal(createdAutomation.automation.id)
        expect(ret.triggers.length).to.be.ok
        expect(ret.functions.length).to.be.ok
      })

      it('fails if automation does not exist', async () => {
        const create = buildAutomationRevisionCreate()

        const e = await expectToThrow(
          async () =>
            await create({
              userId: me.id,
              input: {
                ...validAutomationRevisionCreateInput(),
                automationId: 'non-existent'
              },
              projectId: myStream.id
            })
        )
        expect(e).to.have.property('name', AutomationUpdateError.name)
        expect(e).to.have.property('message', 'Automation not found')
      })

      it('fails if user does not have access to the project', async () => {
        const create = buildAutomationRevisionCreate()

        const e = await expectToThrow(
          async () =>
            await create({
              userId: otherGuy.id,
              input: validAutomationRevisionCreateInput(),
              projectId: myStream.id
            })
        )
        expect(e)
          .to.have.property('message')
          .match(/^User does not have required access to stream/)
      })

      it('fails if automation is mismatched with specified project id', async () => {
        const create = buildAutomationRevisionCreate()

        const e = await expectToThrow(
          async () =>
            await create({
              userId: me.id,
              input: validAutomationRevisionCreateInput(),
              projectId: 'non-existent'
            })
        )
        expect(e).to.have.property('message', 'Automation not found')
      })
      ;[
        { val: null, error: 'null object' },
        { val: {}, error: 'empty object' },
        { val: { version: 1.0 }, error: 'missing definitions' },
        { val: { version: '1.0', error: 'non-numeric version' } },
        { val: { version: 1.0, definitions: null }, error: 'null definitions' },
        {
          val: { version: 1.0, definitions: [null] },
          error: 'null definition'
        },
        {
          val: { version: 1.0, definitions: [{}] },
          error: 'empty definition'
        },
        {
          val: { version: 1.0, definitions: [{ type: 'VERSION_CREATED' }] },
          error: 'missing modelId'
        },
        {
          val: { version: 1.0, definitions: [{ type: 'aaaa', modelId: '123' }] },
          error: 'invalid trigger'
        }
      ].forEach(({ val, error }) => {
        it('fails with invalid trigger definitions: ' + error, async () => {
          const create = buildAutomationRevisionCreate()

          const e = await expectToThrow(
            async () =>
              await create({
                userId: me.id,
                input: {
                  ...validAutomationRevisionCreateInput(),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  triggerDefinitions: val as any
                },
                projectId: myStream.id
              })
          )

          expect(
            e instanceof Automate.UnformattableTriggerDefinitionSchemaError,
            e.toString()
          ).to.be.true
        })
      })

      it('fails if empty trigger definitions', async () => {
        const create = buildAutomationRevisionCreate()

        const e = await expectToThrow(
          async () =>
            await create({
              userId: me.id,
              input: {
                ...validAutomationRevisionCreateInput(),
                triggerDefinitions: { version: 1.0, definitions: [] }
              },
              projectId: myStream.id
            })
        )

        expect(e.message).to.eq('At least one trigger definition is required')
      })

      it('fails with invalid function parameters', async () => {
        const create = buildAutomationRevisionCreate()

        const input = validAutomationRevisionCreateInput()
        input.functions.forEach((fn) => {
          fn.parameters = '{invalid'
        })

        const e = await expectToThrow(
          async () =>
            await create({
              userId: me.id,
              input,
              projectId: myStream.id
            })
        )

        expect(e.message).to.match(/^Couldn't parse function parameters/i)
      })

      it('fails when refering to nonexistent function releases', async () => {
        const create = buildAutomationRevisionCreate()

        const input = validAutomationRevisionCreateInput()
        input.functions.forEach((fn) => {
          fn.functionReleaseId = 'non-existent'
        })

        const e = await expectToThrow(
          async () =>
            await create({
              userId: me.id,
              input,
              projectId: myStream.id
            })
        )

        expect(e.message).to.match(/^Function release with ID .*? not found/)
      })
    })

    describe('auth code handshake', () => {
      let apollo: TestApolloServer

      before(async () => {
        apollo = await testApolloServer() // unauthenticated
      })

      it('fails if code is invalid', async () => {
        const res = await apollo.execute(AutomateValidateAuthCodeDocument, {
          code: 'invalid'
        })

        expect(res).to.haveGraphQLErrors('Invalid automate auth code')
        expect(res.data?.automateValidateAuthCode).to.not.be.ok
      })

      it('succeeds with valid code', async () => {
        const storeCode = createStoredAuthCode({
          redis: getGenericRedis()
        })
        const code = await storeCode()

        const res = await apollo.execute(AutomateValidateAuthCodeDocument, {
          code
        })

        expect(res).to.not.haveGraphQLErrors()
        expect(res.data?.automateValidateAuthCode).to.be.true
      })
    })
  }
)
