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
        <CloudArrowUpIcon class="w-6 text-primary" />
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
    <!-- Project selector wizard -->
    <div v-if="step === 1">
      <div>
        <div class="h5 font-bold">Select Project</div>
      </div>
      <WizardProjectSelector @next="selectProject" />
    </div>
    <!-- Model selector wizard -->
    <div v-if="step === 2 && selectedProject && selectedAccountId">
      <div>
        <WizardModelSelector
          :project="selectedProject"
          :account-id="selectedAccountId"
          @next="selectModel"
        />
      </div>
    </div>
    <!-- Version selector wizard -->
    <div v-if="step === 3">
      <div class="flex items-center justify-between mb-2">
        <div class="h5 font-bold">Send Filter</div>
      </div>
      <SendFiltersAndSettings v-model="filter" @update:filter="(f) => (filter = f)" />
      <div class="mt-2">
        <FormButton full-width @click="addModel">Publish</FormButton>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  ModelListModelItemFragment,
  ProjectListProjectItemFragment
} from '~/lib/common/generated/gql/graphql'
import { ISendFilter, SenderModelCard } from '~/lib/models/card/send'
import { useHostAppStore } from '~/store/hostApp'
import { useAccountStore } from '~/store/accounts'
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/vue/24/solid'

const emit = defineEmits(['close'])

const step = ref(1)
const accountStore = useAccountStore()
const { defaultAccount } = storeToRefs(accountStore)

const selectedAccountId = ref<string>(defaultAccount.value?.accountInfo.id as string)
const selectedProject = ref<ProjectListProjectItemFragment>()
const selectedModel = ref<ModelListModelItemFragment>()
const filter = ref<ISendFilter | undefined>(undefined)

const selectProject = (accountId: string, project: ProjectListProjectItemFragment) => {
  step.value++
  selectedAccountId.value = accountId
  selectedProject.value = project
}

const selectModel = (model: ModelListModelItemFragment) => {
  step.value++
  selectedModel.value = model
}

const hostAppStore = useHostAppStore()

const addModel = async () => {
  const model = new SenderModelCard()
  model.accountId = selectedAccountId.value
  model.projectId = selectedProject.value?.id as string
  model.modelId = selectedModel.value?.id as string
  model.sendFilter = filter.value as ISendFilter
  model.expired = false

  emit('close')
  await hostAppStore.addModel(model)
  void hostAppStore.sendModel(model.modelCardId)
}
</script>
