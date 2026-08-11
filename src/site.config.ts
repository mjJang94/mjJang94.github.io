export const site = {
  name: '장민종',
  role: 'Android Engineer',
  tagline: '재현되지 않는 결함의 원인을 좁혀 해결하고, 지금 만들지 않을 것을 판단하는 일도 중요하게 생각합니다.',
manifest: [
  { key: '안정성', value: '크래시프리 세션 0.0%p 개선 · ANR 발생률 00% 감소' },
  { key: '빌드', value: '증분 빌드 00% 단축 · 클린 빌드 00% 단축' },
  { key: '구조', value: '단일 모듈 → 0개 모듈 전환, 화면 단위 독립 빌드 확보' },
  { key: '릴리스', value: '수동 배포 → CI/CD 자동화, 릴리스 소요 00% 단축' },
  { key: '지금', value: 'Foreground Service 생존성 라이브러리 개발 중' },
],
  links: [
    { label: 'GitHub', href: 'https://github.com/mjJang94', handle: 'mjJang94' },
    { label: 'Tistory', href: 'https://alswhddl10.tistory.com', handle: 'alswhddl10' },
    { label: 'Email', href: 'mailto:devjjang@naver.com', handle: 'devjjang@naver.com' },
  ],
  kindLabel: {
    side: '사이드 프로젝트',
  } as Record<string, string>,
};
