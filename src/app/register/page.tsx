import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { redirect } from "next/navigation";
import { handleRegister } from "./actions";

export default async function RegisterPage() {
  // Check if admin user already exists
  const existingUsers = await db.select().from(users).all();
  if (existingUsers.length > 0) {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-sm glass-card rounded-lg p-8 shadow-xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Create Admin Account</h2>
        <p className="text-xs text-[#C2C6D6]">Triparr is single-user. Set up your admin account.</p>
      </div>

      <form action={handleRegister} className="space-y-4">
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

        <div>
          <label className="block text-xs font-semibold text-[#8C909F] uppercase mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            required
            className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#262626] rounded text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm rounded shadow transition-colors mt-2"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}
