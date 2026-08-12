---
title: AWS CodeBuild CI/CD
summary: Bitbucket 푸시 → AWS CodeBuild 자동 빌드 → Firebase App Distribution QA 배포 프로세스로 수동 배포 프로세스를 제거하고 QA팀이 항상 최신 빌드를 받을 수 있는 환경을 구성했다.
date: 2026-02
topic: 자동화
projects: [키위플레이+ kids, 키위 패밀리 케어]
---

## 배경 및 목적

기존에는 개발자가 직접 APK를 빌드하고 QA팀에 수동으로 전달하는 방식이었다.
이 과정에서 아래와 같은 문제가 반복되었다.

- 배포 타이밍이 개발자 컨디션에 의존 → QA 대기 시간 발생
- 수동 빌드 중 환경 차이로 인한 "내 로컬에선 됩니다" 이슈
- 배포 누락 또는 잘못된 브랜치 빌드 전달

이를 해결하기 위해 **Bitbucket 특정 브랜치 푸시 → 자동 빌드 → Firebase App Distribution 자동 배포** 파이프라인을 구축했다.

---

## 전체 파이프라인 흐름

```
개발자 push
  └─ Bitbucket (develop_next_qa_deploy 브랜치)
       └─ Webhook
            └─ AWS CodeBuild 트리거
                 ├─ PRE_BUILD  : 공유 라이브러리 선빌드
                 ├─ BUILD      : ViewModel 단위 테스트 실행, 앱 어셈블
                 ├─ POST_BUILD : Firebase CLI 설치 → App Distribution 배포
                 └─ ARTIFACTS  : APK 업로드
                      └─ Firebase App Distribution
                           └─ QA팀 자동 알림 수신
```

---

## CodeBuild 프로젝트 구성

| 항목 | 값 |
| --- | --- |
| 소스 공급자 | Bitbucket |
| 트리거 브랜치 | /develop_next_qa_deploy |
| 빌드 환경 이미지 | alvrme/alpine-android:android-35-jdk17 |
| 환경 유형 | Linux 컨테이너 |
| 컴퓨팅 | 7GB 메모리, vCPU 4개 |
| 제한 시간 | 1시간 |

> **환경 이미지 선택 이유**
AWS 기본 Android 이미지는 JDK 버전 고정 문제가 있어 커뮤니티 유지 이미지인
`alvrme/alpine-android`를 사용했다. Android 35 + JDK 17 조합으로 최신 AGP 요구사항을 충족한다.
> 

---

## buildspec.yml 전체 구성

```yaml
version: 0.2

env:
  variables:
    GRADLE_OPTS: "-Xmx4096m -Dfile.encoding=UTF-8"
    CI: "true"

phases:
  pre_build:
    commands:
      - echo "Pre-building shared libraries..."
      - chmod +x gradlew
      - ./gradlew clean
      - ./gradlew :lib-common:build
                  :lib-common-android:assembleDebug
                  :lib-location:assembleDebug
                  :lib-location-analysis:assembleDebug
      - echo "Libraries pre-build complete!"

  build:
    commands:
      - echo "Running unit tests..."
      - ./gradlew :app-kiwichild:testKiwiStageDebugUnitTest
      - echo "Running build..."
      - ./gradlew :app-kiwichild:assembleKiwiStageDebug

  post_build:
    commands:
      - echo "Installing Firebase CLI..."
      - curl -sL https://firebase.tools | bash
      - echo "Checking Firebase CLI..."
      - if ! command -v firebase &> /dev/null; then
          echo "Firebase CLI not found. Installing...";
          curl -sL https://firebase.tools | bash;
        else
          echo "Firebase CLI already installed.";
        fi
      - echo "Distributing APK to Firebase App Distribution..."
      - firebase appdistribution:distribute
          app-kiwichild/build/outputs/apk/kiwiStage/debug/*.apk
          --app "$FIREBASE_STAGE_APP_ID"
          --token "$FIREBASE_TOKEN"
          --groups "qa팀"
      - echo "Build Complete... Firebase AppDistribution Deployed!"

artifacts:
  files:
    - app-kiwichild/build/outputs/apk/kiwiStage/debug/*.apk
  discard-paths: yes

cache:
  paths:
    - /root/.gradle/caches/**/*
    - /root/.gradle/wrapper/**/*
```

---

## 각 Phase 상세 설명

### PRE_BUILD — 공유 라이브러리 선빌드

멀티 모듈 프로젝트 특성상 `lib-common`, `lib-location` 등 공유 라이브러리를 먼저 빌드한다.
앱 모듈 빌드 전에 의존 모듈이 준비되어야 하기 때문이다.

```bash
./gradlew :lib-common:build \
          :lib-common-android:assembleDebug \
          :lib-location:assembleDebug \
          :lib-location-analysis:assembleDebug
```

`GRADLE_OPTS: "-Xmx4096m"`으로 힙 메모리를 4GB로 고정해
CI 환경(7GB)에서 OOM 없이 안정적으로 빌드되도록 설정했다.

### BUILD — 단위 테스트 + 앱 어셈블

빌드 단계는 **테스트 → 어셈블** 순서로 구성했다.
테스트가 실패하면 어셈블이 실행되지 않아 검증되지 않은 빌드가 QA팀에 전달되는 것을 방지한다.

```bash
# 1. ViewModel 단위 테스트 실행
./gradlew :app-kiwichild:testKiwiStageDebugUnitTest

# 2. 테스트 통과 후 어셈블
./gradlew :app-kiwichild:assembleKiwiStageDebug
```

**테스트 범위**

ViewModel 레이어의 단위 테스트를 작성해 CI 단계에서 자동 검증한다.
예를 들면 검증 항목은 아래와 같다.

- 자녀의 일정 목록 로드 성공 시 `UiState`가 `Success`로 전환되는지
- 자녀의 일정 로드 실패 시 `UiState`가 `Error`로 전환되는지
- 자녀의 일정 생성/수정/삭제 후 상태 갱신이 올바르게 동작하는지

`Coroutines` 기반 ViewModel 테스트는 `MainDispatcherRule`로 테스트 디스패처를 주입해
`runTest` 블록에서 `StateFlow` 상태 변화를 동기적으로 검증할 수 있도록 구성했다.

```kotlin
@OptIn(ExperimentalCoroutinesApi::class)
class ScheduleViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var viewModel: ScheduleViewModel
    private val getScheduleUseCase: GetScheduleUseCase = mockk()

    @Before
    fun setup() {
        viewModel = ScheduleViewModel(getScheduleUseCase)
    }

    @Test
    fun `일정 목록 로드 성공 시 UiState가 Success로 변경된다`() = runTest {
        coEvery { getScheduleUseCase() } returns flowOf(listOf(Schedule(id = 1, title = "숙제 하기")))

        viewModel.loadSchedules()

        assertThat(viewModel.uiState.value).isInstanceOf(ScheduleUiState.Success::class.java)
    }

    @Test
    fun `일정 목록 로드 실패 시 UiState가 Error로 변경된다`() = runTest {
        coEvery { getScheduleUseCase() } throws Exception("네트워크 오류")

        viewModel.loadSchedules()

        assertThat(viewModel.uiState.value).isInstanceOf(ScheduleUiState.Error::class.java)
    }
}
```

> **Flavor 분리 전략**
Play Store 배포용(`kiwiProd`)과 QA 내부 배포용(`kiwiStage`)을 멀티 플레이버로 구분해
단일 코드베이스에서 환경별 APK를 분리 관리한다.
> 

### POST_BUILD — Firebase App Distribution 자동 배포

Firebase CLI를 설치하고 빌드된 APK를 QA팀 그룹(`kiwiplus_qa팀`)에 자동 배포한다.

```bash
firebase appdistribution:distribute *.apk \
  --app "$FIREBASE_STAGE_APP_ID" \
  --token "$FIREBASE_TOKEN" \
  --groups "kiwiplus_qa팀"
```

`FIREBASE_STAGE_APP_ID`, `FIREBASE_TOKEN`은 CodeBuild 환경 변수에 등록해
buildspec에 직접 노출되지 않도록 처리했다.

Firebase CLI는 매 빌드마다 설치하는 대신 `command -v firebase` 체크로
이미 설치된 경우 재설치를 건너뛰는 조건 분기를 추가했다.

### ARTIFACTS + CACHE

```yaml
artifacts:
  files:
    - app-kiwichild/build/outputs/apk/kiwiStage/debug/*.apk
  discard-paths: yes   # 디렉토리 구조 제거, APK 파일만 S3에 업로드

cache:
  paths:
    - /root/.gradle/caches/**/*
    - /root/.gradle/wrapper/**/*
```

Gradle 캐시를 S3에 유지해 매 빌드마다 의존성을 새로 다운로드하는 비용을 줄였다.
실제로 캐시 적용 전후 `DOWNLOAD_SOURCE` + `PRE_BUILD` 시간이 유의미하게 단축됐다.

---

## 빌드 결과

| Phase | 결과 | 소요 시간 |
| --- | --- | --- |
| SUBMITTED | ✅ 성공 | <1 sec |
| QUEUED | ✅ 성공 | 61 secs |
| PROVISIONING | ✅ 성공 | 22 secs |
| DOWNLOAD_SOURCE | ✅ 성공 | 164 secs |
| INSTALL | ✅ 성공 | <1 sec |
| PRE_BUILD | ✅ 성공 | 196 secs |
| BUILD | ✅ 성공 | 492 secs |
| POST_BUILD | ✅ 성공 | 175 secs |
| UPLOAD_ARTIFACTS | ✅ 성공 | 6 secs |
| FINALIZING | ✅ 성공 | 1 sec |
| COMPLETED | ✅ 성공 | — |

**총 빌드 시간: 약 19분**

> BUILD(492s)가 가장 오래 걸리는 구간이다.
Gradle 캐시 적용 이후 반복 빌드에서는 PRE_BUILD + BUILD 구간이 단축된다.
> 

---

## 보안 처리

민감한 값은 buildspec에 직접 기입하지 않고 CodeBuild 환경 변수로 분리했다.

| 환경 변수 | 내용 |
| --- | --- |
| `FIREBASE_STAGE_APP_ID` | Firebase 앱 ID (QA용) |
| `FIREBASE_TOKEN` | Firebase CLI 인증 토큰 |

---

## 개선 효과

| 항목 | 이전 | 이후 |
| --- | --- | --- |
| 배포 방식 | 개발자 수동 빌드 + 전달 | 브랜치 푸시 시 자동 배포 |
| QA팀 대기 시간 | 개발자 여건에 의존 | 푸시 후 ~19분 내 수신 |
| 배포 누락 가능성 | 있음 (사람이 직접 수행) | 없음 (자동화) |
| 환경 일관성 | 로컬 환경마다 상이 | CI 이미지 고정으로 동일 |