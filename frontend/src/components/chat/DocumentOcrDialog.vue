<!--
 * @file DocumentOcrDialog.vue
 * @description Pasa documentos escaneados (PDF o fotos) a texto con el OCR de Mistral.
 * Para cuentas empresariales. El texto (o su traducción) se puede copiar, descargar o
 * llevar al chat para enviarlo.
 -->

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    scrollable
    :fullscreen="mobile"
    @update:model-value="close"
  >
    <v-card class="ocr-dialog">
      <v-toolbar density="comfortable" color="surface">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">
          <v-icon icon="mdi-text-recognition" start />
          {{ $t('ocr.title') }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" variant="text" :aria-label="$t('common.close')" @click="close(false)" />
      </v-toolbar>

      <v-card-text>
        <!-- 1. Elegir archivos -->
        <template v-if="!results.length">
          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ $t('ocr.intro', { files: MAX_FILES, size: MAX_FILE_MB }) }}
          </p>

          <button type="button" class="ocr-drop" :disabled="processing" @click="fileInput?.click()">
            <v-icon icon="mdi-file-upload-outline" size="36" />
            <span class="text-body-1 font-weight-medium">{{ $t('ocr.choose') }}</span>
            <span class="text-caption text-medium-emphasis">PDF · JPG · PNG · WEBP</span>
          </button>
          <input ref="fileInput" type="file" :accept="ACCEPT" multiple hidden @change="addFiles" />

          <v-list v-if="files.length" density="compact" class="mt-3">
            <v-list-item v-for="(file, index) in files" :key="`${file.name}-${index}`" :title="file.name" :subtitle="formatSize(file.size)">
              <template #prepend>
                <v-icon :icon="file.type === 'application/pdf' ? 'mdi-file-pdf-box' : 'mdi-file-image-outline'" />
              </template>
              <template #append>
                <v-btn icon="mdi-close" variant="text" size="small" :disabled="processing" :aria-label="$t('common.delete')" @click="files.splice(index, 1)" />
              </template>
            </v-list-item>
          </v-list>

          <v-select
            v-model="translateTo"
            class="mt-3"
            :items="translateOptions"
            item-title="title"
            item-value="value"
            :label="$t('ocr.translateTo')"
            density="comfortable"
            variant="outlined"
            hide-details
            :disabled="processing"
          />

          <v-progress-linear
            v-if="processing"
            class="mt-4"
            :model-value="uploadProgress"
            :indeterminate="uploadProgress >= 100"
            color="primary"
            rounded
          />
          <p v-if="processing" class="text-caption text-center mt-2">
            {{ uploadProgress < 100 ? $t('ocr.uploading', { n: uploadProgress }) : $t('ocr.reading') }}
          </p>
        </template>

        <!-- 2. Resultados: uno por archivo -->
        <template v-else>
          <v-expansion-panels v-model="openPanels" multiple variant="accordion">
            <v-expansion-panel v-for="(doc, index) in results" :key="index" :value="index">
              <v-expansion-panel-title>
                <v-icon
                  :icon="doc.error ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline'"
                  :color="doc.error ? 'error' : 'success'"
                  start
                />
                <span class="ocr-result__name">{{ doc.file_name }}</span>
                <span v-if="!doc.error" class="text-caption text-medium-emphasis ml-2">
                  {{ $t('ocr.pages', { n: doc.pages_processed }) }}
                </span>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <p v-if="doc.error" class="text-error text-body-2">
                  {{ doc.error === 'unsupported' ? $t('ocr.errorUnsupported') : $t('ocr.errorRead') }}
                </p>

                <template v-else>
                  <!-- Original o traducción -->
                  <v-btn-toggle
                    v-if="doc.translated_text"
                    v-model="views[index]"
                    mandatory
                    density="compact"
                    color="primary"
                    variant="outlined"
                    divided
                    class="ocr-view-toggle mb-3"
                  >
                    <v-btn value="translated">{{ $t('ocr.viewTranslated', { language: languageName(doc.translated_to) }) }}</v-btn>
                    <v-btn value="original">{{ $t('ocr.viewOriginal') }}</v-btn>
                  </v-btn-toggle>
                  <p v-if="doc.translated_to && doc.translated_text === null" class="text-caption text-warning mb-2">
                    {{ $t('ocr.translationFailed') }}
                  </p>
                  <p v-if="doc.translation_truncated && views[index] === 'translated'" class="text-caption text-medium-emphasis mb-2">
                    {{ $t('ocr.translationTruncated') }}
                  </p>

                  <pre class="ocr-text">{{ shownText(doc, index) || $t('ocr.empty') }}</pre>

                  <div class="ocr-actions">
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-content-copy" :disabled="!shownText(doc, index)" @click="copy(doc, index)">
                      {{ $t('common.copy') }}
                    </v-btn>
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-download" :disabled="!shownText(doc, index)" @click="download(doc, index)">
                      {{ $t('ocr.download') }}
                    </v-btn>
                    <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-message-text-outline" :disabled="!shownText(doc, index)" @click="useInChat(doc, index)">
                      {{ $t('ocr.useInChat') }}
                    </v-btn>
                  </div>
                </template>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-btn v-if="results.length" variant="text" prepend-icon="mdi-arrow-left" @click="reset">
          {{ $t('ocr.other') }}
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="!results.length"
          color="primary"
          variant="flat"
          :loading="processing"
          :disabled="!files.length"
          @click="process"
        >
          {{ $t('ocr.process', { n: files.length }) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useTranslationStore } from '@/stores/translationStore';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
});

// use-text: el texto elegido, para ponerlo en el chat
const emit = defineEmits(['update:modelValue', 'use-text']);

// Los mismos límites que el servidor (OCR_MAX_FILES / OCR_MAX_FILE_SIZE_MB)
const MAX_FILES = 10;
const MAX_FILE_MB = 20;
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

const { t } = useI18n();
const { mobile } = useDisplay();
const authStore = useAuthStore();
const translationStore = useTranslationStore();
const snackbar = inject('snackbar', null);

const fileInput = ref(null);
const files = ref([]);
const translateTo = ref(null);
const processing = ref(false);
const uploadProgress = ref(0);
const results = ref([]);
const views = ref({});
const openPanels = ref([0]);

const languageName = (code) => {
  const language = translationStore.languagesByCode?.[code];
  return language?.native_name || language?.name || code || '';
};

// Sin traducir, o al idioma del usuario, o a cualquier otro
const translateOptions = computed(() => {
  const mine = translationStore.getLanguageById(authStore.user?.preferred_language_id)?.code;
  const others = (translationStore.languages || [])
    .filter(language => language.code !== mine)
    .map(language => ({ title: language.native_name || language.name, value: language.code }));
  return [
    { title: t('ocr.noTranslation'), value: null },
    ...(mine ? [{ title: t('ocr.toMyLanguage', { language: languageName(mine) }), value: mine }] : []),
    ...others,
  ];
});

const formatSize = (bytes) => (bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

const addFiles = (event) => {
  const picked = Array.from(event.target.files || []);
  event.target.value = '';

  const tooBig = picked.filter(file => file.size > MAX_FILE_MB * 1024 * 1024);
  if (tooBig.length) snackbar?.error?.(t('ocr.errorTooBig', { size: MAX_FILE_MB }));

  const next = [...files.value, ...picked.filter(file => !tooBig.includes(file))];
  if (next.length > MAX_FILES) snackbar?.error?.(t('ocr.errorTooMany', { n: MAX_FILES }));
  files.value = next.slice(0, MAX_FILES);
};

const process = async () => {
  const form = new FormData();
  for (const file of files.value) form.append('documents', file, file.name);
  if (translateTo.value) form.append('translate_to', translateTo.value);

  processing.value = true;
  uploadProgress.value = 0;
  try {
    const response = await api.post('/api/documents/ocr', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Varios PDFs largos, con traducción, pueden llevar unos minutos
      timeout: 10 * 60 * 1000,
      onUploadProgress: (event) => {
        if (event.total) uploadProgress.value = Math.round((event.loaded / event.total) * 100);
      },
    });
    results.value = response.data.documents || [];
    views.value = Object.fromEntries(results.value.map((doc, index) => [index, doc.translated_text ? 'translated' : 'original']));
    openPanels.value = [0];
  } catch (error) {
    console.error('Error en OCR:', error);
    const status = error.response?.status;
    snackbar?.error?.(
      status === 403 ? t('ocr.errorBusiness')
        : status === 413 ? t('ocr.errorTooBig', { size: MAX_FILE_MB })
          : error.response?.data?.message || t('ocr.errorRead')
    );
  } finally {
    processing.value = false;
  }
};

const shownText = (doc, index) => (views.value[index] === 'translated' ? doc.translated_text : doc.text) || '';

const copy = async (doc, index) => {
  try {
    await navigator.clipboard.writeText(shownText(doc, index));
    snackbar?.show?.({ text: t('chat.copied'), color: 'success' });
  } catch {
    snackbar?.error?.(t('chat.copyError'));
  }
};

const download = (doc, index) => {
  const suffix = views.value[index] === 'translated' ? `_${doc.translated_to}` : '';
  const name = `${doc.file_name.replace(/\.[^.]+$/, '')}${suffix}.txt`;
  const url = URL.createObjectURL(new Blob([shownText(doc, index)], { type: 'text/plain;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const useInChat = (doc, index) => {
  emit('use-text', shownText(doc, index));
  close(false);
};

const reset = () => {
  files.value = [];
  results.value = [];
  views.value = {};
};

const close = (value) => {
  if (value) return;
  if (processing.value) return; // no cortar a mitad de un proceso
  emit('update:modelValue', false);
  reset();
};
</script>

<style lang="scss" scoped>
.ocr-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 24px 16px;
  border: 2px dashed rgba(var(--v-theme-primary), 0.5);
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.05);
  color: inherit;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

// Original / Traducido: ocupa el ancho y no se corta en el teléfono
.ocr-view-toggle {
  width: 100%;

  .v-btn {
    flex: 1 1 0;
    min-width: 0;
    text-transform: none;
  }
}

.ocr-result__name {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ocr-text {
  max-height: 45vh;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
  font-family: inherit;
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ocr-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>
