---
title: TimeFit
summary: 일정을 기록만 하고 끝내지 않도록, 쌓인 일정 데이터를 Gemini로 되짚어주는 Android 캘린더 앱
period: 2026.06 ~ 2026.08
platform: Android
role: 1인 개발 (기획 · 아키텍처 설계 · 구현 전담)
kind: product
current: false
order: 2
stack:
  - MVVM
  - Kotlin
  - Jetpack Compose
  - Navigation Compose
  - Hilt
  - Coroutines
  - Flow
  - Room
  - DataStore Preferences
  - Retrofit
  - Gemini 2.0 Flash Lite
  - WorkManager
  - Jetpack Glance
  - AlarmManager
  - Firebase Crashlytics / Analytics
  - Gradle Convention Plugin
highlights:
  - 14개 Gradle 모듈 멀티모듈 구조를 Convention Plugin으로 통일 — 새 feature 모듈 빌드 파일이 플러그인 3줄로 끝남
  - 주간·월간 일정 데이터를 Gemini에 넘겨 "발견 / 제안" 두 줄 인사이트로 요약, Room 캐싱 + WorkManager 자동 생성
  - Glance 홈 위젯 2종(주간·월간)과 딥링크 계약 — 날짜의 일정이 1건이면 상세로, 0건·2건 이상이면 월간 캘린더로 분기
  - 일간 뷰에서 시간이 겹치는 일정을 열(column)로 나눠 배치하는 커스텀 레이아웃 계산
  - Exact Alarm 스케줄링 + BOOT_COMPLETED 재등록으로 재부팅 후에도 알림 유지
---

## 왜 만들었는가

일정 앱은 이미 넘칠 만큼 많습니다. 그런데 대부분 **기록에서 끝납니다.** 저도 일정을 열심히 넣어두고는, 그 데이터를 다시 들여다본 적이 거의 없었습니다. 한 주가 지나면 "이번 주 뭐 했더라"가 남고, 캘린더를 스크롤해도 점과 블록만 보일 뿐 그게 어떤 패턴이었는지는 알려주지 않습니다.

그래서 **"쌓인 일정을 다시 읽어주는 캘린더"** 를 만들어보기로 했습니다. 사용자가 한 주(월~일) 또는 한 달 동안 등록한 일정 제목과 메모를 모아 Gemini에 넘기고, "이번 기간엔 이런 패턴이 있었어요 / 다음엔 이렇게 해보는 건 어때요" 두 문장으로 돌려받아 홈에 얹는 것이 핵심 아이디어입니다.

동시에 이 프로젝트는 **멀티모듈 아키텍처를 처음부터 끝까지 직접 설계해보는 연습장**이기도 했습니다. 회사 코드베이스는 이미 만들어진 구조 위에 기능을 얹는 일이 대부분이라, 모듈 경계를 어디에 그을지·의존 방향을 어떻게 고정할지·빌드 설정을 어떻게 공통화할지를 처음부터 결정해보고 싶었습니다. 그래서 이 문서도 "무엇을 만들었는가"보다 **"왜 이렇게 나눴고, 어디서 막혔고, 어떻게 풀었는가"** 에 무게를 뒀습니다.

- 개발 기간: 2026년 6월 10일 ~ 7월 8일 (약 4주)
- 개발 인원: 1인 (기획 · 설계 · 구현)
- 최소/타겟 SDK: API 29 (Android 10) / API 36, JVM 17
- 규모: 14개 Gradle 모듈, Kotlin 약 10,000줄
- 버전: 1.0.0

---

## 사용법

### 1. 일정 등록

`+` 버튼으로 일정을 만듭니다. 제목, 시작·종료 시각, 색상(팔레트에서 선택), 반복 유형(없음·매일·매주·매월), 알림 시간, 메모, 사진 여러 장을 붙일 수 있습니다. 알림 시간을 지정하면 그 시각에 맞춰 `AlarmManager`의 정확한 알람이 예약되고, 시간이 되면 알림 채널을 통해 푸시가 옵니다.

### 2. 캘린더 보기

캘린더 탭에서 상단 드롭다운으로 **월간 · 주간 · 일간** 뷰를 전환합니다.

- **월간**: 6×7 그리드에 날짜별 일정 유무를 점으로 표시. 날짜를 탭하면 그날 일정 목록이 열립니다.
- **주간**: 한 주를 가로로 펼쳐 요일별 일정을 보여줍니다.
- **일간**: 시간 축 위에 일정을 블록으로 그립니다. 시간이 겹치는 일정은 자동으로 폭을 나눠 나란히 배치됩니다.

선택한 뷰 타입은 DataStore에 저장돼 다음에 앱을 열어도 유지됩니다.

### 3. 홈 대시보드

앱을 열면 가장 먼저 보이는 화면입니다. 위에서부터 오늘 일정 요약, 이번 주 일정 밀도 히트맵, 가장 임박한 일정 목록, 이번 달 통계, AI 인사이트 진입 카드가 카드 형태로 쌓입니다. 요일에 따라 인사말 문구가 달라집니다(월요일이면 "한 주의 시작이에요", 주말이면 "여유로운 하루 보내세요" 같은 식).

### 4. AI 인사이트

홈의 인사이트 카드를 탭하면 주별 / 월별 탭이 있는 상세 화면으로 들어갑니다. 각 탭에는 해당 기간의 통계(총 일정 수, 가장 바쁜 요일, 여유로운 날 수, 최근 4주 평균 대비 밀도)와 함께 AI가 만든 "발견 / 제안" 두 문장이 표시됩니다.

생성 트리거는 두 갈래입니다.

- **자동**: `WorkManager`가 하루 한 번 점검해서 월요일이면 주간, 매월 1일이면 월간 인사이트를 미리 만들어둡니다. 앱을 열지 않아도 동작합니다.
- **수동**: 상세 화면의 새로고침 버튼으로 즉시 재생성합니다(하루 1회 제한).

새 인사이트가 생성됐는데 아직 안 봤다면 홈 카드에 **NEW 배지**가 붙습니다.

### 5. 홈 화면 위젯

앱을 열지 않고도 일정을 확인할 수 있게 Glance 위젯 두 종류를 제공합니다.

- **주간 위젯**: 이번 주 요일 스트립(오늘은 원형 하이라이트, 일정 있는 날엔 점) + 오늘 일정 리스트
- **월간 위젯**: 이번 달 6×7 그리드. 날짜 셀을 탭하면 그날 일정이 1건일 때는 곧장 일정 상세로, 0건이거나 2건 이상이면 앱의 월간 캘린더로 이동해 해당 날짜가 선택됩니다.

라이트/다크는 `DynamicThemeColorProviders`로 시스템 설정을 그대로 따라갑니다.

### 6. 내 정보

다크 모드 전환, 앱 알림 on/off를 토글로 설정합니다. 알림 토글은 시스템 알림 설정 화면으로 연결되고, 나머지 값은 DataStore에 저장돼 재시작 후에도 유지됩니다.

---

## 설계

### 계층과 데이터 흐름

Clean Architecture 형태의 계층 분리 위에 단방향 상태 흐름을 얹었습니다. UI는 상태만 구독하고, ViewModel에 이벤트를 던지면 ViewModel이 UseCase를 통해 도메인 로직을 실행하고, 결과가 다시 상태로 반영됩니다.

```
Composable (UiState 구독, 이벤트 전달)
      ↕
ViewModel (BaseViewModel<E : UiEvent>)
      ↕
UseCase (Domain)
      ↕
Repository 구현체 (Room / DataStore / Retrofit)
```

화면 상태와 일회성 이벤트(화면 이동, 토스트)를 같은 통로로 흘려보내면 재구독 시 이벤트가 중복 발생합니다. 그래서 공통 `BaseViewModel`에서 **상태는 StateFlow, 이벤트는 Channel**로 통로를 분리했습니다.

```kotlin
abstract class BaseViewModel<E : UiEvent> : ViewModel() {
    private val _event = Channel<E>()
    val event = _event.receiveAsFlow()

    protected fun sendEvent(event: E) {
        viewModelScope.launch { _event.send(event) }
    }
}
```

UseCase는 성격에 따라 세 가지 베이스로 고정했습니다. 실시간 스트림은 `FlowUseCase`, 단발성 호출은 `ParameterizedUseCase`, 파라미터를 받으면서 스트림을 반환하면 `ParameterizedFlowUseCase`입니다. 매번 새 인터페이스를 정의하지 않고 이 세 틀 안에서만 기능을 추가하니, 나중에 코드를 다시 열었을 때 어디를 봐야 하는지가 눈에 익었습니다. 디스패처는 `DispatcherQualifier`로 주입받아 UseCase 레벨에서 스레드를 결정합니다.

### 모듈 구조

```
TimeFit/
├── app/                    앱 진입점, NavHost, DI 그래프 조립, 위젯 딥링크 수신
├── build-logic/convention/ 커스텀 Gradle Convention Plugin
├── common/                 순수 Kotlin 유틸 (시간 변환, Gson)
├── common-android/         Compose 공통 컴포넌트, 테마, BaseViewModel
├── domain/                 도메인 모델, Repository 인터페이스, UseCase
├── core/
│   ├── data/               Room, DataStore, Gemini Retrofit 클라이언트, Repository 구현체
│   ├── alarm/              AlarmManager 스케줄링, 재부팅 복구
│   └── notification/       알림 채널, NotificationManager 래핑
└── feature/
    ├── splash/             첫 진입 화면
    ├── home/               홈 탭 컨테이너 (대시보드 · 캘린더 · 내 정보 · 인사이트 상세)
    ├── schedule/           일정 생성 · 상세 · 수정
    └── widget/             홈 스크린 위젯 (Glance)
```

의존 방향은 `feature/* → domain ← core/data`, `feature/* → common-android → common`으로 단순하게 고정했습니다. **feature 모듈끼리는 서로 참조하지 않고**, 전체 그래프를 엮는 건 `app` 모듈 하나만 합니다. 예외적으로 `feature/schedule`이 `feature/widget`의 `RefreshCalendarWidgetUseCase`를 쓰는데(일정을 저장하면 위젯을 갱신해야 하므로), 이건 규칙을 깬 지점이라 알고 있습니다. UseCase를 domain으로 올리고 위젯 갱신을 인터페이스 뒤로 숨기는 게 맞는 정리 방향입니다.

### Convention Plugin으로 빌드 설정 통일

모듈이 늘면서 `build.gradle.kts`마다 `compileSdk`, `minSdk`, Compose 컴파일러 옵션, Hilt 의존성을 반복해서 적는 게 거슬렸습니다. `convention.android.library`, `convention.android.compose`, `convention.android.hilt` 세 플러그인으로 쪼개 조합하도록 만들었고, SDK·버전·JVM 타깃은 `Const` 한 곳에서만 관리합니다. 결과적으로 새 feature 모듈의 빌드 파일은 이렇게 끝납니다.

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

의존성 버전은 Gradle Version Catalog(`libs.versions.toml`)에서 bundle 단위(`bundles.compose`, `bundles.room`, `bundles.remote` 등)로 묶어 관리합니다.

### 데이터

- **Room**: `ScheduleInfoEntity`(일정), `InsightEntity`(생성된 인사이트). 사진 URI 리스트나 enum은 `Converters`로 직렬화합니다.
- **DataStore Preferences**: `AccountPref`(온보딩 여부 등), `CalendarPref`(뷰 타입, 다크 모드, 알림 on/off), `InsightPref`(주간·월간 마지막 생성 시각 / 마지막 열람 시각). `Preference` 래퍼로 `get()`·`set()`·`asFlow()`를 통일했습니다.
- **Gemini**: Retrofit + OkHttp. API 키는 `local.properties` → `BuildConfig`로 주입해 저장소에 올라가지 않게 했습니다.

### 인사이트 생성 파이프라인

```
WorkManager (1일 주기)  ─┐
                         ├→ InsightRepository.generateInsight(type)
새로고침 버튼 (수동)     ─┘        │
                                   ├→ 기간 계산 (주: 월~일 / 월: 1일~말일)
                                   ├→ 해당 기간 일정 수집 → "제목: 메모" 리스트
                                   ├→ 프롬프트 조립 → Gemini 2.0 Flash Lite
                                   ├→ "발견: / 제안:" 정규식 파싱
                                   └→ Room 저장 + 마지막 생성 시각 갱신
```

홈 화면은 Room을 Flow로 구독하고 있어서, 워커가 백그라운드에서 저장하면 화면이 알아서 갱신됩니다.

### 알림

일정 저장 시 `startTime - reminder분` 시점에 `setExactAndAllowWhileIdle`로 알람을 겁니다. Android 12+에서 정확한 알람 권한이 없으면 `setAndAllowWhileIdle`로 폴백합니다. 일정을 수정하면 기존 알람을 취소하고 재등록, 삭제하면 같이 취소합니다. Exact Alarm은 재부팅 시 시스템이 전부 날려버리므로, `BootReceiver`가 `BOOT_COMPLETED`를 받으면 Room의 미래 일정을 전부 조회해 다시 겁니다.

---

## 제한 사항

솔직하게 남겨둡니다. 이 앱이 **아직 하지 못하는 것**들입니다.

**스토어 미배포, 완전 로컬 앱입니다.** 서버도 계정도 없어서 기기 간 동기화나 백업이 안 됩니다. 기기를 바꾸면 데이터를 옮길 방법이 없습니다. 이 구조에서 다음 단계는 계정 없이도 되는 파일 내보내기/가져오기(.ics)라고 보고 있습니다.

**반복 일정은 "라벨"까지만 구현됐습니다.** 없음·매일·매주·매월을 선택해 저장하고 상세 화면에 표시하지만, 실제로 반복 인스턴스를 전개해서 캘린더에 그리거나 반복 알람을 거는 로직은 없습니다. 반복 종료 조건·예외 날짜(특정 회차만 삭제)까지 제대로 하려면 도메인 모델을 다시 설계해야 해서, 이번 범위에서는 의도적으로 미뤘습니다.

**Gemini API 키가 클라이언트에 들어 있습니다.** `local.properties` → `BuildConfig` 방식이라 저장소에는 올라가지 않지만, APK를 뜯으면 나옵니다. 개인 프로젝트라 감수했고, 실제 배포한다면 키를 들고 있는 프록시 서버를 반드시 앞에 둬야 합니다.

**테스트 코드가 없습니다.** 4주 동안 기능 구현에만 집중했습니다. 가장 먼저 테스트를 붙여야 할 곳은 순수 로직이 몰려 있는 `InsightStatsCalculator`(주/월 통계, 최근 4주 baseline 평균)와 겹침 일정 열 계산, 그리고 인사이트 응답 파싱 정규식입니다.

**빈 껍데기 모듈이 남아 있습니다.** `feature/insight`, `feature/category`, `feature/settings`는 `settings.gradle.kts`에 등록만 되어 있고 소스가 없습니다. 처음엔 인사이트·카테고리·설정을 각각 독립 모듈로 분리할 생각이었는데, 실제로 만들다 보니 설정은 "내 정보" 탭 안에 토글 두 개면 충분했고, 인사이트 화면도 홈 대시보드와 상태를 공유하는 편이 자연스러워서 `feature/home` 안에 남았습니다. **모듈을 기능 계획 단계에서 미리 쪼개둔 게 성급했다**는 게 이번에 얻은 교훈입니다.

**온보딩 화면은 코드만 있고 연결되어 있지 않습니다.** `feature/onboarding`과 `feature/calendar`는 디렉터리에 소스가 남아 있지만 `settings.gradle.kts`에 포함되지 않아 빌드에서 제외된 상태입니다. 캘린더는 홈 탭 안으로 흡수됐고, 온보딩은 첫 실행 경험을 다시 다듬을 때 붙일 예정입니다.

**인사이트 하루 1회 제한이 UI 레이어에만 있습니다.** `HomeViewModel`이 `InsightPref`의 마지막 생성 시각을 보고 새로고침을 막지만, `InsightRepository.generateInsight()` 자체에는 호출 제한이 없습니다. 지금은 진입 경로가 두 개뿐이라 문제가 없지만, 가드는 리포지토리로 내려가는 게 맞습니다.

---

## 트러블슈팅

### 1. 겹치는 일정이 서로를 가리는 문제

일간 뷰에서 10:00~11:00 일정과 10:30~11:30 일정을 그냥 그리면 뒤에 그려진 블록이 앞을 덮어버립니다.

시간이 겹치는 일정들을 그룹으로 묶고, 그룹 안에서 각 일정에 **열 인덱스(`colIndex`)와 전체 열 개수(`colTotal`)** 를 부여한 뒤, 컨테이너 폭을 `colTotal`로 나눠 배치하는 방식으로 풀었습니다. 블록 높이는 `시작 시각 offset`과 `지속 시간`을 시간 단위 높이(`hourHeight`)에 곱해 계산하고, 30분보다 짧은 일정도 탭할 수 있도록 최소 높이 30dp를 보장했습니다.

```kotlin
val width = containerWidth / colTotal
ScheduleBlockLayout(
    topOffset = hourHeight * (startMinutes / 60f),
    blockHeight = maxOf(hourHeight * (durationMinutes / 60f), 30.dp),
    width = width,
    xOffset = width * colIndex,
)
```

3~4개가 동시에 겹치는 극단적인 케이스까지 넣어보면서 다듬었습니다.

### 2. Glance 위젯에 DI를 주입할 수 없었다

`GlanceAppWidget`은 Activity·Service 같은 일반 Android 컴포넌트가 아니라서 `@AndroidEntryPoint`로 주입을 받을 수 없습니다. 위젯이 일정 데이터를 읽어야 하는데 `ScheduleRepository`를 꺼낼 방법이 없었습니다.

위젯 자체는 상태(Glance Preferences)만 그리게 두고, **데이터 조회는 워커가 담당**하도록 역할을 나눴습니다. 워커에서 `@EntryPoint` 인터페이스를 정의하고 `EntryPointAccessors.fromApplication()`으로 Application 컴포넌트에서 직접 Repository를 꺼내 쓴 뒤, 결과를 `updateAppWidgetState`로 밀어 넣고 위젯을 갱신합니다.

```kotlin
@EntryPoint
@InstallIn(SingletonComponent::class)
interface CalendarWidgetEntryPoint {
    fun scheduleRepository(): ScheduleRepository
}
```

같은 패턴을 나중에 `InsightGenerationWorker`에도 그대로 재사용했습니다.

### 3. 인사이트 생성이 "홈 화면을 열어야만" 시작되던 문제

처음엔 `HomeViewModel.init { checkAndGenerateInsights() }`로 자동 생성을 트리거했습니다. 그런데 이러면 사용자가 홈 탭에 들어와야만 생성이 시작되고, 인사이트를 보러 들어간 순간 로딩을 기다려야 합니다. "미리 만들어두고 보여준다"는 원래 의도와 정반대였습니다.

위젯 갱신에서 이미 쓰고 있던 워커 패턴을 그대로 가져와 `InsightGenerationWorker`로 분리하고, `TimefitApp.onCreate()`에서 `enqueueUniquePeriodicWork`(1일 주기, `ExistingPeriodicWorkPolicy.KEEP`)로 등록했습니다. 워커는 매일 실행되면서 **월요일이면 주간 / 매월 1일이면 월간**을 생성하고, 기존 데이터가 아예 없으면 요일과 무관하게 한 번 만듭니다. ViewModel에서 생성 로직이 빠지면서 홈 화면은 Room을 구독만 하는 단순한 형태가 됐습니다.

### 4. LLM 응답 파싱이 매번 깨졌다

처음엔 프롬프트를 자유 형식으로 두고 응답을 그대로 보여줬는데, 어떤 날은 마크다운 불릿으로 오고 어떤 날은 서론을 길게 붙여서 오는 등 형태가 계속 달라졌습니다. UI는 "발견"과 "제안" 두 영역으로 나눠 그려야 하는데 파싱이 성립하지 않았습니다.

**출력 포맷을 프롬프트에서 강제**하는 쪽으로 방향을 바꿨습니다. "다른 텍스트 없이 정확히 두 줄로만 응답하세요"라고 못 박고 `발견: <...>` / `제안: <...>` 템플릿을 제시한 뒤, 정규식으로 파싱합니다. 콜론이 전각(`：`)으로 오는 경우, 문장이 여러 줄로 넘어가는 경우까지 커버하도록 `DOT_MATCHES_ALL`을 걸었고, 그래도 파싱이 실패하면 전체 텍스트를 "발견"에 넣는 폴백을 뒀습니다.

```kotlin
Regex("발견\\s*[:：]\\s*(.+?)(?=\\n?제안\\s*[:：]|$)", RegexOption.DOT_MATCHES_ALL)
```

작업하다 뒤늦게 깨달은 건 **일정 제목과 메모에 실제 장소명이나 사람 이름이 들어간다**는 점이었습니다. 그 데이터가 그대로 LLM에 올라가고 응답에 다시 등장할 수 있어서, 프롬프트에 "개인정보(장소명, 사람 이름 등)는 언급하지 마세요"를 명시적으로 넣었습니다.

### 5. 위젯 날짜를 탭했을 때 어디로 보낼 것인가

월간 위젯에서 날짜를 누르면 앱이 열리는데, 처음엔 무조건 앱만 실행됐습니다. 사용자가 위젯에서 날짜를 누르는 의도는 "그날 뭐 있는지 보고 싶다"인데, 앱 홈으로 던져놓으면 다시 캘린더 탭 → 그 달 → 그 날짜를 찾아 들어가야 했습니다.

**그날 일정 개수에 따라 목적지를 나누는** 딥링크 계약을 만들었습니다. 일정이 정확히 1건이면 곧장 일정 상세로, 0건이거나 2건 이상이면 월간 캘린더로 이동시키고 해당 날짜를 선택된 상태로 만듭니다. 여기서 두 가지가 걸렸습니다.

- **콜드 스타트 타이밍**: 앱이 꺼진 상태에서 위젯을 누르면 스플래시가 먼저 뜨는데, 그 시점에 곧바로 `navigate`를 호출하면 백스택이 꼬입니다. 스플래시를 지나 홈이 백스택 루트로 들어올 때까지 `currentBackStackEntryFlow`를 구독해 기다린 뒤 이동하도록 처리했습니다.
- **인텐트 재소비**: 화면 회전 같은 구성 변경으로 같은 인텐트를 다시 읽으면 딥링크가 재실행됩니다. extra를 읽는 즉시 `removeExtra`로 소비하고, `MutableStateFlow`에 담아 화면이 처리한 뒤 null로 비우는 방식으로 막았습니다.

날짜 셀마다 `PendingIntent`가 구분되도록 `timefit://widget/date/$epochDay` 형태의 고유 data URI도 부여했습니다. 이걸 빼먹으면 시스템이 PendingIntent를 같은 것으로 판단해 모든 날짜가 같은 곳으로 이동합니다.

### 6. 구독 모델을 만들다가 접었다

초기엔 인사이트를 프리미엄 기능으로 두고 FREE/PREMIUM을 나누는 구조까지 설계했습니다(`SubscriptionRepository`, `InsightLoadState.Locked` 등). 그런데 결제 연동을 실제로 붙이기 전까지는 **잠긴 UI만 존재하는 상태**가 되고, 개인 프로젝트에서 결제 심사·환불 처리까지 감당하는 건 배보다 배꼽이 커지는 일이었습니다.

전면 무료로 전환하면서 관련 코드를 도메인 레이어까지 전부 걷어냈습니다. "나중을 위해 인터페이스만 남겨둘까" 고민했지만, 쓰이지 않는 추상화는 읽는 사람을 헷갈리게 할 뿐이라 판단해 지웠습니다. 계층이 잘 분리되어 있으면 나중에 다시 넣는 비용도 크지 않습니다 — 실제로 걷어낼 때 손댄 곳이 도메인 인터페이스와 ViewModel 상태 분기 정도였고, UI 컴포넌트나 데이터 레이어는 거의 건드리지 않았습니다. **모듈을 미리 쪼개둔 건 성급했지만 계층을 나눠둔 건 값을 했다**는 게 이 프로젝트의 요약입니다.


### 7. 이 앱은 배포하지 않기로 했다

Gemeni API를 통해 일정에 대한 인사이트를 제공하다 보니, 만약 사용자가 늘게 될 경우 사용량 감당이 힘들어질 것 같아 개인적으로 쓰기로 했다.