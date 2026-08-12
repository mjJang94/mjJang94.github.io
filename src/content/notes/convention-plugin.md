---
title: 모듈이 늘면 빌드 설정을 어디에 둘 것인가
summary: 모듈 9개와 14개를 각각 만들어보고 나서 정리한, Convention Plugin으로 빌드 설정을 걷어내는 기준
date: 2026-08-12
topic: 컨벤션
projects: [linku, timefit]
---

멀티모듈은 모듈을 나누는 순간이 아니라 **빌드 파일이 복제되기 시작하는 순간**부터 비용이 생깁니다. LinkU에서 9개, TimeFit에서 14개를 만들면서 같은 지점에서 두 번 막혔고, 두 번 다 답은 Convention Plugin이었습니다. 다만 두 번째에는 플러그인을 나누는 방식이 달라졌습니다.

## 언제 걷어내야 하는가

LinkU에서는 모듈이 9개가 되자 각 `build.gradle.kts`에 SDK 버전, Java 17 툴체인, Hilt, KSP, Room, flavor 설정이 그대로 복사되고 있었습니다. 이 시점의 문제는 중복 그 자체가 아니라, **한 곳을 고칠 때 나머지를 다 고쳐야 한다는 사실을 잊는다**는 것입니다. 컴파일은 통과하는데 모듈마다 설정이 미묘하게 어긋난 상태가 조용히 쌓입니다.

기준을 하나 세운다면, 같은 블록을 세 번째로 복사하는 순간입니다. 두 번까지는 우연이지만 세 번째부터는 패턴이고, 패턴은 손이 아니라 코드가 관리해야 합니다.

## 하나로 만들 것인가, 쪼갤 것인가

LinkU에서는 `convention.android.library` 하나로 갔습니다. 라이브러리 모듈의 성격이 거의 같아서 플러그인 한 줄이면 끝났습니다.

```kotlin
// 각 라이브러리 모듈의 build.gradle.kts
plugins {
    id("convention.android.library")
}
```

TimeFit에서는 이 방식이 맞지 않았습니다. `domain`처럼 Compose도 Hilt도 필요 없는 모듈에까지 Compose 컴파일러가 딸려오는 게 걸렸습니다. 그래서 세 개로 쪼개고 조합하게 했습니다.

```kotlin
// feature/schedule/build.gradle.kts 전체
plugins {
    id("convention.android.library")
    id("convention.android.compose")
    id("convention.android.hilt")
}
dependencies {
    implementation(project(":domain"))
    implementation(project(":common-android"))
}
```

정리하면 **모듈의 성격이 한 종류면 하나로, 두 종류 이상이면 축별로 쪼갭니다.** 처음부터 쪼개면 플러그인 3개를 만들어놓고 전부 같이 붙이는 상태가 되기 쉬우니, 실제로 축이 갈릴 때 나누는 편이 낫다고 봅니다.

## 버전과 상수는 플러그인 안이 아니라 한 곳에

플러그인으로 옮기고 나면 SDK 버전 같은 값이 플러그인 코드 안에 박히기 쉽습니다. LinkU에서는 `Const.kt` 한 곳에서만 관리하고 플러그인이 그걸 읽게 했습니다. 앱 버전 코드도 손으로 올리다 실수가 나서 규칙으로 계산합니다.

```
versionCode = major * 10000 + minor * 100 + patch
```

의존성 버전은 별개입니다. TimeFit에서는 Version Catalog(`libs.versions.toml`)에서 `bundles.compose`, `bundles.room`, `bundles.remote`처럼 묶음 단위로 관리했습니다. 플러그인이 "무엇을 붙일지"를 정하고, 카탈로그가 "어떤 버전으로"를 정하는 분담입니다.

## 공통화가 사고를 부른 경우

Convention Plugin이 항상 이득만 주는 건 아닙니다. LinkU에서 라이브러리 모듈에도 `isMinifyEnabled = true`를 걸어둔 적이 있는데, 정식 배포 직전에 릴리즈 빌드에서만 `NoClassDefFoundError`가 났습니다.

원인은 난독화가 두 번 걸린 것이었습니다. 라이브러리 모듈이 먼저 자기 클래스를 난독화하고, 그 결과물을 참조하는 app 모듈이 다시 난독화하니 최종 클래스 이름이 `proguard-rules.pro`에 적힌 원본 이름과 맞지 않았습니다. `-keep` 규칙을 아무리 추가해도 소용이 없었던 이유입니다.

해결은 규칙을 늘리는 게 아니라 걷어내는 쪽이었습니다. **난독화는 최종 앱 모듈에서 한 번만** 수행하고, 라이브러리 단에서 지켜야 할 규칙은 `consumer-rules.pro`로 소비하는 쪽에 전파시킵니다.

여기서 배운 건 Convention Plugin의 위험이기도 합니다. 플러그인에 설정을 넣으면 그 설정이 **모든 모듈에 한 번에 적용됩니다.** 잘못된 설정도 똑같이 한 번에 퍼집니다. 그래서 플러그인에 무언가를 추가할 때는 "이게 모든 모듈에 맞는 설정인가"를 한 번 더 묻게 됐습니다.

## 규칙을 깬 지점을 알고 있기

TimeFit의 의존 방향은 `feature/* → domain ← core/data`로 고정했고 feature 모듈끼리는 참조하지 않기로 했습니다. 그런데 `feature/schedule`이 `feature/widget`의 `RefreshCalendarWidgetUseCase`를 직접 씁니다. 일정을 저장하면 위젯을 갱신해야 하기 때문인데, 이건 규칙을 깬 지점입니다.

정리 방향은 UseCase를 `domain`으로 올리고 위젯 갱신을 인터페이스 뒤로 숨기는 것입니다. 아직 안 했습니다. 다만 규칙을 깬 채로 두는 것과 깬 줄 모르는 것은 다르다고 생각해서, 이런 지점은 문서에 남겨두는 편입니다.

## 다음에 정리할 것

이 사이트의 배포는 `deploy.yml` 하나로 GitHub Actions에서 빌드해 Pages로 올리는 구조입니다. `npm ci` → `npm run build` → artifact 업로드 → 배포까지 단순하고, 지금 규모에서는 이걸로 충분합니다. 안드로이드 쪽 CI는 서명 키와 시크릿 관리가 붙는 순간 성격이 완전히 달라지는데, 그건 따로 정리하겠습니다.
