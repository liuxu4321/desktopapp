<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import PageHeader from '@renderer/components/PageHeader.vue'

type ProjectStatus = 'Active' | 'Review' | 'Paused'

interface Project {
  id: string
  name: string
  owner: string
  status: ProjectStatus
  updated: string
}

interface ProjectForm {
  name: string
  owner: string
  status: ProjectStatus
}

const query = ref('')
const status = ref<'all' | Lowercase<ProjectStatus>>('all')
const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const detailOpen = ref(false)
const deleteOpen = ref(false)
const selectedProject = ref<Project | null>(null)
const nextProjectNumber = ref(1043)
const form = reactive<ProjectForm>({ name: '', owner: '', status: 'Active' })

const records = ref<Project[]>([
  {
    id: 'PRJ-1042',
    name: 'Desktop shell',
    owner: 'Maya Chen',
    status: 'Active',
    updated: '2 min ago',
  },
  {
    id: 'PRJ-1038',
    name: 'Update service',
    owner: 'Noah Kim',
    status: 'Review',
    updated: '18 min ago',
  },
  {
    id: 'PRJ-1031',
    name: 'Settings migration',
    owner: 'Ava Patel',
    status: 'Active',
    updated: '1 hour ago',
  },
  {
    id: 'PRJ-1027',
    name: 'Telemetry pipeline',
    owner: 'Leo Martin',
    status: 'Paused',
    updated: 'Yesterday',
  },
  {
    id: 'PRJ-1019',
    name: 'Release automation',
    owner: 'Sofia Rossi',
    status: 'Review',
    updated: 'Yesterday',
  },
  {
    id: 'PRJ-1012',
    name: 'Import workflow',
    owner: 'Ethan Jones',
    status: 'Active',
    updated: '3 days ago',
  },
])

const filteredRecords = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  return records.value.filter(
    (record) =>
      (status.value === 'all' || record.status.toLocaleLowerCase() === status.value) &&
      (!value || `${record.id} ${record.name} ${record.owner}`.toLocaleLowerCase().includes(value)),
  )
})

const formValid = computed(() => Boolean(form.name.trim() && form.owner.trim()))

function openCreate(): void {
  editorMode.value = 'create'
  selectedProject.value = null
  Object.assign(form, { name: '', owner: '', status: 'Active' satisfies ProjectStatus })
  editorOpen.value = true
}

function openEdit(project: Project): void {
  editorMode.value = 'edit'
  selectedProject.value = project
  Object.assign(form, { name: project.name, owner: project.owner, status: project.status })
  detailOpen.value = false
  editorOpen.value = true
}

function openDetails(project: Project): void {
  selectedProject.value = project
  detailOpen.value = true
}

function openDelete(project: Project): void {
  selectedProject.value = project
  detailOpen.value = false
  deleteOpen.value = true
}

function saveProject(): void {
  if (!formValid.value) return

  if (editorMode.value === 'create') {
    records.value.unshift({
      id: `PRJ-${nextProjectNumber.value++}`,
      name: form.name.trim(),
      owner: form.owner.trim(),
      status: form.status,
      updated: 'Just now',
    })
  } else if (selectedProject.value) {
    const updatedProject: Project = {
      ...selectedProject.value,
      name: form.name.trim(),
      owner: form.owner.trim(),
      status: form.status,
      updated: 'Just now',
    }
    records.value = records.value.map((project) =>
      project.id === updatedProject.id ? updatedProject : project,
    )
    selectedProject.value = updatedProject
  }

  editorOpen.value = false
}

function deleteProject(): void {
  if (!selectedProject.value) return
  records.value = records.value.filter((project) => project.id !== selectedProject.value?.id)
  selectedProject.value = null
  deleteOpen.value = false
}
</script>

<template>
  <section class="page compact-page list-demo-page">
    <PageHeader
      title="Projects"
      :description="`${filteredRecords.length} of ${records.length} records`"
    >
      <template #search>
        <label class="content-search">
          <Search :size="16" aria-hidden="true" />
          <input v-model="query" type="search" placeholder="Search projects" />
        </label>
      </template>
      <template #actions>
        <select v-model="status" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="review">Review</option>
          <option value="paused">Paused</option>
        </select>
        <button type="button" @click="openCreate">
          <Plus :size="16" aria-hidden="true" />New project
        </button>
      </template>
    </PageHeader>

    <div class="data-table-frame">
      <table class="data-table project-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Updated</th>
            <th class="table-actions-heading">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.id">
            <td>
              <button class="table-name-button" type="button" @click="openDetails(record)">
                <strong>{{ record.name }}</strong>
                <small>{{ record.id }}</small>
              </button>
            </td>
            <td>{{ record.owner }}</td>
            <td>
              <span class="status-badge" :class="record.status.toLocaleLowerCase()">
                {{ record.status }}
              </span>
            </td>
            <td>{{ record.updated }}</td>
            <td>
              <div class="table-row-actions">
                <button
                  type="button"
                  aria-label="View project"
                  title="View"
                  @click="openDetails(record)"
                >
                  <Eye :size="15" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Edit project"
                  title="Edit"
                  @click="openEdit(record)"
                >
                  <Pencil :size="15" aria-hidden="true" />
                </button>
                <button
                  class="table-delete-button"
                  type="button"
                  aria-label="Delete project"
                  title="Delete"
                  @click="openDelete(record)"
                >
                  <Trash2 :size="15" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredRecords.length === 0">
            <td class="table-empty" colspan="5">No matching projects</td>
          </tr>
        </tbody>
      </table>
      <footer class="table-footer">
        <span>Showing {{ filteredRecords.length }} records</span>
        <div>
          <button class="table-page-button" type="button" disabled aria-label="Previous page">
            <ChevronLeft :size="16" />
          </button>
          <button class="table-page-button" type="button" disabled aria-label="Next page">
            <ChevronRight :size="16" />
          </button>
        </div>
      </footer>
    </div>

    <AppDialog
      :open="editorOpen"
      :title="editorMode === 'create' ? 'New project' : 'Edit project'"
      :description="
        editorMode === 'create'
          ? 'Create a project in the current workspace.'
          : `Update ${selectedProject?.id ?? 'project'} information.`
      "
      @close="editorOpen = false"
    >
      <form class="project-form" @submit.prevent="saveProject">
        <label class="dialog-field">
          <span>Project name</span>
          <input v-model="form.name" required placeholder="Enter a project name" autofocus />
        </label>
        <label class="dialog-field">
          <span>Owner</span>
          <input v-model="form.owner" required placeholder="Enter an owner name" />
        </label>
        <label class="dialog-field">
          <span>Status</span>
          <select v-model="form.status">
            <option value="Active">Active</option>
            <option value="Review">Review</option>
            <option value="Paused">Paused</option>
          </select>
        </label>
      </form>
      <template #footer>
        <button class="secondary-button" type="button" @click="editorOpen = false">Cancel</button>
        <button type="button" :disabled="!formValid" @click="saveProject">
          {{ editorMode === 'create' ? 'Create project' : 'Save changes' }}
        </button>
      </template>
    </AppDialog>

    <AppDialog
      :open="detailOpen"
      title="Project details"
      description="Review the current project information."
      @close="detailOpen = false"
    >
      <dl v-if="selectedProject" class="project-detail-list">
        <dt>Project</dt>
        <dd>
          <strong>{{ selectedProject.name }}</strong>
          <small>{{ selectedProject.id }}</small>
        </dd>
        <dt>Owner</dt>
        <dd>{{ selectedProject.owner }}</dd>
        <dt>Status</dt>
        <dd>
          <span class="status-badge" :class="selectedProject.status.toLocaleLowerCase()">
            {{ selectedProject.status }}
          </span>
        </dd>
        <dt>Updated</dt>
        <dd>{{ selectedProject.updated }}</dd>
      </dl>
      <template #footer>
        <button class="secondary-button" type="button" @click="detailOpen = false">Close</button>
        <button type="button" @click="selectedProject && openEdit(selectedProject)">Edit</button>
      </template>
    </AppDialog>

    <AppDialog
      :open="deleteOpen"
      title="Delete project"
      description="This action removes the project from the current list."
      @close="deleteOpen = false"
    >
      <p class="dialog-message">
        Delete <strong>{{ selectedProject?.name }}</strong
        >? This action cannot be undone.
      </p>
      <template #footer>
        <button class="secondary-button" type="button" @click="deleteOpen = false">Cancel</button>
        <button class="danger-button" type="button" @click="deleteProject">Delete project</button>
      </template>
    </AppDialog>
  </section>
</template>
