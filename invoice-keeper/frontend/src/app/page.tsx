"use client";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-blue-500">Invoice</span> Keeper
        </h1>
        <p className="text-xl text-gray-400 max-w-md">
          Личное дело. Регулярные платежи. Напоминания. Контроль.
        </p>
        <div className="pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dossier-card border border-dossier-border text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Оболочка готова. 3D-сцена и API — следующий шаг.
          </div>
        </div>
      </div>
    </main>
  );
}
