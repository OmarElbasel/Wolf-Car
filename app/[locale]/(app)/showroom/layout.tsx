import { AuthProvider } from "@/features/auth/auth-provider";

/** Showroom kiosk session (separate credentials and cookie from the dashboard). */
export default function ShowroomLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider audience="showroom">{children}</AuthProvider>;
}
