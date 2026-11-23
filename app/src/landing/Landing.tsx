import { Button } from '@mantine/core';
import { Link } from 'react-router';
import { useTitle } from '../brand';
import { localePath, storeLang, useLang } from '../lib/i18n';
import { portalSignUpUrl } from '../lib/links';
import { githubUrl, landingStrings, supportEmail } from './strings';
import './landing.css';

/** Text with `code` spans from backticks. */
function Rich({ text }: { text: string }) {
  return <>{text.split('`').map((t, i) => (i % 2 ? <code key={i}>{t}</code> : t))}</>;
}

export function Landing() {
  const [lang] = useLang();
  const s = landingStrings[lang];
  useTitle(s.title);
  const docsHref = localePath(lang, '/docs/what-it-is');
  const demo = () => storeLang(lang);
  return (
    <div className="landing">
      <div className="hero">
        <div>
          <h1>{s.headline}</h1>
          <p className="lead">{s.lead}</p>
          <div className="ctas">
            <Button component="a" href={portalSignUpUrl} size="md" radius="md">{s.signUp}</Button>
            <Button component={Link} to="/app/login" onClick={demo} size="md" radius="md" variant="outline">{s.demo}</Button>
            <Link className="more" to={docsHref}>{s.docs} →</Link>
          </div>
        </div>
        <div className="glass code">
          <pre><code>
            <span className="c">{s.codeComment1}</span>{'\n'}
            <span className="k">POST</span>{' /api/challenges\nx-internal-access-key: ag_…\n{"subjectId":"u_42","purpose":"change-email","factor":"pin"}\n\n'}
            <span className="c">{s.codeComment2}</span>{'\n'}
            <span className="k">POST</span>{' /api/challenges/{id}/verify\n{"pin":"482913"}\n\n'}
            <span className="c">{s.codeComment3}</span>{'\n{"token":"eyJhbGciOiJFUzI1NiIs…","factor":"pin"}'}
          </code></pre>
        </div>
      </div>

      <section>
        <h2>{s.stepsTitle}</h2>
        <p className="sub">{s.stepsSub}</p>
        <div className="cards">
          {s.steps.map((st, i) => (
            <div className="card glass" key={st.title}>
              <span className="num">{i + 1}</span>
              <h3>{st.title}</h3>
              <p><Rich text={st.body} /></p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>{s.featTitle}</h2>
        <p className="sub">{s.featSub}</p>
        <div className="cards">
          {s.feats.map((f) => (
            <div className="card glass" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="band glass">
        <h2>{s.ctaTitle}</h2>
        <p className="sub">{s.ctaSub}</p>
        <div className="ctas center">
          <Button component={Link} to="/app/login" onClick={demo} size="md" radius="md">{s.demo}</Button>
          <Button component="a" href={portalSignUpUrl} size="md" radius="md" variant="outline">{s.signUp}</Button>
        </div>
      </section>

      <footer className="landing-footer">
        <span>AuthGate</span>
        <Link to={docsHref}>{s.footerDocs}</Link>
        <Link to="/app/login" onClick={demo}>{s.footerDemo}</Link>
        <a href={portalSignUpUrl}>{s.footerPortal}</a>
        <a href={githubUrl}>{s.footerGithub}</a>
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </footer>
    </div>
  );
}
