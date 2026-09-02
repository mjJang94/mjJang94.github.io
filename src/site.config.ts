export const site = {
  name: '장민종',
  role: 'Android Engineer',
  tagline: '재현되지 않는 결함의 원인을 좁혀 해결하고, 지금 만들지 않을 것을 판단하는 일도 중요하게 생각합니다.',
  
  manifest: [
    { key: '목표', value: '만들고 싶은 서비스를 기획하고 디자인하며 구현하고, 고민과 경험을 기록한다.' },
    { key: '배포 현황', value: 'Google Play Store - 링크유, Google Console 내부 테스트 - 또박이, 여기주차, 품앗이' },
  ],
  // id는 버튼 색상·아이콘을 고르는 키입니다. global.css의 .linkbar--<id> 와 짝을 맞춥니다.
  links: [
    { id: 'github', label: 'GitHub', href: 'https://github.com/mjJang94', handle: 'mjJang94' },
    { id: 'tistory', label: 'Tistory', href: 'https://alswhddl10.tistory.com', handle: 'alswhddl10' },
    { id: 'email', label: 'Email', href: 'mailto:devjjang@naver.com', handle: 'devjjang@naver.com' },
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