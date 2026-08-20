---
title: Compose 리컴포지션 최적화 적용기
summary: Stable/Immutable, 상태 홀더로의 람다 귀속, State Read Deferral을 실제 화면에 적용한 커밋을 되짚고, Kotlin 2.0.20+ strong skipping 기본 활성화 이후 여전히 남는 것과 자동화된 것을 구분했다
date: 2026-08
topic: 성능
---

원리(Stable/Immutable, State Read Deferral, 람다 안정성)는 별도 글에 정리해뒀으니 여기서는 반복하지 않는다.   
대신 실제로 적용했던 커밋과, Kotlin 2.0.20부터 Compose Compiler에 strong skipping이 기본 활성화된 이후 그 작업들이 지금도 유효한지를 짧게 정리한다.

---

## 1. Stable — 상태 홀더를 스킵 가능한 단위로

Presenter의 `Flow`를 화면에서 바로 구독하지 않고, `remember`로 한 번만 만든 상태 홀더 클래스에 `@Stable`을 붙여 내려보내는 컨벤션을 정착시켰다.

```kotlin
@Stable
internal class AppMonitoringContentState(
    val isAdvancedSupport: Boolean,
    restrictedState: State<RestrictedState?>,
    todayState: State<HistoryState?>,
    weeklyState: State<HistoryState?>,
    val close: () -> Unit,
) {
    val restrictedState by restrictedState
    val todayState by todayState
    val weeklyState by weeklyState
}
```

`@Stable`이 없으면 컴파일러는 이 클래스를 "언제 바뀔지 알 수 없는 타입"으로 취급해, 이 클래스를 파라미터로 받는 하위 Composable을 스킵 후보에서 제외한다.   
`State<T>` 위임 프로퍼티로 실제 변경 지점만 읽기 지점을 좁혀두고, 클래스 자체의 안정성은 어노테이션으로 보증하는 조합이다.

## 2. Immutable — 화면마다 흩어져 있던 `remember(list) { toImmutableList() }` 통합

`List<T>`는 구현체가 가변일 수 있어 컴파일러가 기본적으로 unstable로 추론한다. 처음엔 화면마다 필요할 때마다 `remember(state.items) { persistentListOf(...) }`를 개별적으로 작성했는데, 화면이 늘면서 같은 패턴이 계속 중복됐다. 공통 헬퍼로 한 번에 정리했다.

```kotlin
@Composable
inline fun <reified T> rememberImmutableList(list: Iterable<T>) =
    remember(list) { list.toImmutableList() }
```

```diff
- val themeItems = remember(state.themeItems) { state.themeItems.toImmutableList() }
- ThemeListCard(items = themeItems, ...)
+ ThemeListCard(items = rememberImmutableList(state.themeItems), ...)
```

한 커밋에서 34개 화면의 중복된 `remember + toImmutableList` 호출을 이 헬퍼 하나로 교체했다.   
리스트 파라미터를 받는 Composable이 unstable 판정으로 통째로 스킵 불가 상태가 되는 걸 막는 동시에, "필요할 때마다 각자 remember 작성" 대신 "리스트를 넘길 땐 이 함수" 하나로 컨벤션을 고정한 효과가 더 컸다.

## 3. 람다 안정성 — 콜백을 상태 홀더의 프로퍼티로 귀속

이벤트 콜백을 매 recomposition마다 새 클로저로 만들어 넘기는 대신, 상태 홀더를 만드는 시점에 한 번만 바인딩해 프로퍼티로 노출했다.

```kotlin
@Composable
internal fun rememberAppMonitoringContentState(
    presenter: AppMonitoringPresenter
): AppMonitoringContentState = remember {
    AppMonitoringContentState(
        isAdvancedSupport = presenter.isAdvancedSupport,
        restrictedState = restrictedState,
        todayState = todayState,
        weeklyState = weeklyState,
        close = presenter::close,   // 바인딩은 remember 블록 안에서 한 번만
    )
}
```

하위 Composable은 `state.close`를 참조로 받는다.   
`state` 자체가 `remember`로 고정된 동일 인스턴스인 한, `state.close`의 정체성도 함께 고정된다 — 매번 새 람다를 만들어 내려보내는 방식보다, "람다를 어디서 한 번 만들지"를 상태 홀더 생성 시점으로 못박는 쪽이 관리하기 쉬웠다.

## 4. State Read Deferral — 레이아웃/드로우 단계로 읽기 미루기

인라인으로 매번 새로 만들던 `Modifier` 체인을 모듈 최상위의 `composed { }` 싱글톤으로 뽑아내고, 값이 바뀌어도 재구성 전체가 아니라 그리기 단계만 다시 타면 되는 부분은 `drawWithCache`로 분리했다.

```kotlin
private fun Modifier.body(height: Dp) =
    composed(inspectorInfo = debugInspectorInfo { name = "body" }) {
        val dividerColor = KiwiTheme.Color.Neutral_01
        this.fillMaxWidth().height(height + 1.dp).drawWithCache {
            // 구분선 위치 계산 — 리컴포지션이 아니라 draw 단계에서만 다시 계산
            onDrawWithContent { drawContent(); /* divider draw */ }
        }
    }
```

Modifier 체인을 매 호출마다 새로 조립하지 않고 재사용 가능한 단위로 뽑아두면, 상태가 바뀌었을 때 실제로 다시 계산해야 하는 범위(레이아웃 vs 그리기)를 컴파일러가 아니라 우리가 직접 좁혀줄 수 있었다.

---

## 5. Strong Skipping 기본 활성화 이후, 뭐가 남고 뭐가 자동화됐나

**이 작업들은 대부분 2023년 8~10월, Kotlin 1.8.x 시절에 한 것이다.**.  
이 프로젝트는 2024년 10월 Kotlin 2.0.21로 올라갔고, Compose Compiler의 strong skipping은 Kotlin 2.0.20부터 기본 활성화이므로 지금은 별도 설정 없이 켜져 있다.   
strong skipping은 두 가지를 바꾼다 — unstable 파라미터가 있어도 함수 자체는 스킵 가능해지고(참조 동일성으로 비교), 캡처 값이 stable하기만 하면 람다를 컴파일러가 알아서 `remember`로 감싼다.

| 항목 | strong skipping 이전 | strong skipping 이후 |
| --- | --- | --- |
| `@Stable` 상태 홀더 | 없으면 하위 트리 전체 스킵 불가 | 여전히 유효 — equals 기반 비교로 더 정밀한 스킵 판단을 준다 |
| `ImmutableList` 래핑 | 없으면 리스트 파라미터가 항상 "변경됨" 취급 | 참조 동일성 비교로 스킵은 되지만, 내용이 같은데 인스턴스만 새로 만들어지는 흔한 케이스(Flow emit 등)는 여전히 못 잡는다 → 계속 필요 |
| 콜백을 상태 홀더에 귀속 | 필수 (안 하면 매 recomposition마다 새 람다) | stable 캡처만 있는 람다는 자동 remember됨 → 단순 람다는 효과가 줄었지만, `presenter::close`처럼 메서드 참조나 불안정 캡처가 섞인 경우는 여전히 수동으로 묶어야 함 |
| Modifier 싱글톤화 / `drawWithCache` | 재구성 범위를 직접 좁혀야 함 | 컴파일러 영역 밖이라 그대로 유효 |

결론적으로 **`@Stable`/`ImmutableList`/`drawWithCache` 계열은 strong skipping 이후에도 그대로 남는 최적화**고, **단순 캡처 람다를 일일이 상태 홀더에 옮겨 담던 작업의 상당 부분은 이제 컴파일러가 대신해준다.**
