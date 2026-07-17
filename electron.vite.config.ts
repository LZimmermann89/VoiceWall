import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

// App-Version zur Buildzeit aus package.json einbetten:
// app.getVersion() liefert im Dev-Modus die Electron-Version, nicht die
// App-Version; der Pruefstempel-Footer braucht die echte App-Version.
const packageJson = JSON.parse(readFileSync(join(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  main: {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    build: {
      // Produktions-Abhaengigkeiten (insb. das native @fugood/whisper.node-
      // Addon) werden automatisch externalisiert (electron-vite-Default
      // build.externalizeDeps=true) und zur Laufzeit aus node_modules geladen.
      // zod ist eine devDependency und wird bewusst mitgebuendelt (der
      // sandboxed Preload kann zur Laufzeit nicht aus node_modules laden).
      externalizeDeps: true,
      rollupOptions: {
        // Zwei Main-Entries: der App-Bootstrap und der Whisper-utilityProcess.
        // electron-vite baut beide nach out/main/*.js. Der Worker wird per
        // utilityProcess.fork geladen (siehe engine-manager.ts).
        input: {
          index: 'src/main/index.ts',
          'engine.worker': 'src/main/whisper/engine.worker.ts',
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        // Zwei Preload-Bruecken: das Hauptfenster und das versteckte
        // Audio-Capture-Fenster. Sandbox-Pflicht: Sandboxed Preload-Skripte
        // koennen keine geteilten Chunks nachladen. Deshalb teilen sich beide
        // Preloads bewusst KEIN Laufzeitmodul (capture.ts haelt seine
        // Kanalnamen inline), sodass Rollup keinen gemeinsamen Chunk erzeugt.
        input: {
          index: 'src/preload/index.ts',
          capture: 'src/preload/capture.ts',
          overlay: 'src/preload/overlay.ts',
        },
        output: {
          // Sandboxed Preload-Skripte unterstuetzen kein ESM, deshalb CommonJS.
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        // Drei Renderer-HTML-Entries: die Verwaltungs-/Test-UI, das
        // versteckte Audio-Capture-Fenster und das Diktat-Overlay.
        input: {
          index: 'src/renderer/index.html',
          capture: 'src/renderer/capture.html',
          overlay: 'src/renderer/overlay.html',
        },
      },
    },
  },
});
