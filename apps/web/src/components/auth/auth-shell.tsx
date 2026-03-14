import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

function QuestionTile({
  className,
  accentClassName,
}: {
  className: string;
  accentClassName: string;
}) {
  return (
    <div
      className={`absolute rounded-[36px] border border-white/5 bg-white/[0.03] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="flex gap-4">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] text-6xl font-semibold text-black/80 ${accentClassName}`}
        >
          ?
        </div>
        <div className="min-w-[180px] flex-1 space-y-4 pt-2 opacity-50">
          <div className="h-5 w-28 rounded-full bg-white/8" />
          <div className="h-4 w-full rounded-full bg-white/6" />
          <div className="h-4 w-4/5 rounded-full bg-white/6" />
          <div className="mt-8 flex gap-3">
            <div className="h-4 w-16 rounded-full bg-white/8" />
            <div className="h-4 w-14 rounded-full bg-white/8" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,133,48,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(73,98,255,0.08),transparent_35%)]" />
      <QuestionTile
        className="left-[3%] top-[3%] hidden w-[430px] xl:block"
        accentClassName="bg-[linear-gradient(180deg,#8a4a18,#7b3f16)]"
      />
      <QuestionTile
        className="bottom-[8%] left-[8%] hidden w-[420px] lg:block"
        accentClassName="bg-[linear-gradient(180deg,#9a531c,#8a4919)]"
      />
      <QuestionTile
        className="right-[3%] top-[26%] hidden w-[410px] xl:block"
        accentClassName="bg-[linear-gradient(180deg,#a15d21,#92521d)]"
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        {children}
      </div>
    </main>
  );
}
