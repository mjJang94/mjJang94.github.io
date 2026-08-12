---
title: LinkU
summary: 어떤 앱에서든 공유한 링크를 화면 전환 없이 저장하고, 백그라운드에서 본문 메타데이터를 수집해 카드로 정리해 주는 링크 아카이빙 앱입니다.
period: 2025.09 ~ 2025.11
platform: Android
role: 1인 개발 (기획 · 아키텍처 설계 · 구현 전담)
kind: product
current: false
order: 3
stack: 
- MVVM
- Kotlin
- Jetpack Compose
- Hilt
- Coroutines
- Flow
- Room
- Paging 3
- WorkManager
- Jsoup
- Gradle Convention Plugin
highlights:
  - 공유 인텐트를 투명 Activity로 받아 화면 전환 없이 저장하고, 느린 메타데이터 수집은 WorkManager로 분리했습니다.
  - 9개 모듈 + Convention Plugin으로 빌드 설정을 한 곳에서 관리합니다.
  - Google Play 정식 배포(v1.00.03), 광고와 온디바이스 NLP는 도입 후 걷어냈습니다.
store: https://play.google.com/store/apps/details?id=com.mj.app.linku
---

## 왜 만들었는가

브라우저나 SNS에서 만난 "나중에 볼 링크"는 대부분 다시 열리지 않습니다. 브라우저 북마크는 앱마다 파편화되고, 메신저의 "나에게 보내기"는 대화 기록에 섞여 며칠만 지나도 찾을 수 없습니다. 문제는 저장할 곳이 없다는 게 아니라, **저장하는 순간의 마찰과 나중에 찾을 때의 비용**입니다.

그래서 두 가지를 목표로 잡았습니다.

- **저장은 0.5초 안에 끝날 것** — 앱을 열거나 폴더를 고르는 단계 없이, 공유 시트를 누르면 끝나야 합니다.
- **찾을 때는 제목·설명·썸네일이 이미 붙어 있을 것** — 사용자가 직접 메모하지 않아도, URL만으로 무엇이었는지 알아볼 수 있어야 합니다.

이 둘은 서로 충돌합니다. 제목과 썸네일을 붙이려면 대상 페이지를 크롤링해야 하고, 그건 느리고 실패할 수 있는 네트워크 작업입니다. LinkU의 설계는 대부분 이 충돌을 어떻게 떼어놓을지에 대한 이야기입니다.

## 사용법

**1. 저장 — 다른 앱의 공유 시트에서 LinkU 선택**

화면이 전환되지 않습니다. "저장 완료" 토스트만 뜨고 사용자는 원래 보던 앱에 그대로 남습니다. 저장 직후 백그라운드에서 메타데이터 수집이 시작되고, 완료되면 홈 화면 카드에 제목·설명·썸네일이 채워집니다.

**2. 직접 입력 — 앱 내 추가 화면**

추가 화면에 들어오면 클립보드를 읽어 URL이면 입력창에 미리 채워 줍니다. 입력값은 `NO_DATE / VALID / INVALID` 세 가지 상태로 실시간 검증되어, 유효한 URL일 때만 저장 버튼이 활성화됩니다.

**3. 찾기 — 검색 · 태그 · 정렬**

검색어는 제목·URL·요약문·태그를 한 번에 훑습니다. 타이핑이 멈춘 뒤 300ms에 한 번만 쿼리가 나가고, 결과는 Paging 3으로 20개씩 로드됩니다. 저장된 태그는 사용 빈도와 함께 집계되어 필터로 쓸 수 있고, 최신순/오래된순 정렬을 조합할 수 있습니다.

**4. 열람 — 앱 내 WebView**

카드를 누르면 앱을 벗어나지 않고 원문을 봅니다. 시스템 뒤로가기는 WebView 히스토리를 먼저 소비한 뒤 화면을 닫습니다. 카드의 더보기 메뉴에서 태그 추가 / URL 복사 / 삭제를 할 수 있습니다.

## 설계

### 저장 경로와 요약 경로를 분리한다

핵심 결정은 하나입니다. **"저장"은 로컬 DB 쓰기 한 번으로 끝내고, "요약"은 별도 작업으로 떼어낸다.**

```
[공유 시트]
   ↓ ACTION_SEND (text/plain)
ShareActivity (투명 테마 · singleTask · excludeFromRecents)
   ↓ Patterns.WEB_URL 로 URL과 제목 분리
LocalRepository.insert()  →  rowId 반환 (여기서 사용자 체감 완료)
   ↓ rowId를 inputData로 실어
WorkManager.enqueue(ShareProcessWorker)
   ↓ (백그라운드, 앱이 죽어도 실행 보장)
ContentSummarizer → Jsoup → og:title / og:description / og:image
   ↓
LocalRepository.updateContents(id, ...)
   ↓ Room이 Flow로 변경 방출
홈 화면 카드 자동 갱신
```

`ShareActivity`는 UI를 전혀 그리지 않습니다. 투명 테마에 `excludeFromRecents`, `finishOnTaskLaunch`, `taskAffinity=""`를 걸어 최근 앱 목록에도 남지 않고, `onCreate`에서 인텐트를 처리하고 곧바로 `finish()`합니다.

공유로 넘어오는 텍스트는 앱마다 형식이 제각각(`"제목 https://..."`, URL만, 제목만)이라 정규식으로 갈라냅니다.

```kotlin
val (url, subject) = intent.getStringExtra(Intent.EXTRA_TEXT)?.run {
    val matcher = Patterns.WEB_URL.matcher(this)
    when (matcher.find()) {
        true -> matcher.group() to matcher.reset().replaceAll("").trim()
        else -> "" to this
    }
} ?: Pair("", "")

val title = intent.getStringExtra(Intent.EXTRA_SUBJECT).orEmpty().ifBlank { subject }
```

요약을 WorkManager에 맡긴 이유는 속도만이 아닙니다. `ShareActivity`는 곧바로 죽는 화면이라 `viewModelScope`에 크롤링을 걸면 프로세스가 정리되는 순간 함께 사라집니다. WorkManager는 그 경계를 넘어 작업을 보장합니다.

### 모듈 구조

```
LinkU
├── app              진입점 — LinkUApp, HomeActivity, ShareActivity
├── common           순수 Kotlin — Clipboard, Intent, URL 검증 확장함수
├── core             ContentSummarizer (Jsoup OG 파싱)
│   ├── core:local   Room — ShareEntity, ShareDao, AppDatabase
│   ├── core:data    LocalRepository, Mapper, ShareData
│   └── core:ui      공통 Composable + 디자인 토큰(Color/Type/Theme)
├── feature          BaseViewModel, ViewEvent
│   ├── feature:home 검색 / 추가 / 상세 / 설정
│   └── feature:share 공유 수신 — ShareViewModel, ShareProcessWorker
└── build-logic      Gradle Convention Plugin
```

의존성은 `app → feature → core → common` 단방향입니다. 화면 계층은 Room 엔티티를 직접 보지 않고, `core:data`가 `ShareEntity`를 `ShareData`로 매핑해 넘깁니다.

모듈이 9개가 되자 각 `build.gradle.kts`에 SDK 버전·Java 17 툴체인·Hilt·KSP·Room·flavor 설정이 그대로 복사되기 시작했습니다. 이걸 Convention Plugin으로 걷어냈습니다.

```kotlin
// 각 라이브러리 모듈의 build.gradle.kts
plugins {
    id("convention.android.library")
}
```

SDK 버전과 앱 버전은 `Const.kt` 한 곳에서만 관리합니다. 버전 코드는 `major * 10000 + minor * 100 + patch` 규칙으로 계산해, 손으로 올리다 생기는 실수를 없앴습니다.

### 검색 파이프라인

검색어와 정렬 옵션 두 상태를 하나의 페이징 스트림으로 합칩니다.

```kotlin
val itemsFlow = combine(_query, _filterOption) { query, filterOption ->
    query to filterOption
}.debounce(300L)                      // 타이핑이 멈춘 뒤에만 질의
    .flatMapLatest { (query, filter) ->  // 새 조건이 오면 이전 스트림 취소
        localRepo.getPagingStream(query, filter == FilterOption.LATEST)
            .map { it.map { data -> SearchListItem.Content(data) as SearchListItem } }
    }
    .cachedIn(viewModelScope)         // 회전 시 페이징 상태 유지
```

정렬은 SQL 한 방으로 처리했습니다. `ORDER BY` 안에서 `CASE WHEN`으로 방향을 갈라, 쿼리 메서드를 두 벌 만들지 않았습니다.

```sql
ORDER BY
    CASE WHEN :isLatest THEN timeStamp END DESC,
    CASE WHEN NOT :isLatest THEN timeStamp END ASC
```

### 요약 실패를 정상 경로로 취급한다

크롤링은 언제든 실패합니다. 로그인이 필요하거나, 봇을 막거나, 그냥 응답이 없습니다. `ContentSummarizer`는 전 구간을 `runCatching` + `withContext(Dispatchers.IO)`로 감싸고, 실패하면 빈 `SummarizeData`를 돌려줍니다. `og:title`이 없으면 `<title>`로, `og:description`이 없으면 `meta[name=description]`으로 단계적으로 물러섭니다.

실패해도 링크 레코드 자체는 이미 저장되어 있으므로 유실되지 않습니다. 요약란만 비어 있을 뿐, 사용자가 저장했다고 믿은 것은 반드시 남습니다.

## 제한 사항

- **JS로 렌더링되는 페이지는 요약되지 않습니다.** Jsoup은 정적 HTML만 파싱하므로, 메타 태그를 클라이언트에서 주입하는 SPA는 제목·썸네일이 비어 나옵니다. 헤드리스 브라우저를 붙일 만한 가치는 아직 없다고 판단했습니다.
- **태그는 공백으로 구분된 단일 문자열 컬럼입니다.** 별도 태그 테이블 없이 `tags` 컬럼에 `"안드로이드 코틀린"` 형태로 저장하고 `split(" ")`으로 나눕니다. 구현은 단순하지만 **공백이 포함된 태그를 만들 수 없고**, 검색이 `LIKE '%...%'`라 부분 일치 오탐이 납니다. 링크 수가 수천 건을 넘기면 정규화가 필요합니다.
- **로컬 전용입니다.** 서버 동기화도 계정도 없습니다. 기기를 바꾸면 데이터는 Android 자동 백업에만 의존합니다.
- **`text/plain` 공유만 받습니다.** 이미지 공유는 초기에 지원했다가 정책적으로 제외했습니다 — 링크 아카이빙이라는 정체성을 흐린다고 봤습니다.
- **Room 스키마는 버전 1이고 마이그레이션 경로가 없습니다.** 컬럼을 추가하려면 지금 시점에 마이그레이션 전략을 먼저 세워야 합니다.
- **자동화된 테스트가 없습니다.** 검증은 수동 QA와 문서 기반 리뷰로 대체했고, 이건 명백한 부채입니다.
- minSdk 26 (Android 8.0)

## 트러블슈팅

### 릴리즈 빌드에서만 터진 `NoClassDefFoundError`

정식 배포 직전, prod release APK에서만 앱이 죽었습니다.

```
java.lang.NoClassDefFoundError: Failed resolution of: Lcom/mj/app/ui/common/StatusBarStyleKt;
```

디버그 빌드는 멀쩡하고 릴리즈만 죽으니 R8이 원인인 건 분명했지만, 문제는 **`-keep` 규칙을 아무리 추가해도 그대로였다**는 점입니다.

원인은 keep 규칙이 아니라 **난독화가 두 번 걸린 것**이었습니다. Convention Plugin에서 라이브러리 모듈에도 `isMinifyEnabled = true`를 설정해 뒀는데, 이러면 라이브러리 모듈이 먼저 자기 클래스를 난독화하고, 그 결과물을 참조하는 app 모듈이 다시 한번 난독화합니다. 최종 바이트코드의 클래스 이름은 app 모듈의 `proguard-rules.pro`에 적힌 원본 이름과 더 이상 일치하지 않으니, keep 규칙이 아무것도 잡아내지 못했던 것입니다.

해결은 규칙을 늘리는 게 아니라 걷어내는 쪽이었습니다.

- **라이브러리 모듈의 `isMinifyEnabled`를 끕니다.** 난독화는 최종 앱 모듈에서 한 번만 수행합니다.
- 라이브러리 단에서 반드시 지켜야 할 규칙이 있다면 `consumer-rules.pro`에 선언해 소비하는 앱 쪽으로 전파시킵니다.
- 확장 함수는 `kotlin.Metadata`가 살아 있어야 런타임에 해석되므로 이것도 keep 대상에 넣었습니다.

```proguard
-keep class kotlin.Metadata { *; }
-keep class com.mj.app.ui.** { *; }
-keepclassmembers class com.mj.app.ui.** { *; }
```

증상이 특정 클래스에서 났다고 해서 원인이 그 클래스에 있는 건 아니라는 걸, 며칠 걸려 배웠습니다.

### WebView가 로딩을 무한히 다시 시작하던 문제

상세 화면은 `AndroidView`로 WebView를 감싸고, `WebChromeClient.onProgressChanged`로 상단 진행 바를 그립니다. 그런데 `loadUrl(url)`을 `update` 블록에 두는 바람에 이런 고리가 생겼습니다.

```
progress 변경 → DetailScreen 리컴포지션 → AndroidView update 재실행
    → loadUrl(url) 재호출 → 로딩 처음부터 → progress 변경 → …
```

`update` 블록은 리컴포지션마다 호출된다는 걸 놓친 결과입니다. 페이지가 영원히 로드되지 않았습니다.

`loadUrl`을 **`factory` 블록으로 옮겨** WebView 생성 시 한 번만 호출하도록 고쳤습니다. `update`는 진짜로 매 프레임 반영이 필요한 것만 남깁니다. 부수효과를 컴포지션 수명주기의 어느 지점에 놓을 것인가 — Compose에서 반복해서 마주치는 질문이고, 이 버그가 그걸 몸으로 알려 줬습니다.

### 온디바이스 NLP를 넣었다가 뺀 이야기

처음에는 본문에서 키워드를 뽑아 태그를 자동 생성하려 했습니다. OpenNLP 영문 모델을 번들하고 품사 태깅으로 명사를 추출하는 것까지 만들어 검증도 마쳤습니다.

그런데 `en-pos-maxent.bin` 하나가 **5.7MB**였습니다. 토크나이저까지 합치면 6MB가 넘고, 이건 앱 전체 용량에서 무시할 수 없는 비중이었습니다. 그 대가로 얻은 건 영문 페이지에서만 동작하는, 그마저도 그리 정확하지 않은 태그였습니다.

지워버렸습니다. 태그는 사용자가 직접 붙이고, 자동 수집은 Open Graph 메타데이터로 한정했습니다. 결과적으로 앱은 6MB 가벼워졌고 코드는 300줄 이상 줄었으며, 태그 품질은 오히려 나아졌습니다 — 사람이 붙인 태그가 기계가 뽑은 명사보다 정확했습니다.

### 광고를 붙였다가 제거하기까지

수익화를 위해 AdMob 네이티브 광고를 검색 리스트에, 배너를 추가 화면에 넣었습니다. 구현하면서 몇 가지를 배웠습니다.

- `NativeAd`는 컴포지션이 떠날 때 `destroy()`를 호출하지 않으면 누수됩니다. `DisposableEffect`가 필요합니다.
- `remember`로 `AdView`를 만들면 회전 시 `AdSize`가 갱신되지 않습니다. 화면 폭을 `remember`의 key로 넘겨야 합니다.
- `MobileAds.initialize()` 완료 전에 광고를 요청하면 첫 로드가 조용히 실패합니다.

메모리 누수를 다 잡고 나서, 리스트 중간에 끼어드는 광고 카드를 다시 봤습니다. LinkU는 "저장한 링크를 빠르게 찾는 앱"인데, 찾는 흐름 한가운데 광고가 있었습니다. 광고 관련 코드 전부(`NativeAdLoader`, 광고 컴포저블, 의존성, Convention Plugin의 AdMob 설정)를 제거하고 v1.00.03으로 배포했습니다.

기능을 더하는 판단보다 걷어내는 판단이 어려웠습니다. 이미 들인 시간이 아까워서입니다. NLP와 광고, 두 번 다 결국 지운 쪽이 맞았습니다.

### 문서 기반 AI 에이전트 워크플로우

후반 작업에서는 Designer / Developer / QA 역할을 나눈 문서 주도 프로세스를 실험했습니다. `DESIGN.md`에 컴포넌트 단위 UI 스펙(색상 토큰, 상태별 UI, 인터랙션)을 먼저 확정하고 → `TASKS.md`로 태스크를 쪼갠 뒤 → 구현하고 → `REVIEW.md`에 CRITICAL / MINOR로 등급을 매겨 리뷰하는 흐름입니다.

위의 WebView 무한 로딩 버그도, 광고 컴포저블의 메모리 누수도 이 리뷰 단계에서 잡혔습니다. 1인 프로젝트에서 가장 부족한 게 "다른 눈"인데, 역할을 분리한 문서가 그 자리를 어느 정도 메워 줬습니다.