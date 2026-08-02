<script setup lang="ts">
/**
 * A panel opened over the page rather than in it. The first overlay in Prometheus, and
 * deliberately the only kind: the four settings panels are what it exists for, and none
 * of them holds a draft worth protecting, so Escape, the backdrop and the close button
 * all dismiss without asking.
 *
 * It teleports to the body so that the dashboard's own flex column never has to make
 * room for it — the whole point of the ticket is that the Month does not move.
 */
import { onMounted, onUnmounted, ref, useId } from 'vue'

defineProps<{ title: string }>()

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLElement | undefined>(undefined)
const titleId = useId()

/** The control that opened this, so that closing puts the member back where they were. */
let opener: HTMLElement | undefined

/**
 * What Tab can reach. Read afresh on every press rather than once on open, because these
 * panels grow and shrink as they are used — a chosen import file adds two buttons, a
 * roster entry adds one — and a list taken at open would leave the newcomers outside.
 */
const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function stops(): HTMLElement[] {
  return dialog.value ? [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
}

/**
 * Escape dismisses, and Tab wraps at either end so that focus cannot walk out into the
 * page behind the backdrop — where every control is unreachable by mouse and would be
 * announced as if it were still on offer.
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const reachable = stops()
  const first = reachable[0]
  const last = reachable[reachable.length - 1]
  if (!first || !last) {
    /** Nothing to move to. Focus stays on the dialog itself rather than leaving it. */
    event.preventDefault()
    return
  }

  const here = document.activeElement
  if (event.shiftKey && (here === first || here === dialog.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && here === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  const active = document.activeElement
  opener = active instanceof HTMLElement ? active : undefined
  /**
   * Focus lands on the dialog rather than its first control, so that what is read out
   * first is what this panel is, not the first thing in it. Tab then starts at the top
   * of the panel either way.
   */
  dialog.value?.focus()
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = ''
  opener?.focus()
})
</script>

<template>
  <Teleport to="body">
    <!-- `mousedown.self` rather than a click: a drag that starts inside the panel and
         ends on the backdrop is not a member asking to dismiss it. -->
    <div class="backdrop" @keydown="onKeydown" @mousedown.self="emit('close')">
      <div
        ref="dialog"
        class="card modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <header>
          <h2 :id="titleId" class="section-label">{{ title }}</h2>
          <button
            class="row-action close"
            type="button"
            :aria-label="`Close ${title}`"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  /* Anchored near the top rather than centred: a long Roster is taller than the window,
     and a panel centred in a scrolling backdrop loses its own head off the top edge with
     no way to scroll back up to it. */
  align-items: flex-start;
  justify-content: center;
  padding: 48px 20px;
  overflow-y: auto;
  background: rgb(0 0 0 / 55%);
}

.modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 560px;
}

.modal:focus {
  outline: none;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.close {
  margin: -4px -4px 0 0;
  font-size: 14px;
  line-height: 1;
}
</style>
