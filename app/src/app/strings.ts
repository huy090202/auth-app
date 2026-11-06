import { useLang, type Lang } from '../lib/i18n';

/**
 * Every user-visible string of the demo screens, one object per language.
 * `vi` is typed as `Strings`, so a missing or mistyped key fails typecheck.
 * Interpolated strings are functions. Product names (AuthGate, auth-gate) stay as is.
 */
const en = {
  locale: 'en',

  // Navigation and titles
  navLabel: 'Account',
  navHome: 'Home',
  navSecurity: 'Security',
  signOut: 'Sign out',
  titleRegister: 'Create an account',
  titleLogin: 'Sign in',
  titleSecondStep: 'Second step',
  titlePasskeyLogin: 'Passkey sign-in',

  // Shared
  username: 'Username',
  password: 'Password',
  email: 'Email',
  cancel: 'Cancel',
  save: 'Save',
  continue: 'Continue',
  remove: 'Remove',
  expiredTryAgain: 'Expired, try again.',

  // Register
  registerTitle: 'Create an account',
  registerIntro: 'The account lives in this app. auth-gate only holds the second factors you add next.',
  registerSubmit: 'Create account',
  registerTaken: 'That username is taken.',
  haveAccount: 'Already have one?',
  signIn: 'Sign in',

  // Login
  loginTitle: 'Sign in',
  loginWrong: 'Wrong username or password.',
  loginWithPasskey: 'Sign in with a passkey instead',
  createAccount: 'Create an account',

  // Passkey login
  passkeyLoginTitle: 'Sign in with a passkey',
  passkeyLoginIntro: 'No password. auth-gate v1 needs the username to find your passkeys.',
  passkeyNone: 'No passkey for that username.',
  passkeySignInPassword: 'Sign in with your password',
  passkeyAndAddOne: 'and add one.',
  usePassword: 'Use a password instead',

  // Second factor and step-up
  secondTitle: 'Second step',
  secondIntro: 'Your password was right. Now prove it is you with a factor auth-gate holds.',
  startOver: 'Start over',
  or: 'or',
  pin: 'PIN',
  verifyPin: 'Verify PIN',
  usePasskey: 'Use a passkey',
  wrongPin: (left: number) => `Wrong PIN, ${left} ${left === 1 ? 'attempt' : 'attempts'} left`,
  verifyFailed: 'Verification failed, try again.',
  lockedUntil: (at: string) => `Too many wrong attempts. Locked until ${at}.`,
  notSetUp: 'That factor is not set up.',
  addOnSecurity: 'Add it on the security page',
  stepUpTitle: 'Confirm it is you',
  stepUpIntro: 'This action needs a fresh verification. The token it returns is good for',
  stepUpIntroEnd: 'only.',
  noFactorYet: 'You have no second factor yet.',
  addPinOrPasskey: 'Add a PIN or a passkey',
  first: 'first.',

  // Home
  hello: (name: string) => `Hello, ${name}`,
  homeIntro: 'You are fully signed in. Changing your email asks you to verify again.',
  emailChanged: 'Email changed.',
  verifyExpired: 'Verification expired, try again',
  newEmail: 'New email',
  change: 'Change',
  secondFactors: 'Second factors',
  manage: 'Manage',
  factorsNone: 'None yet',
  passkeyCount: (n: number) => `${n} passkey${n === 1 ? '' : 's'}`,

  // Security
  securityTitle: 'Security',
  securityIntro: 'Your second factors live in auth-gate, not in this app. Add one, then sign out and back in to try it.',
  pinMismatch: 'The two PINs do not match.',
  pinRejected: 'auth-gate rejected that PIN.',
  badgeSet: 'Set',
  badgeNotSet: 'Not set',
  changePin: 'Change PIN',
  pinHasHint: 'Asked after your password, and before sensitive actions.',
  pinMissingHint: 'Add a PIN to use it after your password and before sensitive actions.',
  newPin: 'New PIN',
  repeatPin: 'Repeat PIN',
  savePin: 'Save PIN',
  setPin: 'Set PIN',
  removePin: 'Remove PIN',
  passkeys: 'Passkeys',
  addPasskey: 'Add a passkey',
  passkeysHint: 'Sign in with your fingerprint, face or security key instead of a PIN.',
  passkeyRegisterFailed: 'Could not register this passkey',
  added: (date: string) => `Added ${date}`,
  lastUsed: (date: string) => `Last used ${date}`,
  neverUsed: 'Never used',
  removePasskeyLabel: (id: string) => `Remove passkey ${id}`,

  // Session and errors
  loading: 'Loading',
  somethingWrong: 'Something went wrong.',
  errNetwork: 'Could not reach the server.',
  errUnavailable: 'AuthGate is unavailable right now. Try again in a moment.',
  errUnauthorized: 'Your session ended. Sign in again.',
  errUnknown: (code: string, status: number) => `The server said ${code} (${status}).`,

  // Trace drawer chrome (entries themselves are never translated)
  traceTitle: 'auth-gate calls',
  traceClear: 'Clear',
  traceCopyCurl: 'Copy as curl',
  traceEmpty: 'Nothing yet. Every call the backend makes to AuthGate shows up here.',
};

export type Strings = typeof en;

const vi: Strings = {
  locale: 'vi-VN',

  navLabel: 'Tài khoản',
  navHome: 'Trang chủ',
  navSecurity: 'Bảo mật',
  signOut: 'Đăng xuất',
  titleRegister: 'Tạo tài khoản',
  titleLogin: 'Đăng nhập',
  titleSecondStep: 'Bước thứ hai',
  titlePasskeyLogin: 'Đăng nhập bằng passkey',

  username: 'Tên đăng nhập',
  password: 'Mật khẩu',
  email: 'Email',
  cancel: 'Hủy',
  save: 'Lưu',
  continue: 'Tiếp tục',
  remove: 'Xóa',
  expiredTryAgain: 'Đã hết hạn, hãy thử lại.',

  registerTitle: 'Tạo tài khoản',
  registerIntro: 'Tài khoản nằm trong app này. auth-gate chỉ giữ các yếu tố thứ hai bạn thêm ở bước sau.',
  registerSubmit: 'Tạo tài khoản',
  registerTaken: 'Tên đăng nhập này đã có người dùng.',
  haveAccount: 'Đã có tài khoản?',
  signIn: 'Đăng nhập',

  loginTitle: 'Đăng nhập',
  loginWrong: 'Sai tên đăng nhập hoặc mật khẩu.',
  loginWithPasskey: 'Đăng nhập bằng passkey',
  createAccount: 'Tạo tài khoản',

  passkeyLoginTitle: 'Đăng nhập bằng passkey',
  passkeyLoginIntro: 'Không cần mật khẩu. auth-gate v1 cần tên đăng nhập để tìm passkey của bạn.',
  passkeyNone: 'Tên đăng nhập này chưa có passkey.',
  passkeySignInPassword: 'Đăng nhập bằng mật khẩu',
  passkeyAndAddOne: 'rồi thêm passkey.',
  usePassword: 'Dùng mật khẩu',

  secondTitle: 'Bước thứ hai',
  secondIntro: 'Mật khẩu đúng rồi. Giờ hãy xác nhận bằng yếu tố thứ hai do auth-gate giữ.',
  startOver: 'Làm lại từ đầu',
  or: 'hoặc',
  pin: 'PIN',
  verifyPin: 'Xác nhận PIN',
  usePasskey: 'Dùng passkey',
  wrongPin: (left) => `Sai PIN, còn ${left} lần thử`,
  verifyFailed: 'Xác thực không thành công, hãy thử lại.',
  lockedUntil: (at) => `Nhập sai quá nhiều lần. Bị khóa đến ${at}.`,
  notSetUp: 'Bạn chưa thiết lập yếu tố này.',
  addOnSecurity: 'Thêm trong trang Bảo mật',
  stepUpTitle: 'Xác nhận danh tính',
  stepUpIntro: 'Thao tác này cần xác thực lại. Token nhận được chỉ dùng cho',
  stepUpIntroEnd: 'mà thôi.',
  noFactorYet: 'Bạn chưa có yếu tố thứ hai nào.',
  addPinOrPasskey: 'Hãy thêm PIN hoặc passkey',
  first: 'trước.',

  hello: (name) => `Xin chào, ${name}`,
  homeIntro: 'Bạn đã đăng nhập đầy đủ. Đổi email sẽ yêu cầu xác thực lại.',
  emailChanged: 'Đã đổi email.',
  verifyExpired: 'Phiên xác thực đã hết hạn, hãy thử lại',
  newEmail: 'Email mới',
  change: 'Đổi',
  secondFactors: 'Yếu tố thứ hai',
  manage: 'Quản lý',
  factorsNone: 'Chưa có',
  passkeyCount: (n) => `${n} passkey`,

  securityTitle: 'Bảo mật',
  securityIntro: 'Các yếu tố thứ hai nằm ở auth-gate, không phải trong app này. Thêm một yếu tố, rồi đăng xuất và đăng nhập lại để thử.',
  pinMismatch: 'Hai mã PIN không khớp.',
  pinRejected: 'auth-gate từ chối mã PIN này.',
  badgeSet: 'Đã đặt',
  badgeNotSet: 'Chưa đặt',
  changePin: 'Đổi PIN',
  pinHasHint: 'Được hỏi sau mật khẩu và trước các thao tác nhạy cảm.',
  pinMissingHint: 'Thêm PIN để dùng sau mật khẩu và trước các thao tác nhạy cảm.',
  newPin: 'PIN mới',
  repeatPin: 'Nhập lại PIN',
  savePin: 'Lưu PIN',
  setPin: 'Đặt PIN',
  removePin: 'Xóa PIN',
  passkeys: 'Passkey',
  addPasskey: 'Thêm passkey',
  passkeysHint: 'Đăng nhập bằng vân tay, khuôn mặt hoặc khóa bảo mật thay cho PIN.',
  passkeyRegisterFailed: 'Không đăng ký được passkey này',
  added: (date) => `Thêm ngày ${date}`,
  lastUsed: (date) => `Dùng lần cuối ${date}`,
  neverUsed: 'Chưa dùng',
  removePasskeyLabel: (id) => `Xóa passkey ${id}`,

  loading: 'Đang tải',
  somethingWrong: 'Đã có lỗi xảy ra.',
  errNetwork: 'Không kết nối được với máy chủ.',
  errUnavailable: 'AuthGate đang tạm thời không khả dụng. Hãy thử lại sau ít phút.',
  errUnauthorized: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.',
  errUnknown: (code, status) => `Máy chủ trả về lỗi ${code} (${status}).`,

  traceTitle: 'Các lệnh gọi auth-gate',
  traceClear: 'Xóa',
  traceCopyCurl: 'Sao chép dạng curl',
  traceEmpty: 'Chưa có gì. Mọi lệnh backend gọi tới AuthGate sẽ hiện ở đây.',
};

const STRINGS: Record<Lang, Strings> = { en, vi };

/** Strings for the current language; re-renders when the toggle changes. */
export function useStrings(): Strings {
  const [lang] = useLang();
  return STRINGS[lang];
}
