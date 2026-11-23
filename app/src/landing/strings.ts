import type { Lang } from '../lib/i18n';

export const githubUrl = 'https://github.com/huy090202/auth-gate';
export const supportEmail = 'support@authgatehq.com';

export type LandingStrings = {
  /** Page title for the head (Task 3). */
  title: string;
  /** Meta description, at most 160 characters. */
  description: string;
  headline: string;
  lead: string;
  signUp: string;
  demo: string;
  docs: string;
  codeComment1: string;
  codeComment2: string;
  codeComment3: string;
  stepsTitle: string;
  stepsSub: string;
  steps: { title: string; body: string }[];
  featTitle: string;
  featSub: string;
  feats: { title: string; body: string }[];
  ctaTitle: string;
  ctaSub: string;
  footerPortal: string;
  footerGithub: string;
  footerDemo: string;
  footerDocs: string;
};

export const landingStrings: Record<Lang, LandingStrings> = {
  en: {
    title: 'AuthGate · A second factor for any backend',
    description:
      'AuthGate checks a PIN or a passkey for your users. Your backend opens a challenge and gets a short-lived signed token to verify. Docs, code and a live demo.',
    headline: 'A second factor for any backend',
    lead: 'Ask for a PIN or a passkey before a sensitive action. Your backend calls AuthGate, the user answers, and you get a short-lived signed token that you verify yourself.',
    signUp: 'Sign up on the Portal',
    demo: 'Try the demo',
    docs: 'Read the docs',
    codeComment1: '# your backend, before "change email"',
    codeComment2: '# the user types the PIN; you relay it',
    codeComment3: '# → a token you check against the public keys',
    stepsTitle: 'How a step-up works',
    stepsSub: 'Three calls. The browser only ever talks to your backend.',
    steps: [
      { title: 'Open a challenge', body: 'Your backend names the user, the action it is about to allow, and the factor. For a passkey, AuthGate returns the WebAuthn options.' },
      { title: 'The user answers', body: 'Your page collects the PIN or runs the passkey ceremony, and your backend passes the answer on.' },
      { title: 'Check the token', body: 'Verify the signature against the public keys, then aud, exp and purpose. A token for one action never unlocks another.' },
    ],
    featTitle: "What you don't have to build",
    featSub: 'The parts of 2FA that are easy to get wrong.',
    feats: [
      { title: 'PINs', body: 'Hashed storage, a length policy, trivial PINs refused, and a lockout after repeated failures.' },
      { title: 'Passkeys', body: 'WebAuthn options for the browser, and verification of the answer, including the rpId and origin.' },
      { title: 'Signed tokens', body: 'ES256 JWTs, 5 minutes by default and 15 at most. Verify them with the public key set.' },
      { title: 'Single-use challenges', body: 'Valid for five minutes and visible only to your client.' },
      { title: 'Keys and limits', body: 'Rotate a client key with a 24-hour grace, end it early, and a rate limit per client.' },
      { title: 'Self-service', body: 'Sign up, confirm your email, enrol a second factor and create your client on the Portal.' },
    ],
    ctaTitle: 'Try it in five minutes',
    ctaSub: 'Register a demo account, set a PIN, and watch every call the demo makes.',
    footerPortal: 'Portal',
    footerGithub: 'Source on GitHub',
    footerDemo: 'Demo',
    footerDocs: 'Docs',
  },
  vi: {
    title: 'AuthGate · Yếu tố xác thực thứ hai cho mọi backend',
    description:
      'AuthGate kiểm tra PIN hoặc passkey cho user của bạn. Backend mở challenge và nhận token ký sẵn, sống ngắn để verify. Có tài liệu, code mẫu và demo chạy thật.',
    headline: 'Yếu tố xác thực thứ hai cho mọi backend',
    lead: 'Hỏi PIN hoặc passkey trước một thao tác nhạy cảm. Backend của bạn gọi AuthGate, user trả lời, và bạn nhận về một token ký sẵn, sống ngắn để tự verify.',
    signUp: 'Đăng ký trên Portal',
    demo: 'Chạy thử demo',
    docs: 'Đọc tài liệu',
    codeComment1: '# backend của bạn, trước khi "đổi email"',
    codeComment2: '# user nhập PIN, bạn chuyển tiếp sang',
    codeComment3: '# → một token để bạn kiểm tra bằng public key',
    stepsTitle: 'Step-up chạy thế nào',
    stepsSub: 'Ba lần gọi. Browser chỉ nói chuyện với backend của bạn.',
    steps: [
      { title: 'Mở challenge', body: 'Backend nêu user nào, thao tác sắp cho phép là gì và dùng yếu tố nào. Với passkey, AuthGate trả về WebAuthn options.' },
      { title: 'User trả lời', body: 'Trang của bạn nhận PIN hoặc chạy bước passkey, rồi backend chuyển câu trả lời sang AuthGate.' },
      { title: 'Kiểm tra token', body: 'Verify chữ ký bằng public key, rồi kiểm tra aud, exp và purpose. Token của thao tác này không mở được thao tác khác.' },
    ],
    featTitle: 'Những việc bạn không phải tự làm',
    featSub: 'Những phần của 2FA rất dễ làm sai.',
    feats: [
      { title: 'PIN', body: 'Lưu dạng hash, có policy về độ dài, từ chối PIN quá dễ đoán, và khoá sau nhiều lần nhập sai.' },
      { title: 'Passkey', body: 'Tạo WebAuthn options cho browser và verify kết quả trả về, gồm cả rpId và origin.' },
      { title: 'Token ký sẵn', body: 'JWT ký ES256, mặc định sống 5 phút, tối đa 15 phút. Verify bằng bộ public key.' },
      { title: 'Challenge dùng một lần', body: 'Sống năm phút và chỉ client của bạn mới thấy.' },
      { title: 'Key và giới hạn', body: 'Xoay key của client với 24 giờ chuyển tiếp, thu hồi sớm khi cần, và có rate limit cho từng client.' },
      { title: 'Tự phục vụ', body: 'Đăng ký, xác nhận email, thêm yếu tố thứ hai và tạo client ngay trên Portal.' },
    ],
    ctaTitle: 'Thử trong năm phút',
    ctaSub: 'Tạo một tài khoản demo, đặt PIN và xem từng call mà demo gửi đi.',
    footerPortal: 'Portal',
    footerGithub: 'Mã nguồn trên GitHub',
    footerDemo: 'Demo',
    footerDocs: 'Tài liệu',
  },
};

export const { title, description } = landingStrings.en;
