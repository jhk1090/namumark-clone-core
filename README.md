## namumark-clone-core

나무위키의 나무마크(the seed)를 구현합니다.\
코드 구현은 [openNAMU](https://github.com/openNAMU/openNAMU)(v3.5.0-v188)의 [func_render_namumark.py](https://github.com/openNAMU/openNAMU/blob/v3.5.0-v188/route/tool/func_render_namumark.py)(`src/index.ts`의 참고 자료) 파일을 사용했으며, 코드의 내용을 TypeScript로 포팅합니다.\
추가로 해당 프로젝트의 [go_api_w_render.py](https://github.com/openNAMU/openNAMU/blob/v3.5.0-v188/route/go_api_w_render.py) 파일을 참고해 include 문법을 구현했으며, `main_css` 스킨의 html, css, js 템플릿을 사용합니다.\
기존 openNAMU의 db를 다 쓰지 않기에 `{ data: { data: "본문 내용", title: "제목" }[] }` 꼴의 json 형태로 db를 모방했습니다.

 - [사용법](#사용법)
 - [저작권 고지](#저작권-고지)
 - [구현 기록](#구현-기록)
 - [문제점](#문제점)

## 사용법
<h3>기본 설치</h3>

 1. 이 저장소를 클론합니다.\
 `git clone https://github.com/jhk1090/namumark-clone-core`
 1. 클론 후 클론된 경로에 터미널을 실행합니다.\
 `cd /path/to/clone`
 1. 프로젝트에 필요한 npm 파일을 다운받습니다.\
 `npm install`\
 만약 typescript가 없다면 밑의 명령을 추가로 실행합니다.\
 `npm install -g typescript@5.7.2`
 1. 이제 모든 준비가 끝났습니다.
---
<h3>실행</h3>

 1. 본 프로젝트는 TypeScript를 사용합니다. 프로젝트를 시작하면 아래의 명령어를 꼭 실행해주세요.\
 `npm run watch`
 1. 밑의 예시를 `src/main.ts`에 작성했다면 다음 명령을 이용해 실행할 수 있습니다.\
 `npm run start`
---
 * 예시 `src/main.ts`
```ts
import { NamuMark } from "./index";

const text_대문 = `
== 개요 ==
환영합니다. [[테스트]]
`
const text_테스트 = `
== 개요 ==
테스트입니다.
`

const database = { data: [{ data: text_테스트, title: "테스트" }] }
const result = (new Namumark(text_대문, { docName: "대문" }, database)).parse()
// result = [ html코드, js코드, { backlink, backlink_dict, footnote, category, temp_storage, link_count } ]

```

 * html 파일로 변환 (상단 예시에 덧붙이기)
```ts
writeFileSync("index.html", `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <link rel="stylesheet" href="style.css">
  <script defer id="katex" src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js" integrity="sha512-LQNxIMR5rXv7o+b1l8+N1EZMfhG7iFZ9HhnbJkTp4zjNr5Wvst75AqUeFDxeRUa7l5vEDyUiAip//r+EFLLCyA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script defer id="hljs" src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js" integrity="sha512-rdhY3cbXURo13l/WU9VlaRyaIYeJ/KBakckXIvJNAQde8DgpOmE+eZf7ha4vdqVjTtwQt69bD2wH2LXob/LB7Q==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/x86asm.min.js" integrity="sha512-HeAchnWb+wLjUb2njWKqEXNTDlcd1QcyOVxb+Mc9X0bWY0U5yNHiY5hTRUt/0twG8NEZn60P3jttqBvla/i2gA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.48.0/min/vs/loader.min.js" integrity="sha512-ZG31AN9z/CQD1YDDAK4RUAvogwbJHv6bHrumrnMLzdCrVu4HeAqrUX7Jsal/cbUwXGfaMUNmQU04tQ8XXl5Znw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlightjs-line-numbers.js/2.8.0/highlightjs-line-numbers.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css" integrity="sha512-fHwaWebuwA7NSF5Qg/af4UeDx9XqUpYpOGgubo3yWu+b2IQR4UeQwbb42Ti7gVAjNtVoI/I9TEoYeu9omwcC6g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/default.min.css" integrity="sha512-hasIneQUHlh06VNBe7f6ZcHmeRTLIaQWFd43YriJ0UND19bvYRauxthDg8E4eVNPm9bRUhr5JGeqH7FRFXQu5g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.41.0/min/vs/editor/editor.main.min.css" integrity="sha512-MFDhxgOYIqLdcYTXw7en/n5BshKoduTitYmX8TkQ+iJOGjrWusRi8+KmfZOrgaDrCjZSotH2d1U1e/Z1KT6nWw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <script defer src="func.js"></script>
  <script defer src="render.js"></script>
</head>
<body>
  <section>
    <article class="main" id="main_data">
      <div class="opennamu_render_complete">
        ${result[0] /* html 코드 */}
      </div>
    </article>
  </section>
  <script>
    ${result[1] /* js 코드 */}
  </script> 
</body>
</html>  
`)
```

## 저작권 고지

이 프로젝트에는 다음의 BSD 3-Clause 라이센스 하에 배포된 원본 코드가 포함되어 있습니다. 본 코드는 [surplus-dev](https://github.com/surplus-dev)님의 코드를 수정한 것입니다.

```
Copyright © 2017-2021, surplus-dev
All rights reserved.

다음은 BSD 3-Clause License의 조건입니다:

1. 이 소프트웨어의 소유권 및 사용 권한은 저작권자 및 기여자에게 부여됩니다.
2. 이 소프트웨어는 "있는 그대로" 제공되며, 저작권자나 기여자는 이 소프트웨어에 대한 어떤 보증도 하지 않습니다.
3. 이 소프트웨어를 재배포할 경우, 이 라이센스 조항과 저작권 표시를 포함해야 합니다.
```

## 구현 기록

code | 구현(v3.5.0-v188)
--- | ---
this.manageIncludeDefault(); | o
this.manageSlash(); | o
this.manageMiddle(); | o
this.manageInclude(); | o
this.manageMath(); | o
this.manageTable(); | o
this.manageList(); | o
this.manageMacro(); | o
this.manageLink(); | o
this.manageText(); | o
this.manageHr(); | o
this.manageFootnote(); | o
this.manageHeading(); | o
this.finalize(); | o

### 현재 문제점

 * 파일이 제대로 표시되지 않는 문제제