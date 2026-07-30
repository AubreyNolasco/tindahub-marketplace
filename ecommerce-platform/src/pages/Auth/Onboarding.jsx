import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BadgeCheck, Loader2, Store, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { cleanText } from "../../utils/security";
import { COMPLETE_ADDRESS_HELP, isCompleteAddress } from "../../utils/address";
import Spinner from "../../components/ui/Spinner";
import ProfileLoadError from "../../components/auth/ProfileLoadError";

export default function Onboarding() {
  const { user, profile, loading, profileError, refreshProfile, signOut } =
    useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("reseller");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading)
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  if (user && !profile)
    return (
      <ProfileLoadError
        message={profileError || "Your account profile is missing."}
        onSignOut={signOut}
      />
    );
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.onboarding_completed !== false)
    return <Navigate to="/auth/continue" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!isCompleteAddress(address))
      return toast.error("Please enter your complete address.");
    if (role === "merchant" && businessName.trim().length < 2)
      return toast.error("Please enter your business name.");
    setSaving(true);
    try {
      const { error } = await supabase.rpc("complete_account_onboarding", {
        p_role: role,
        p_phone: cleanText(phone, 30),
        p_address: cleanText(address, 500),
        p_business_name:
          role === "merchant" ? cleanText(businessName, 160) : null,
      });
      if (error) throw error;
      await refreshProfile();
      toast.success("Email verified. Complete the remaining approval steps.");
      navigate(role === "merchant" ? "/merchant-permit" : "/reseller", {
        replace: true,
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-black/[0.06] bg-surface shadow-xl">
        <div className="bg-gradient-to-br from-teal-950 to-teal-700 px-6 py-7 text-white sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
            <BadgeCheck size={14} className="text-mango-300" /> Email verified by OTP
            verified
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold sm:text-3xl">
            Complete your JOM HUB profile
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <img
              src={
                user.user_metadata?.avatar_url || user.user_metadata?.picture
              }
              alt=""
              className="h-11 w-11 rounded-full bg-white/10 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.full_name}</p>
              <p className="truncate text-sm text-white/60">{user.email}</p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6 sm:p-8">
          <p className="rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-900">
            Your email was verified using the secure 6-digit code sent to your inbox and
            cannot be manually changed here.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("reseller")}
              className={`rounded-2xl border-2 p-4 text-center transition ${role === "reseller" ? "border-teal-500 bg-teal-50 text-teal-900" : "border-black/10 text-ink/55"}`}
            >
              <Users size={22} className="mx-auto" />
              <span className="mt-2 block text-sm font-bold">Reseller</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("merchant")}
              className={`rounded-2xl border-2 p-4 text-center transition ${role === "merchant" ? "border-teal-500 bg-teal-50 text-teal-900" : "border-black/10 text-ink/55"}`}
            >
              <Store size={22} className="mx-auto" />
              <span className="mt-2 block text-sm font-bold">Merchant</span>
            </button>
          </div>
          {role === "merchant" && (
            <label className="block text-sm font-semibold text-ink/70">
              Business name
              <input
                required
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="input-field mt-1.5"
                maxLength="160"
              />
            </label>
          )}
          <label className="block text-sm font-semibold text-ink/70">
            Phone number
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="input-field mt-1.5"
              maxLength="30"
              inputMode="tel"
            />
          </label>
          <label className="block text-sm font-semibold text-ink/70">
            {role === "merchant"
              ? "Complete pickup address"
              : "Complete reseller address"}
            <textarea
              required
              rows="4"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="input-field mt-1.5 resize-none"
              maxLength="500"
            />
            <span className="mt-1 block text-[11px] font-normal leading-4 text-ink/45">
              {COMPLETE_ADDRESS_HELP}
            </span>
          </label>
          {role === "reseller" && (
            <p className="rounded-xl bg-mango-100/60 p-3 text-xs leading-5 text-ink/60 dark:bg-mango-500/10">
              You can top up your wallet anytime from the Wallet page once you're in your
              dashboard -- it's not required to finish signing up.
            </p>
          )}
          <button
            disabled={saving}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3.5"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "Saving profile..." : "Complete profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
