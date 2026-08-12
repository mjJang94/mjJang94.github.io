export const site = {
  name: '장민종',
  role: 'Android Engineer',
  tagline: '재현되지 않는 결함의 원인을 좁혀 해결하고, 지금 만들지 않을 것을 판단하는 일도 중요하게 생각합니다.',
  
  manifest: [
    { key: '목표', value: '만들고 싶은 서비스를 기획하고 디자인하며 구현하고, 고민거리들을 기록한다.' },
    { key: '배포 현황', value: 'Google Play 2개 · LinkU, 여기주차' },
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

export const formatDate = (date: Date | string) => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
};