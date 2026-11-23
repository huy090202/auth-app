import { Link } from 'react-router';
import { localePath, useLang } from '../lib/i18n';

/** Placeholder until the real landing page arrives (Task 2). */
export function Landing() {
  const [lang] = useLang();
  return (
    <section>
      <h1>AuthGate</h1>
      <Link to={localePath(lang, '/docs/what-it-is')}>{lang === 'vi' ? 'Đọc tài liệu' : 'Read the docs'}</Link>
    </section>
  );
}
