import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Mail, Lock, User, ArrowLeft, PawPrint, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  FloatingLabelInput — label sits inside the field and floats up    */
/*  on focus or when a value is present.                              */
/* ------------------------------------------------------------------ */

function FloatingLabelInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  icon,
  required,
  minLength,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: ReactNode;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const floated = focused || value.length > 0;

  return (
    <div className="relative">
      {/* Icon */}
      <span
        className={cn(
          'absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] transition-colors duration-200 z-10',
          floated ? 'text-primary-500' : 'text-surface-400'
        )}
      >
        {icon}
      </span>

      <input
        id={id}
        type={inputType}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder=" "
        className={cn(
          'peer w-full h-[58px] pl-11 pr-11 rounded-2xl border-2 text-[15px] text-surface-900',
          'bg-surface-50 outline-none transition-all duration-200',
          floated
            ? 'border-primary-500 shadow-[0_0_0_3px_rgb(var(--color-primary-500)/0.10)]'
            : 'border-surface-200 hover:border-surface-300'
        )}
      />

      {/* Floating label */}
      <label
        htmlFor={id}
        className={cn(
          'absolute left-11 pointer-events-none transition-all duration-200 ease-out origin-left',
          floated
            ? 'top-2 text-[11px] font-medium text-primary-600 scale-100'
            : 'top-1/2 -translate-y-1/2 text-[15px] text-surface-400'
        )}
      >
        {label}
        {required && <span className="text-error-500 ml-0.5">*</span>}
      </label>

      {/* Password toggle */}
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
          aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        >
          {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      )}

      {/* Hint shown when field is empty and unfocused */}
      {!floated && hint && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-surface-300 pointer-events-none">
          {hint}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LoginButton — primary button with scale-down press feedback       */
/* ------------------------------------------------------------------ */

function LoginButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="submit"
      disabled={loading}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className={cn(
        'w-full h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl font-semibold text-[15px] text-white',
        'bg-primary-600 hover:bg-primary-700 transition-all duration-200',
        'shadow-[0_8px_24px_-6px_rgb(var(--color-primary-600)/0.45)] hover:shadow-[0_12px_32px_-6px_rgb(var(--color-primary-600)/0.55)]',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none',
        pressed && !loading ? 'scale-[0.97]' : 'scale-100'
      )}
      style={{ transition: 'transform 120ms ease, background-color 200ms ease, box-shadow 200ms ease' }}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          กำลังดำเนินการ...
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  AuthScreen — main login / signup screen                           */
/* ------------------------------------------------------------------ */

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Parallax tracking
  const parallaxRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = parallaxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;   // -0.5 .. 0.5
    const dy = (e.clientY - cy) / rect.height;  // -0.5 .. 0.5
    el.style.setProperty('--px', String(dx));
    el.style.setProperty('--py', String(dy));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, displayName);
      if (error) setError(error);
    }
    setLoading(false);
  }

  function switchMode(newMode: 'signin' | 'signup') {
    setMode(newMode);
    setError(null);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ===== Left panel — branding with parallax blobs ===== */}
      <div
        ref={parallaxRef}
        onMouseMove={handleMouseMove}
        className="lg:w-[52%] bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 relative overflow-hidden flex items-center justify-center p-8 lg:p-16"
        style={{ '--px': 0, '--py': 0 } as React.CSSProperties}
      >
        {/* Parallax blob layer */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Blob 1 — moves opposite to mouse */}
          <div
            className="absolute top-[8%] left-[10%] w-80 h-80 rounded-full bg-white/15 blur-[90px]"
            style={{
              transform: 'translate(calc(var(--px) * -28px), calc(var(--py) * -28px))',
              transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
          {/* Blob 2 — moves with mouse */}
          <div
            className="absolute bottom-[6%] right-[8%] w-[28rem] h-[28rem] rounded-full bg-primary-400/30 blur-[100px]"
            style={{
              transform: 'translate(calc(var(--px) * 32px), calc(var(--py) * 32px))',
              transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
          {/* Blob 3 — accent warm glow */}
          <div
            className="absolute top-[45%] left-[55%] w-72 h-72 rounded-full bg-accent-400/15 blur-[80px]"
            style={{
              transform: 'translate(calc(var(--px) * -16px), calc(var(--py) * 20px))',
              transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </div>

        {/* Subtle dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Brand content */}
        <div className="relative z-10 max-w-lg text-white">
          {/* Logo + name */}
          <div className="flex items-center gap-4 mb-10 animate-slide-up">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-2.5">
              <img
                src="/logo.png"
                alt="All About Pet"
                className="w-full h-full object-contain brightness-0 invert"
              />
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight">All About Pet</span>
              <p className="text-primary-200/70 text-sm font-light">Pet Retail Management</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-[2rem] lg:text-[2.5rem] font-extrabold leading-[1.2] mb-5 text-balance animate-slide-up animate-delay-100">
            ระบบบริหารร้านขายอาหารสัตว์เลี้ยง
            <br />
            <span className="text-primary-200 font-bold">ครบทุกด้านในที่เดียว</span>
          </h1>

          <p className="text-primary-100/80 text-lg leading-[1.7] font-light mb-10 max-w-md animate-slide-up animate-delay-200">
            จัดการหลายสาขา ยอดขาย สต๊อกสินค้า การจัดซื้อ ออนไลน์ การตลาด และบริการลูกค้า ได้จากแพลตฟอร์มเดียว
          </p>

          {/* Feature list */}
          <div className="space-y-3.5 animate-slide-up animate-delay-300">
            {[
              'Dashboard ผู้บริหารแบบเรียลไทม์',
              'เช็คอินด้วย GPS + เซลฟี่',
              'เชื่อม TikTok / Shopee / Lazada / LINE',
              'ระบบสิทธิ์การใช้งานตามตำแหน่ง',
            ].map((feature, i) => (
              <div
                key={feature}
                className="flex items-center gap-3 text-primary-100/90"
                style={{
                  animation: `slideUp 0.5s cubic-bezier(0.16,1,0.3,1) ${0.35 + i * 0.08}s both`,
                }}
              >
                <div className="w-6 h-6 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </div>
                <span className="text-[15px] font-light">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating paw mascot */}
        <div className="absolute bottom-8 left-8 hidden lg:block animate-bounce-subtle" style={{ animationDuration: '3s', animationIterationCount: 'infinite' }}>
          <PawPrint className="w-10 h-10 text-white/20" />
        </div>
        <div className="absolute top-1/3 right-12 hidden lg:block animate-bounce-subtle" style={{ animationDuration: '4s', animationIterationCount: 'infinite', animationDelay: '1s' }}>
          <PawPrint className="w-6 h-6 text-white/10" />
        </div>
      </div>

      {/* ===== Right panel — floating login card ===== */}
      <div className="lg:w-[48%] flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-surface-50 relative overflow-hidden">
        {/* Soft ambient blobs on right panel too */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary-200/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent-200/15 blur-[70px] pointer-events-none" />

        {/* Floating card */}
        <div
          className="relative w-full max-w-[420px] rounded-[20px] bg-white border border-surface-200/80 p-8 sm:p-10 animate-slide-up"
          style={{
            boxShadow: '0 4px 24px -6px rgb(0 0 0 / 0.08), 0 12px 48px -12px rgb(0 0 0 / 0.12)',
          }}
        >
          {/* Paw mascot in card corner */}
          <div className="absolute -top-5 -right-5 w-12 h-12 rounded-2xl bg-primary-600 shadow-lg flex items-center justify-center rotate-12">
            <PawPrint className="w-6 h-6 text-white" />
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 animate-fade-in">
            <img
              src="/logo.png"
              alt="All About Pet"
              className="w-10 h-10 object-contain rounded-xl bg-white p-1.5"
            />
            <span className="text-xl font-bold text-surface-900">All About Pet</span>
          </div>

          {/* Heading */}
          <div className="mb-8" style={{ animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
            <h2 className="text-[28px] font-extrabold text-surface-900 mb-1.5 tracking-tight">
              {mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </h2>
            <p className="text-surface-500 text-[15px] leading-relaxed font-light">
              {mode === 'signin'
                ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ'
                : 'กรอกข้อมูลเพื่อสร้างบัญชีใหม่ — ผู้ดูแลระบบจะกำหนดสิทธิ์ให้ภายหลัง'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
                <FloatingLabelInput
                  id="display-name"
                  label="ชื่อ-นามสกุล"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  icon={<User className="w-[18px] h-[18px]" />}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div style={{ animation: `slideUp 0.4s cubic-bezier(0.16,1,0.3,1) ${mode === 'signup' ? 0.2 : 0.15}s both` }}>
              <FloatingLabelInput
                id="email"
                label="อีเมล"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-[18px] h-[18px]" />}
                required
                autoComplete="email"
                hint="name@example.com"
              />
            </div>

            <div style={{ animation: `slideUp 0.4s cubic-bezier(0.16,1,0.3,1) ${mode === 'signup' ? 0.25 : 0.2}s both` }}>
              <FloatingLabelInput
                id="password"
                label="รหัสผ่าน"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-[18px] h-[18px]" />}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                hint={mode === 'signup' ? '6 ตัวอักษรขึ้นไป' : undefined}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-sm animate-slide-down">
                {error}
              </div>
            )}

            {/* Submit */}
            <div style={{ animation: `slideUp 0.4s cubic-bezier(0.16,1,0.3,1) ${mode === 'signup' ? 0.3 : 0.25}s both` }}>
              <LoginButton loading={loading}>
                {mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </LoginButton>
            </div>
          </form>

          {/* Switch mode */}
          <div className="mt-7 text-center text-sm text-surface-500" style={{ animation: 'fadeIn 0.4s ease-out 0.35s both' }}>
            {mode === 'signin' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีแล้ว?'}
            <button
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="ml-2 font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              {mode === 'signin' ? 'สมัครใหม่' : 'เข้าสู่ระบบ'}
            </button>
          </div>

          {mode === 'signup' && (
            <p className="mt-4 text-center text-xs text-surface-400 leading-relaxed" style={{ animation: 'fadeIn 0.4s ease-out 0.4s both' }}>
              บัญชีที่สมัครใหม่จะอยู่ในสถานะ "รออนุมัติ" จนกว่าผู้ดูแลระบบจะกำหนดสิทธิ์
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PendingApprovalScreen                                             */
/* ------------------------------------------------------------------ */

export function PendingApprovalScreen() {
  const { signOut, profile } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-8">
      <div className="max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/logo.png"
            alt="All About Pet"
            className="w-12 h-12 object-contain rounded-xl bg-white"
          />
          <span className="text-xl font-bold text-surface-900">All About Pet</span>
        </div>
        <div className="p-8 rounded-2xl bg-white border border-surface-200 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-warning-100 flex items-center justify-center mb-4">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">
            บัญชีรอการอนุมัติ
          </h2>
          <p className="text-surface-500 text-sm mb-6">
            สวัสดี {profile?.display_name ?? profile?.email} บัญชีของคุณสร้างเรียบร้อยแล้ว
            แต่ยังอยู่ในสถานะรออนุมัติ ผู้ดูแลระบบจะกำหนดสิทธิ์การใช้งานให้คุณโดยเร็ว
          </p>
          <button
            onClick={signOut}
            className="btn-secondary w-full"
          >
            <ArrowLeft className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
