import { AuthProvider } from "@/features/auth/auth-provider";

/** Dashboard session (login page + dashboard). */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider audience="dashboard">{children}</AuthProvider>;
}
