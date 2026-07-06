import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { redirect } from "next/navigation";
import { handleLogin } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Check if admin user exists, if not redirect to register
  const existingUsers = await db.select().from(users).all();
  if (existingUsers.length === 0) {
    redirect("/register");
  }

  const { error } = await searchParams;

  return (
    <div className="w-full max-w-sm glass-card rounded-lg p-8 shadow-xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Login to Triparr</h2>
        <p className="text-xs text-[#C2C6D6]">Enter credentials to manage your media</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded text-center">
          {error}
        </div>
      )}

      <form action={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#8C909F] uppercase mb-1.5">
            Username
          </label>
          <input
            type="text"
            name="username"
            required
            className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
            placeholder="admin"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#8C909F] uppercase mb-1.5">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm rounded shadow transition-colors mt-2"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
