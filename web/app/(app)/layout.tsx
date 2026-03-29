import { NavBar } from "@/components/NavBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="max-w-4xl mx-auto w-full px-4 py-6">{children}</main>
    </>
  );
}
