"use client";

import { FloatingDock } from "@/components/ui/floating-dock";

export function AppDock({ isAdmin }: { isAdmin?: boolean }) {
  const items = [
    {
      title: "Платежи",
      href: "/dashboard",
      icon: (
        <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: "Пользователи",
            href: "/users",
            icon: (
              <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ),
          },
        ]
      : []),
    {
      title: "API Docs",
      href: "http://127.0.0.1:8000/api/v1/docs",
      icon: (
        <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <FloatingDock items={items} />
    </div>
  );
}
