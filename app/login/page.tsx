import { LoginForm } from "@/components/auth/login-form";
import { AuthLayout } from "@/components/layout/auth-layout";

type PageProps = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirectTo } = await searchParams;

  return (
    <AuthLayout>
      <LoginForm redirectTo={redirectTo} />
    </AuthLayout>
  );
}
