# Drittanbieter-Lizenzen (Grundgerüst M0)

Dieses Dokument listet die in VoiceWall enthaltenen beziehungsweise für die
Entwicklung genutzten Drittkomponenten mit ihren Lizenzen. Es wird je
Meilenstein fortgeschrieben. Whisper.cpp, das GGML-Modell und Silero VAD
kommen erst in M1/M2 hinzu und werden dann hier ergänzt.

## Laufzeit-Abhängigkeiten (werden in die App gebündelt)

| Paket     | Version | Lizenz | Quelle                            |
| --------- | ------- | ------ | --------------------------------- |
| react     | 18.3.1  | MIT    | https://github.com/facebook/react |
| react-dom | 18.3.1  | MIT    | https://github.com/facebook/react |
| zod       | 3.25.76 | MIT    | https://github.com/colinhacks/zod |

Hinweis zu zod: In `package.json` steht zod unter `devDependencies`, weil
electron-vite Pakete aus `dependencies` beim Main- und Preload-Build
externalisiert, der sandboxed Preload aber vollständig gebündelten Code
braucht. Funktional ist zod eine gebündelte Laufzeit-Abhängigkeit und wird
deshalb hier gelistet.

## Entwicklungs-Abhängigkeiten (nicht Teil der ausgelieferten App)

| Paket                  | Version | Lizenz     | Quelle                                             |
| ---------------------- | ------- | ---------- | -------------------------------------------------- |
| electron               | 43.0.0  | MIT        | https://github.com/electron/electron               |
| electron-vite          | 5.0.0   | MIT        | https://github.com/alex8088/electron-vite          |
| vite                   | 7.3.6   | MIT        | https://github.com/vitejs/vite                     |
| @vitejs/plugin-react   | 5.2.0   | MIT        | https://github.com/vitejs/vite-plugin-react        |
| typescript             | 5.9.3   | Apache-2.0 | https://github.com/microsoft/TypeScript            |
| eslint                 | 10.6.0  | MIT        | https://github.com/eslint/eslint                   |
| @eslint/js             | 10.0.1  | MIT        | https://github.com/eslint/eslint                   |
| typescript-eslint      | 8.62.1  | MIT        | https://github.com/typescript-eslint               |
| eslint-config-prettier | 10.1.8  | MIT        | https://github.com/prettier/eslint-config-prettier |
| prettier               | 3.9.4   | MIT        | https://github.com/prettier/prettier               |
| vitest                 | 4.1.9   | MIT        | https://github.com/vitest-dev/vitest               |
| @playwright/test       | 1.61.1  | Apache-2.0 | https://github.com/microsoft/playwright            |
| @types/node            | 26.1.0  | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react           | 18.3.31 | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react-dom       | 18.3.7  | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped |

Transitive Abhängigkeiten sind vollständig in `package-lock.json`
dokumentiert und werden über die CI-SBOM (CycloneDX) je Stand nachgewiesen.

## Lizenztexte

### MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Der jeweilige Copyright-Vermerk steht im `LICENSE`-File des einzelnen Pakets
innerhalb von `node_modules/`.

### Apache License 2.0 (TypeScript, @playwright/test)

Der vollständige Lizenztext ist unter
https://www.apache.org/licenses/LICENSE-2.0 verfügbar und liegt den Paketen
in `node_modules/typescript/LICENSE.txt` beziehungsweise
`node_modules/playwright-core/LICENSE` bei. Für ausgelieferte Komponenten
unter Apache-2.0 (ab M2: GGML-Modell) wird der volle Text hier eingebettet
und die NOTICE-Pflicht in `NOTICE` erfüllt.
