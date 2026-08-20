---
title: Android OS 정책 대응 및 운영
summary: Android OS 업데이트에 따른 변경사항에 대한 대응 기록
date: ~ 2026-08
topic: 운영
---

## 1. Android OS 버전 대응

### 1-1. 최소지원버전은 "고치는 대신 좁힌다"

2023년 2월, Android 9(Pie)에서 발생하던 크래시를 수정하면서 같은 날 최소지원버전(minSdk)을 Android 10으로 올렸다.   
모든 구형 OS의 개별 크래시를 끝까지 쫓는 대신, 패치 비용이 지원 가치를 넘는 지점에서 지원 범위 자체를 좁힌 것이다.   
이 최소지원버전은 이후 5년째 그대로 유지되고 있다.

### 1-2. OS12 — PendingIntent 가변성 플래그

Android 12는 모든 `PendingIntent`에 `FLAG_MUTABLE` / `FLAG_IMMUTABLE` 명시를 강제했다.   
알람, 위젯, 원격제어 콜백 등 서비스 전역에 흩어진 생성 지점을 전수 조사해야 했고, 한 번은 반영 후 예상치 못한 부작용 때문에 변경사항을 되돌렸다가 원인을 다시 잡아 재적용하는 시행착오도 겪었다.   
OS 정책 대응은 레퍼런스 문서대로 고친다고 한 번에 끝나지 않는다는 걸 체감한 첫 케이스였다.

### 1-3. OS14 — targetSdk 34 적용 6일 만에 롤백

가장 인상 깊었던 실패는 이거였다. targetSdk를 34로 올렸는데, 6일 뒤 원격제어에 쓰던 3rd-party SDK가 34를 지원하지 못한다는 걸 확인하고 앱 전체 targetSdk를 33으로 되돌려야 했다.

```
2024-06-13  targetSdk 34 적용
2024-06-19  3rd-party 라이브러리 targetSdk 34 미지원 확인 → 33으로 롤백
```

이때 배운 건, **OS 대응 캘린더가 회사 코드 기준이 아닌 벤더 SDK 속도로 결정될 수도 있다**는 것이었다.   
이후로는 targetSdk 상향 전에 의존하는 3rd-party SDK의 지원 현황을 먼저 확인하는 걸 체크리스트에 넣었다.

### 1-4. OS15 — edge-to-edge 강제화, knox sdk api의 미지원

`enableEdgeToEdge`가 기본 동작이 되면서 상태바/제스처 영역 패딩이 전 화면에서 깨졌다.   
OS14 이하와 OS15 이상을 분기해서 패딩을 다시 잡아야 했고, 동시에 원격제어 모듈을 OS15 대응 버전으로 교체하면서 더 이상 knox sdk api를 사용하지 못하게 되었다(원격제어 모듈에서 knox sdk api를 사용 했다).   
대응 방안으로 접근성 기능을 사용하게 되었고, 페어링 시점에 접근성 권한 확인 팝업을 새로 추가했다.

### 1-5. OS16 — targetSdk 36, 의도적으로 미룬 부채

2024년 12월 targetSdk 35 적용 후 약 7개월 만인 2026년 7월, 두 앱을 같은 날 targetSdk 36까지 올렸다.   
Predictive back gesture API는 완전 대응 대신 `enableOnBackInvokedCallback=false`로 임시 우회 처리했다.   
근본 대응 없이 릴리즈 일정을 지키기 위한 의도적인 기술 부채였고, 다음 대응 사이클에 남겨뒀다.

---

## 2. Google Play 정책 위반 리스크 판단

보호자가 자녀 단말을 원격 통제한다는 앱의 본질 자체가 Play의 스토커웨어 정책, 가족용 앱 정책과 정면으로 부딪힌다. 실제로 겪은 케이스 위주로 정리한다.

### 2-1. 스토커웨어 정책 — 모니터링 앱 자기 신고

Google Play의 상업용 스파이웨어 정책은 모니터링 앱임을 스토어 측에 명시적으로 신고할 것을 요구한다.   
매니페스트 파일에 `IsMonitoringTool=true` 메타데이터를 선언하고, 강제 업데이트 로직에 심사 모드 예외를 추가했다.

### 2-2. 가족(Families) 정책 — 광고 식별자·접근성 서비스 제거

가족용 앱은 광고 식별자(`AD_ID`) 접근이 금지된다.   
실제로 광고를 사용하지 않음에도 특정 라이브러리에서 어떤 이유에선지 광고 식별자를 가지고 있어서 문제가 되었다.   
따라서 매니페스트에서 `AD_ID` 권한을 제거하는 방식으로 대응했다.

```xml
<!-- app-kiwisenior/src/google/AndroidManifest.xml -->
<uses-permission
    android:name="com.google.android.gms.permission.AD_ID"
    tools:node="remove" />
```

### 2-3. 업데이트 거부 인시던트 — 심사자가 온보딩을 못 넘김

2025년 6월, 업데이트가 리젝됐다. 원인으로 짚은 건 심사 계정이 실단말이 아니어서 Knox 관리자 활성화, 강제 앱 업데이트, 프리로드 테마 선택처럼 **실제 대상 단말에서만 완주 가능한 온보딩 단계**에 머물러 있을 가능성이 있었다.

대응은 기능을 되돌리는 게 아니라, 심사 계정 전용 우회 경로를 넓히는 쪽이었다.

```kotlin
object GooglePolicyHelper {
    val isTestModeEnabled get() = Pref.Kiwi.TEST_MODE_PW.isNotBlank()
}

// 인트로 강제 업데이트 체크
if (GooglePolicyHelper.isTestModeEnabled) return proceed()

// 로그인 - Knox 관리자 활성화 유도
private inner class KnoxActivationScene : Scene {
    override fun process() {
        if (GooglePolicyHelper.isTestModeEnabled) return proceed()
        ...
    }
}
```

이 플래그를 인트로/로그인/홈 진입 분기 곳곳에 심는 작업이 이후 약 6주에 걸쳐 이어졌다.   
`DEVICE_ADMIN` 권한 요청, 걸음수 위젯 노출, 테마 추천 카드 노출 여부까지 이 플래그 하나로 갈렸다.

### 2-4. 원격제어 SDK — 채널에서 아예 들어냄

기능을 숨기는 수준을 넘어, `google` 채널 빌드에서는 3rd-party 원격제어 SDK(알서포트) 관련 로직 자체를 컴파일 대상에서 제거하는 방향으로 정리했다.   
이어서 접근성 서비스 패키지(`RsAccessibilityService`)까지 매니페스트에서 명시적으로 제거해, 정책 스캐너가 접근성 사용 흔적 자체를 찾지 못하도록 했다.   
벤더가 정책 대응 속도를 못 따라올 때, 가장 확실한 리스크 관리 포인트로 **채널별로 의존성 자체를 끊는 것**이었다.

### 2-5. 앱 크기·네이티브 라이브러리 정책

ABI를 `arm64-v8a`/`armeabi-v7a`로 제한해 불필요한 아키텍처를 배포 대상에서 뺐고, 신규 기기의 16KB 메모리 페이지 정렬 요구사항에 맞춰 온디바이스 AI 모델(TFLite, 유해 이미지 감지용) 런타임을 `LiteRT` 기반으로 교체했다.   
이 과정에서 입출력 텐서 버퍼 처리를 고수준 API(`TensorBuffer`) 대신 저수준 `ByteBuffer`로 직접 재작성해야 했다.

---

## 3. 크래시 모니터링: Fatal은 대부분 "정책 변경 신호"였다

Crashlytics에서 잡힌 상위 Fatal의 상당수는 버그가 아니라 OS가 foreground service 규칙을 바꿨다는 신호였다.

- **`ForegroundServiceDidNotStartInTimeException`** — Android 12부터 `startForeground()`를 제때 호출하지 않으면 시스템이 프로세스를 강제 종료한다. 위치·데이터싱크 등 서비스별로 `foregroundServiceType`을 세분화하고, OS 버전에 따라 호출 시그니처를 분기해서 해소했다.

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Noti.AlwaysOn.startForeground(this, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
        Noti.AlwaysOn.startForeground(this)
    }
    ...
}
```

- **`CannotPostForegroundServiceNotificationException`** — 알림 채널 설정이 꼬인 상태에서 foreground 알림을 올리려다 발생. Android 13 런타임 알림 권한 도입 이후 계속 엄격해진 알림 정책선 위에서 재발한 패밀리 이슈였다.
- **`Knox.installApplication` ANR** — 메인 스레드가 Knox SDK의 바인더 트랜잭션 응답을 기다리다 멈추는 패턴. 이런 케이스는 Crashlytics 대시보드에 원인 요약을 커밋 메시지로 남겨, 재발 시 검색으로 바로 찾을 수 있게 관리했다.

원인 조사를 스택트레이스가 아니라 **해당 OS 버전의 릴리즈 노트**에서 먼저 시작하는 습관이 이 시기에 자리 잡았다.

---

## 4. 벤더 SDK 리스크 관리

원격제어 기능은 3rd-party SDK 하나에 계속 발목이 잡혔다.

| 시점 | 이벤트 | 결과 |
| --- | --- | --- |
| 2022-06 | OS12 대응 위해 원격제어 라이브러리 교체 | 부작용으로 1회 Revert 후 재적용 |
| 2024-06-13 | targetSdk 34 적용 | — |
| 2024-06-19 | 알서포트 targetSdk 34 미지원 확인 | 앱 전체 targetSdk 33으로 롤백 |
| 2025-05 | OS15 대응 버전으로 모듈 재교체 | 접근성 권한 확인 팝업 추가 필요 |
| 2025-08~10 | Play 채널 정책 리스크 재평가 | `google` 채널에서 SDK 자체를 제거 |

**판단** — 벤더 SDK는 회사 코드처럼 하루 만에 고칠 수 없다(무엇보다 친절하지 않다). targetSdk·OS 대응 계획을 세울 때 이 SDK의 지원 현황을 별도로 추적하는 항목을 넣었고, 최종적으로는 정책 리스크가 큰 채널(Google)에서는 아예 의존성을 끊는 쪽으로 정리했다.

---

## 5. 운영 규칙 요약

| 구분 | 규칙 |
| --- | --- |
| 채널 분리 | 정책 위험 기능(접근성 서비스, 광고 ID, 원격제어)은 `src/google` 소스셋으로 격리 |
| 검수 대응 | 심사 계정을 코드가 인식하는 플래그(`isTestModeEnabled`)로 강제 권한 요청·필수 온보딩 우회 |
| 최소지원버전 | 패치 비용이 지원 가치를 넘으면 minSdk를 올려 지원 범위를 좁힌다 |
| 벤더 SDK | targetSdk/OS 대응 계획에 벤더 지원 현황 확인을 선행 항목으로 포함 |
| 단말 게이팅 | 서버 `productModel` 문자열 ↔ 코드 enum 1:1 매핑, 미매핑 단말은 최저 등급 폴백 |
| 크래시 대응 | foreground service 계열 Fatal은 OS 릴리즈 노트부터 확인 |
| 검증 빌드 | applicationId·DB가 분리된 `stage` 변형으로 실제 배포 전 별도 설치본 검증 |

---

## 6. 정리

되짚으며 남은 교훈은 세 가지다.

1. **정책 대응은 기능을 지우는 일이 아니라 채널을 나누는 일이다.** 코드에서 기능을 완전히 제거하지 않고 배포 채널 단위로 격리하면, 한쪽 채널의 사용자 경험을 지키면서 다른 채널의 정책 요구를 동시에 만족시킬 수 있었다.
2. **크래시는 원인이 아니라 신호로 읽어야 할 때가 있다.** foreground service 계열 Fatal처럼, 스택트레이스를 파고들기 전에 "이번 OS가 뭘 바꿨는지"부터 확인하는 게 더 빨랐다.
3. **벤더 의존성은 OS 대응 계획의 변수가 아니라 별도 트랙으로 관리해야 한다.** targetSdk를 올리기 전에 회사 코드보다 벤더 SDK의 지원 현황을 먼저 확인하는 습관 하나가, 이후 반복될 수 있었던 롤백을 줄여줬다.
