"use client";

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900/70 border-r border-white/5 backdrop-blur flex flex-col p-6 gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace</p>
        <h1 className="mt-2 text-xl font-semibold">ImageGen Canvas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Arrange generations, references, and iterate visually.
        </p>
      </div>
      <nav className="flex flex-col gap-3 text-sm text-slate-300">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-white/5 px-3 py-2 text-left hover:bg-white/10 transition"
        >
          New Layer
        </button>
        <button
          type="button"
          className="inline-flex items-center rounded-md px-3 py-2 text-left hover:bg-white/10 transition"
        >
          History
        </button>
        <button
          type="button"
          className="inline-flex items-center rounded-md px-3 py-2 text-left hover:bg-white/10 transition"
        >
          References
        </button>
      </nav>
      <div className="mt-auto rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
        <p className="font-medium text-slate-100">Agents idea</p>
        <p className="mt-2">
          Future agents can track variants, auto-tag outputs, and orchestrate staged
          refinements without leaving the canvas.
        </p>
      </div>
    </aside>
  );
}
