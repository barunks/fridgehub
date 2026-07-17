import { BookOpen, GraduationCap, Layers, Play, Sparkles, Star } from 'lucide-react'

export const DemoHero = () => (
  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-500 px-8 py-12 text-white shadow-2xl shadow-indigo-400/20">
    {/* Animated warm sparkles on rich background */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Soft color accents */}
      <div className="absolute -left-16 -top-16 size-72 rounded-full bg-white/[0.06] blur-2xl animate-[moonFloat_7s_ease-in-out_infinite]" />
      <div className="absolute -bottom-24 -right-24 size-80 rounded-full bg-teal-300/10 blur-3xl animate-[moonFloat_9s_ease-in-out_infinite_2s]" />
      <div className="absolute left-1/3 top-1/3 size-48 rounded-full bg-amber-300/[0.07] blur-2xl animate-[moonFloat_6s_ease-in-out_infinite_1s]" />

      {/* Sparkle particles — warm gold/white tones */}
      <div className="absolute left-[10%] top-[18%] size-2 rounded-full bg-amber-300/80 animate-[starTwinkle_2s_ease-in-out_infinite]" />
      <div className="absolute left-[25%] top-[70%] size-1.5 rounded-full bg-white/60 animate-[starTwinkle_2.5s_ease-in-out_infinite_0.5s]" />
      <div className="absolute left-[52%] top-[12%] size-2.5 rounded-full bg-yellow-300/60 animate-[starTwinkle_3s_ease-in-out_infinite_1s]" />
      <div className="absolute left-[70%] top-[58%] size-1.5 rounded-full bg-teal-200/50 animate-[starTwinkle_2.2s_ease-in-out_infinite_1.5s]" />
      <div className="absolute left-[88%] top-[22%] size-2 rounded-full bg-amber-200/50 animate-[starTwinkle_2.8s_ease-in-out_infinite_0.8s]" />
      <div className="absolute left-[38%] top-[82%] size-1.5 rounded-full bg-white/40 animate-[starTwinkle_3.2s_ease-in-out_infinite_2s]" />
      <div className="absolute left-[62%] top-[40%] size-2 rounded-full bg-yellow-200/40 animate-[starTwinkle_2.6s_ease-in-out_infinite_0.3s]" />

      {/* Flowing wave at bottom */}
      <svg className="absolute bottom-0 left-0 w-full opacity-[0.08]" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill="white" />
        <path d="M0,80 C300,40 500,100 700,60 C900,20 1100,80 1200,50 L1200,120 L0,120 Z" fill="white" opacity="0.5" />
      </svg>
    </div>

    <div className="relative grid gap-8 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
          <Play className="size-3 text-amber-300" aria-hidden="true" />
          <span className="text-xs font-semibold text-white/90">Interactive Tutorial</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-amber-200 via-yellow-200 to-teal-200 bg-clip-text text-transparent">FridgeHub</span>
          <span className="ml-3 text-white">Guide</span>
        </h1>

        <p className="mt-4 max-w-lg text-base leading-relaxed text-indigo-100">
          Master every feature with visual walkthroughs, live workflow previews, and step-by-step instructions. Your family's productivity starts here.
        </p>

        {/* Feature pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { icon: Layers, label: '7 Modules', color: 'border-amber-300/40 bg-amber-400/15 text-amber-200' },
            { icon: BookOpen, label: 'Step-by-Step', color: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200' },
            { icon: Sparkles, label: 'Visual Flows', color: 'border-sky-300/40 bg-sky-400/15 text-sky-200' },
            { icon: GraduationCap, label: '12 FAQs', color: 'border-purple-300/40 bg-purple-400/15 text-purple-200' },
          ].map((pill) => {
            const Icon = pill.icon
            return (
              <span key={pill.label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ${pill.color}`}>
                <Icon className="size-3" aria-hidden="true" />
                {pill.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Mini dashboard preview mockup */}
      <div className="hidden lg:block">
        <div className="w-72 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
          {/* Window chrome */}
          <div className="mb-3 flex items-center gap-2">
            <div className="size-3 rounded-full bg-rose-400 shadow-sm shadow-rose-400/40" />
            <div className="size-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/40" />
            <div className="size-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/40" />
            <div className="ml-auto flex items-center gap-1">
              <Star className="size-3 text-amber-300 animate-[starTwinkle_2s_ease-in-out_infinite]" aria-hidden="true" />
              <div className="h-2 w-12 rounded-full bg-white/10" />
            </div>
          </div>
          {/* Mini stat cards */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              { n: '4', l: 'Tasks', tc: 'text-indigo-200' },
              { n: '3', l: 'Items', tc: 'text-amber-200' },
              { n: '28', l: 'Meals', tc: 'text-emerald-200' },
            ].map((stat) => (
              <div key={stat.l} className="rounded-lg bg-white/[0.07] p-2 text-center">
                <div className={`text-sm font-bold ${stat.tc}`}>{stat.n}</div>
                <div className="text-[8px] font-medium text-white/50">{stat.l}</div>
              </div>
            ))}
          </div>
          {/* Mini task list */}
          <div className="space-y-1.5">
            {[
              { color: 'bg-rose-400', w: 'w-3/4', label: 'Medication' },
              { color: 'bg-amber-400', w: 'w-2/3', label: 'School event' },
              { color: 'bg-emerald-400', w: 'w-4/5', label: 'Groceries' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-2">
                <div className={`size-2.5 rounded-full ${row.color}`} />
                <div className={`h-1.5 rounded-full bg-white/15 ${row.w}`} />
                <div className="ml-auto text-[7px] font-medium text-white/40">{row.label}</div>
              </div>
            ))}
          </div>
          {/* Mini chart */}
          <div className="mt-3 flex items-end gap-1 rounded-lg bg-white/[0.05] p-2.5">
            {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-teal-400/60 to-amber-300/30" style={{ height: `${h * 0.3}px` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)
