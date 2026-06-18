import LoginCard from "../components/LoginCard";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,142,219,0.16),_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f7fbfd_48%,_#eefcf7_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <LoginCard />
      </div>
    </main>
  );
}
