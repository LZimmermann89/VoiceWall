# Drittanbieter-Lizenzen (VoiceWall 1.0.0-rc.2)

Dieses Dokument listet alle in VoiceWall enthaltenen beziehungsweise für
die Entwicklung genutzten Drittkomponenten mit ihren Lizenzen und
enthält die vollständigen Lizenztexte. Die Pflicht-Attributionen stehen
zusätzlich in `NOTICE`; maschinenlesbar ist jeder Stand über die
CycloneDX-SBOM (`npm run sbom`, je Release unter `release/`)
nachgewiesen.

## 1. Laufzeit-Komponenten (werden in die App gebündelt oder von ihr geladen)

| Komponente                                                 | Version             | Lizenz                                                 | Quelle                                       |
| ---------------------------------------------------------- | ------------------- | ------------------------------------------------------ | -------------------------------------------- |
| @fugood/whisper.node                                       | 1.0.22              | MIT                                                    | https://github.com/whisper-node/whisper.node |
| @fugood/node-whisper-darwin-arm64                          | 1.0.22              | MIT                                                    | dito (Plattform-Binary)                      |
| @fugood/node-whisper-darwin-x64                            | 1.0.22              | MIT                                                    | dito (Plattform-Binary)                      |
| @fugood/node-whisper-win32-x64                             | 1.0.22              | MIT                                                    | dito (Plattform-Binary)                      |
| @fugood/node-whisper-win32-arm64                           | 1.0.22              | MIT                                                    | dito (Plattform-Binary)                      |
| @fugood/node-whisper-linux-x64                             | 1.0.22              | MIT                                                    | dito (Plattform-Binary)                      |
| @fugood/node-whisper-linux-arm64                           | 1.0.22              | MIT                                                    | dito (Plattform-Binary)                      |
| whisper.cpp (in den Binaries enthalten)                    | gebündelt in 1.0.22 | MIT                                                    | https://github.com/ggml-org/whisper.cpp      |
| react                                                      | 18.3.1              | MIT                                                    | https://github.com/facebook/react            |
| react-dom                                                  | 18.3.1              | MIT                                                    | https://github.com/facebook/react            |
| zod                                                        | 3.25.76             | MIT                                                    | https://github.com/colinhacks/zod            |
| Electron (Laufzeitplattform, bündelt Chromium und Node.js) | 43.0.0              | MIT (Chromium/Node.js: eigene Lizenzen, siehe Hinweis) | https://github.com/electron/electron         |

Hinweis zu zod: In `package.json` steht zod unter `devDependencies`,
weil electron-vite Pakete aus `dependencies` beim Main- und
Preload-Build externalisiert, der sandboxed Preload aber vollständig
gebündelten Code braucht. Funktional ist zod eine gebündelte
Laufzeit-Abhängigkeit und wird deshalb hier gelistet.

Hinweis zu Electron/Chromium: Die ausgelieferte App enthält Chromium und
Node.js als Teil von Electron. Deren vollständige Lizenz- und
Attributions-Sammlungen (BSD-artige und weitere Lizenzen) liegen dem
Electron-Paket bei (`node_modules/electron/dist/LICENSE` und
`node_modules/electron/dist/LICENSES.chromium.html`) und werden mit dem
App-Bundle mitgeliefert.

## 2. Modelle (werden bei der Einrichtung geladen oder offline eingespielt)

| Modell                                                                 | Datei                        | Lizenz     | Quelle                                                         |
| ---------------------------------------------------------------------- | ---------------------------- | ---------- | -------------------------------------------------------------- |
| whisper-large-v3-turbo-german (Q5_0-Quantisierung)                     | ggml-model-q5_0.bin          | Apache-2.0 | https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml |
| whisper-large-v3-turbo-german (fp16)                                   | ggml-model.bin               | Apache-2.0 | https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml |
| whisper large-v3-turbo multilingual (Q5_0), für Diktatsprache Englisch | ggml-large-v3-turbo-q5_0.bin | MIT        | https://huggingface.co/ggerganov/whisper.cpp                   |
| Silero VAD v5.1.2 (GGML-Konvertierung)                                 | ggml-silero-v5.1.2.bin       | MIT        | https://huggingface.co/ggml-org/whisper-vad                    |

Attributions-Kette des deutschen Whisper-Modells (Apache-2.0,
Änderungshinweis gemäß Ziffer 4(b) der Lizenz):

1. Modellarchitektur und Ursprungsgewichte: OpenAI Whisper
   large-v3-turbo, MIT, https://github.com/openai/whisper
2. Deutsches Feintuning: primeLine Solutions GmbH,
   https://huggingface.co/primeline/whisper-large-v3-turbo-german,
   Apache-2.0.
3. GGML-Konvertierung (fp16) und Q5_0-Quantisierung für whisper.cpp:
   "cstr", https://huggingface.co/cstr/whisper-large-v3-turbo-german-ggml.
   Diese konvertierten Dateien sind der tatsächlich geladene Stand;
   sie sind gegenüber dem primeline-Original verändert (Formatwandlung
   nach GGML, Quantisierung).

Attributions-Kette des multilingualen Whisper-Modells (Diktatsprache
Englisch): Modellarchitektur und Ursprungsgewichte OpenAI
Whisper large-v3-turbo (MIT, https://github.com/openai/whisper); die
tatsächlich geladene Datei ist die GGML/Q5_0-Konvertierung aus dem
whisper.cpp-Modellbestand von Georgi Gerganov (MIT,
https://huggingface.co/ggerganov/whisper.cpp); sie ist gegenüber dem
OpenAI-Original verändert (Formatwandlung nach GGML, Quantisierung).

Zur Lizenzlage von Silero VAD: MIT gilt für die v5-Serie
(snakers4/silero-vad); ältere Distributionen hatten abweichende
Lizenzlagen. Deshalb ist die Version auf v5.1.2 gepinnt und die Datei
per SHA-256 verifiziert (`resources/model-manifest.json`).

Rückfallquelle (Mirror): alle vier Modelldateien sind zusätzlich
Byte-identisch als Release-Assets im VoiceWall-Repo gespiegelt
(Release `modelle-v1`). Die Weiterverteilung erfolgt gemäß Apache-2.0
beziehungsweise MIT mit den vorstehenden Attributions-Ketten; am
Inhalt der Dateien ändert der Mirror nichts, die App verifiziert jede
Quelle gegen dieselben SHA-256-Konstanten.

## 3. Entwicklungs-Abhängigkeiten (nicht Teil der ausgelieferten App)

| Paket                                            | Version | Lizenz     | Quelle                                                 |
| ------------------------------------------------ | ------- | ---------- | ------------------------------------------------------ |
| @eslint/js                                       | 10.0.1  | MIT        | https://github.com/eslint/eslint                       |
| @playwright/test                                 | 1.61.1  | Apache-2.0 | https://github.com/microsoft/playwright                |
| @types/node                                      | 26.1.0  | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/react                                     | 18.3.31 | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/react-dom                                 | 18.3.7  | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @vitejs/plugin-react                             | 5.2.0   | MIT        | https://github.com/vitejs/vite-plugin-react            |
| electron-builder                                 | 26.15.3 | MIT        | https://github.com/electron-userland/electron-builder  |
| electron-vite                                    | 5.0.0   | MIT        | https://github.com/alex8088/electron-vite              |
| eslint                                           | 10.6.0  | MIT        | https://github.com/eslint/eslint                       |
| eslint-config-prettier                           | 10.1.8  | MIT        | https://github.com/prettier/eslint-config-prettier     |
| pdf-parse (nur E2E-Umlaut-Beweis, exakt gepinnt) | 1.1.1   | MIT        | https://gitlab.com/autokent/pdf-parse                  |
| prettier                                         | 3.9.4   | MIT        | https://github.com/prettier/prettier                   |
| typescript                                       | 5.9.3   | Apache-2.0 | https://github.com/microsoft/TypeScript                |
| typescript-eslint                                | 8.62.1  | MIT        | https://github.com/typescript-eslint/typescript-eslint |
| vite                                             | 7.3.6   | MIT        | https://github.com/vitejs/vite                         |
| vitest                                           | 4.1.9   | MIT        | https://github.com/vitest-dev/vitest                   |

Transitive Abhängigkeiten sind vollständig in `package-lock.json`
dokumentiert (mit Integritäts-Hashes) und werden über die CI-SBOM
(CycloneDX) je Stand nachgewiesen.

## 4. Lizenztexte

### 4.1 MIT License (Standardtext)

Gilt für alle oben mit "MIT" gekennzeichneten Komponenten; der jeweilige
Copyright-Vermerk steht im `LICENSE`-File des einzelnen Pakets in
`node_modules/` beziehungsweise im jeweiligen Quell-Repository.
Beispielhafte Copyright-Zeilen der zentralen Laufzeitkomponenten:

- whisper.cpp: Copyright (c) 2023-2024 The ggml authors
- @fugood/whisper.node: Copyright (c) 2025 ggml / whisper.cpp
  contributors; Copyright (c) 2025 Jhen-Jie Hong; Copyright (c) 2025
  Hans Chen
- OpenAI Whisper: Copyright (c) 2022 OpenAI
- Silero VAD: Copyright (c) Silero Team
- React: Copyright (c) Meta Platforms, Inc. and affiliates
- zod: Copyright (c) 2020 Colin McDonnell
- Electron: Copyright (c) Electron contributors; Copyright (c)
  2013-2020 GitHub Inc.

```
MIT License

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

### 4.2 Apache License 2.0 (vollständiger Text)

Gilt für das ausgelieferte GGML-Modell
primeline/whisper-large-v3-turbo-german (inklusive der
cstr-Konvertierungen) sowie für die Entwicklungswerkzeuge TypeScript und
@playwright/test.

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
```
