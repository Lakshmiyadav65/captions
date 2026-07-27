export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfcfd] text-neutral-900 antialiased [color-scheme:light]">
      {children}
    </div>
  );
}
