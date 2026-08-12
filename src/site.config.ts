export const site = {
  name: '장민종',
  role: 'Android Engineer',
  tagline: '재현되지 않는 결함의 원인을 좁혀 해결하고, 지금 만들지 않을 것을 판단하는 일도 중요하게 생각합니다.',
  // 개별 프로젝트의 수치는 각 프로젝트 페이지에서 말하고,
  // 여기에는 모든 프로젝트에 공통으로 해당하는 것만 둡니다.
  manifest: [
    { key: '방식', value: '기획부터 배포까지 혼자 만듭니다' },
    { key: '배포', value: 'Google Play 2개 · LinkU, 여기주차' },
  ],
  links: [
    { label: 'GitHub', href: 'https://github.com/mjJang94', handle: 'mjJang94' },
    { label: 'Tistory', href: 'https://alswhddl10.tistory.com', handle: 'alswhddl10' },
    { label: 'Email', href: 'mailto:devjjang@naver.com', handle: 'devjjang@naver.com' },
  ],
  kindLabel: {
    product: '앱',
    library: '라이브러리',
    side: '실험',
  } as Record<string, string>,
};
