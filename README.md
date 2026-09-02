## 매번 반복하는 작업 흐름

### 1. 작업 시작 전 — 최신 내용 받기

```bash
git pull
```

다른 PC에서 수정한 내용이 있을 수 있으므로 편집 전에 항상 먼저 실행합니다. 이것을 건너뛰면 나중에 push가 거부됩니다.

### 2. 내용 수정

- 프로젝트 글 추가/수정: `src/content/projects/*.md`
- 프로필, 링크, 요약 지표: `src/site.config.ts`
- 색상, 폰트, 간격: `src/styles/global.css`

### 2-1. 이미지 · 동영상 첨부

**이미지**는 문서 옆 `images/` 폴더에 넣고 상대 경로로 씁니다. Astro가 자동으로 webp 변환·리사이즈·`width`/`height` 지정까지 처리합니다.

```
src/content/projects/images/여기주차-홈.png
src/content/experience/images/빌드로직-구조.png
```

```markdown
![주차 위치 기록 화면](./images/여기주차-홈.png)
```

설명을 붙이려면 `<figure>`로 감싸되, **HTML 태그와 이미지 사이에 빈 줄을 넣습니다.** 빈 줄이 없으면 마크다운으로 해석되지 않습니다.

```markdown
<figure class="portrait">

![주차 위치 기록 화면](./images/여기주차-홈.png)

<figcaption>하차가 감지되면 위치와 사진이 자동으로 남습니다</figcaption>
</figure>
```

> 이미지 최적화는 `![](...)` 문법에만 적용됩니다. `<img src="./images/...">`처럼 HTML 태그에 상대 경로를 쓰면 경로가 변환되지 않아 깨집니다. HTML 태그로 이미지를 넣어야 한다면 파일을 `public/media/`에 두고 `/media/...` 절대 경로를 씁니다.

**동영상**은 최적화 대상이 아니므로 `public/media/`에 넣고 `/media/...` 절대 경로로 씁니다.

```markdown
<figure class="portrait">
  <video src="/media/여기주차-데모.mp4" controls playsinline muted loop preload="metadata"></video>
  <figcaption>블루투스 해제 후 자동 기록되는 흐름</figcaption>
</figure>
```

용량이 큰 영상(10MB 이상)은 저장소에 올리기보다 YouTube에 올려 임베드하는 편이 낫습니다.

```markdown
<div class="embed">
  <iframe src="https://www.youtube.com/embed/영상ID" title="여기주차 데모" allowfullscreen loading="lazy"></iframe>
</div>
```

쓸 수 있는 클래스는 세 가지입니다.

| 클래스 | 용도 |
| --- | --- |
| `portrait` | 세로 스크린샷·영상의 폭을 300px로 제한 |
| `shots` | 스크린샷 여러 장을 나란히 배치 |
| `embed` | YouTube 등 외부 iframe을 16:9로 고정 |

```markdown
<div class="shots">

![홈](./images/여기주차-01.png)
![차 찾기](./images/여기주차-02.png)
![서류함](./images/여기주차-03.png)

</div>
```

### 3. 올리기 전 확인

```bash
npm run build
```

`Complete!`가 출력되면 안전한 상태입니다. 에러가 나면 그 상태로 push해도 배포가 실패하므로 먼저 고칩니다.

### 4. 커밋 후 푸시

```bash
git add .
git commit -m "무엇을 바꿨는지 한 줄"
git push
```

푸시 후 1~2분이면 사이트에 반영됩니다. 진행 상황은 저장소 Actions 탭에서 확인합니다.
