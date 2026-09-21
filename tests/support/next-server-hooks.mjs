// Next.js 번들러 밖(node --test)에서 라우트 파일을 불러올 수 있도록
// 확장자 없는 'next/server' 임포트를 실제 파일로 연결한다.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  return nextResolve(specifier, context);
}
