# 포트폴리오 사이트

Astro 기반 정적 포트폴리오입니다. 마크다운 파일을 추가하면 목록과 상세 페이지가 자동으로 생성되고, main 브랜치에 푸시하면 GitHub Pages로 배포됩니다.

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ 생성
npm run preview  # 빌드 결과 확인
```

## 최초 설정 (3분)

1. GitHub에 public 저장소를 만듭니다.
   - 저장소 이름을 `mjJang94.github.io`로 하면 주소가 `https://mjJang94.github.io`가 되고 추가 설정이 없습니다.
   - 다른 이름으로 만들 경우 `astro.config.mjs`의 `base` 주석을 해제하고 저장소 이름을 넣습니다.
2. `astro.config.mjs`의 `site` 값을 실제 주소로 수정합니다.
3. `src/site.config.ts`에서 이름, 소개, 링크, 이메일을 수정합니다.
4. 이 폴더를 그대로 커밋하고 main 브랜치에 푸시합니다.
5. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 변경합니다.
6. Actions 탭에서 워크플로가 초록색이 되면 배포 완료입니다.

`public/robots.txt`의 사이트 주소도 함께 바꿔 주세요.

## 프로젝트 글 추가

`src/content/projects/` 아래에 `.md` 파일을 하나 만들면 됩니다. 파일 이름이 그대로 URL이 됩니다.

```markdown
---
title: 프로젝트 이름
summary: 한 줄 요약. 목록과 검색 결과에 노출됩니다.
period: 2024.03 — 2025.01
platform: Android
role: 담당 역할
kind: product        # product | library | side
current: false       # true면 목록에 진행 중 표시
order: 4             # 숫자가 작을수록 위에 노출
stack: [Kotlin, Compose]
highlights:
  - 성과 한 줄
repo: https://github.com/mjJang94/example
store: https://play.google.com/store/apps/details?id=example
draft: false         # true면 빌드에서 제외
---

## 배경

본문을 마크다운으로 씁니다.
```

프론트매터 규격은 `src/content.config.ts`에 Zod 스키마로 정의되어 있습니다. 필수 필드가 빠지면 빌드가 실패하므로 잘못된 글이 배포되지 않습니다.

필수 필드는 `title`, `summary`, `period` 세 개이고 나머지는 기본값이 있습니다.

## 이미지

`public/images/` 아래에 두고 절대경로로 참조합니다.

```markdown
![메인 화면](/images/timefit/main.png)
```

상대경로는 상세 페이지 URL 깊이 때문에 깨지므로 사용하지 마세요.

## 커스텀 도메인

`public/CNAME` 파일을 만들어 도메인 한 줄만 적고, DNS에 CNAME 레코드를 `mjJang94.github.io`로 등록합니다.

## 디자인 수정

색상, 폰트, 간격은 모두 `src/styles/global.css` 상단의 CSS 변수에 모여 있습니다. `--cobalt` 값 하나만 바꿔도 사이트 전체 강조색이 바뀝니다.

## 주의

public 저장소이므로 사내 API 주소, 서버 도메인, 스크린샷 속 실데이터는 반드시 제거하고 커밋해야 합니다. 커밋 히스토리에도 남습니다.
