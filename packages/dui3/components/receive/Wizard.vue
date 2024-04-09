<template>
  <div>
    <!-- Close button -->
    <div class="mb-4 -mt-6 flex flex-wrap items-center justify-left space-x-2">
      <div class="grow"></div>
      <button class="hover:text-primary transition" @click="emit('close')">
        <XMarkIcon class="w-4" />
      </button>
    </div>
    <!-- Project - Model navigator/stepper -->
    <div class="mb-4 -mt-4 flex flex-wrap items-center justify-left space-x-2">
      <FormButton class="-mx-3" text @click="step = 1">
        <CloudArrowDownIcon class="w-6 text-primary" />
      </FormButton>
      <div
        v-if="(step === 2 || step === 3) && selectedProject && selectedAccountId"
        class="flex items-center"
      >
        <FormButton v-if="step > 1" class="-mx-3 leading-normal" text @click="step = 2">
          <div class="m-0 truncate max-w-[25vw]">
            {{ selectedProject.name }}
          </div>
        </FormButton>
        <p class="text-primary ml-2">|</p>
      </div>

      <div v-if="step === 3" class="flex items-center">
        <FormButton v-if="step > 1" class="-mx-3 leading-normal" text @click="step = 3">
          <div class="truncate max-w-[15vw]">
            {{ selectedModel.name }}
          </div>
        </FormButton>
        <p class="text-primary ml-2">|</p>
      </div>
      <div
        v-for="index in 4 - step"
        :key="index"
        :class="`rounded-full h-2 w-2 ${
          index === 1 ? 'bg-primary' : 'bg-foreground-2'
        }`"
      ></div>
      <FormButton v-if="step > 1" size="xs" class="-ml-1" text @click="step--">
        Back
      </FormButton>
    </div>
    <!-- Select Project Wizard -->
    <div v-if="step === 1">
      <div>
        <div class="h5 font-bold">Select Project</div>
      </div>
      <WizardProjectSelector :show-new-project="false" @next="selectProject" />
    </div>
    <div v-if="step === 2 && selectedProject && selectedAccountId">
      <div>
        <WizardModelSelector
          :project="selectedProject"
          :account-id="selectedAccountId"
          :show-new-model="false"
          @next="selectModel"
        />
      </div>
    </div>
    <div v-if="step === 3">
      <WizardVersionSelector
        v-if="selectedProject && selectedModel"
        :account-id="selectedAccountId"
        :project-id="selectedProject.id"
        :model-id="selectedModel.id"
        @next="selectVersionAndAddModel"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  ModelListModelItemFragment,
  ProjectListProjectItemFragment,
  VersionListItemFragment
} from '~/lib/common/generated/gql/graphql'
import { useHostAppStore } from '~/store/hostApp'
import { useAccountStore } from '~/store/accounts'
import { XMarkIcon, CloudArrowDownIcon } from '@heroicons/vue/24/solid'
import { ReceiverModelCard } from '~/lib/models/card/receiver'

const emit = defineEmits(['close'])

const step = ref(1)
const accountStore = useAccountStore()
const { defaultAccount } = storeToRefs(accountStore)

const selectedAccountId = ref<string>(defaultAccount.value?.accountInfo.id as string)
const selectedProject = ref<ProjectListProjectItemFragment>()
const selectedModel = ref<ModelListModelItemFragment>()

const selectProject = (accountId: string, project: ProjectListProjectItemFragment) => {
  step.value++
  selectedAccountId.value = accountId
  selectedProject.value = project
}

const selectModel = (model: ModelListModelItemFragment) => {
  step.value++
  selectedModel.value = model
}

const selectVersionAndAddModel = async (
  version: VersionListItemFragment,
  latestVersion: VersionListItemFragment
) => {
  const modelCard = new ReceiverModelCard()
  modelCard.accountId = selectedAccountId.value
  modelCard.projectId = selectedProject.value?.id as string
  modelCard.modelId = selectedModel.value?.id as string

  modelCard.projectName = selectedProject.value?.name as string
  modelCard.modelName = selectedModel.value?.name as string

  modelCard.selectedVersionId = version.id
  modelCard.latestVersionId = latestVersion.id

  modelCard.hasDismissedUpdateWarning = true
  modelCard.hasSelectedOldVersion = version.id !== latestVersion.id

  emit('close')
  await hostAppStore.addModel(modelCard)
  await hostAppStore.receiveModel(modelCard.modelCardId)
}

const hostAppStore = useHostAppStore()
</script>
