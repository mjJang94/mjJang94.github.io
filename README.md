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
