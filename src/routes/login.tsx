import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AuthCard } from "@/components/auth/auth-card";
import { GoogleSignInButton } from "@/components/auth/google-button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول · كيوباي" },
      { name: "description", content: "سجّل الدخول إلى حسابك في كيوباي باستخدام Google." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthCard
      title="مرحبًا بك في كيوباي"
      subtitle="سجّل الدخول أو أنشئ حسابك باستخدام Google في خطوة واحدة."
    >
      <div className="space-y-4">
        <GoogleSignInButton intent={{ kind: "merchant" }} onError={setError} />
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          سيتم إنشاء حسابك تلقائيًا في أول تسجيل دخول، ولا حاجة إلى كلمة مرور.
        </p>
      </div>
    </AuthCard>
  );
}
