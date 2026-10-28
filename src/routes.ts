export type Route =
  | { name: 'home' }
  | { name: 'roadmap' }
  | { name: 'free' }
  | { name: 'login' }
  | { name: 'play'; id: string };

/** مسیرها با hash هستند تا دکمه Back مرورگر و رفرش صفحه درست کار کنند. */
export const href = {
  home: '#/',
  roadmap: '#/roadmap',
  free: '#/free',
  login: '#/login',
  play: (id: string) => `#/play/${id}`,
};

export function parseRoute(hash: string): Route {
  const [name, id] = hash.replace(/^#\/?/, '').split('/');
  if (name === 'roadmap') return { name: 'roadmap' };
  if (name === 'free') return { name: 'free' };
  if (name === 'login') return { name: 'login' };
  if (name === 'play' && id) return { name: 'play', id };
  return { name: 'home' };
}
