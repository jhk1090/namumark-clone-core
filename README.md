## namumark-clone-core

나무위키의 나무마크(the seed)를 구현합니다.\
코드 구현은 [openNAMU](https://github.com/openNAMU/openNAMU)(v3.5.0-v188)의 [func_render_namumark.py](https://github.com/openNAMU/openNAMU/blob/v3.5.0-v188/route/tool/func_render_namumark.py) 파일을 사용했으며, 코드의 내용을 TypeScript로 포팅합니다.

## 알림

이 프로젝트에는 다음의 BSD 3-Clause 라이센스 하에 배포된 원본 코드가 포함되어 있습니다. 본 코드는 [surplus-dev](https://github.com/surplus-dev)님의 코드를 수정한 것입니다.

Copyright © 2017-2021, surplus-dev
All rights reserved.

다음은 BSD 3-Clause License의 조건입니다:

1. 이 소프트웨어의 소유권 및 사용 권한은 저작권자 및 기여자에게 부여됩니다.
2. 이 소프트웨어는 "있는 그대로" 제공되며, 저작권자나 기여자는 이 소프트웨어에 대한 어떤 보증도 하지 않습니다.
3. 이 소프트웨어를 재배포할 경우, 이 라이센스 조항과 저작권 표시를 포함해야 합니다.

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
this.manageFootnote(); | x
this.manageHeading(); | o
this.finalize(); | o

### 현재 문제점

 * link 제대로 안됨: 재구현 필요