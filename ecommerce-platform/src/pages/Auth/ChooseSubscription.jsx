import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, Database, Loader2, ShieldCheck, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { cleanText, safeUploadPath, validateImage, validatePaymentReference } from "../../utils/security";
import BankTransferQr from "../../components/payment/BankTransferQr";
import { ensurePaymentReferenceAvailable, paymentReferenceErrorMessage } from "../../lib/paymentReference";

const DEFAULT_PLANS = [
  { months: 6, label: "Starter · 6 Months", amount: 1599, monthly: 267 },
  {
    months: 12,
    label: "Growth · 1 Year",
    amount: 2799,
    monthly: 233,
    featured: true,
  },
  { months: 24, label: "Pro · 2 Years", amount: 4999, monthly: 208 },
];

export default function ChooseSubscription() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(DEFAULT_PLANS),
    [planMonths, setPlanMonths] = useState(12),
    [method, setMethod] = useState("gcash"),
    [reference, setReference] = useState(""),
    [proof, setProof] = useState(null),
    [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("months,name,fee")
      .eq("active", true)
      .order("months")
      .then(({ data }) => {
        if (data?.length) {
          setPlans(
            data.map((p) => ({
              months: p.months,
              label: `${p.name} · ${p.months} Months`,
              amount: Number(p.fee),
              monthly: Math.ceil(Number(p.fee) / p.months),
              featured: p.months === 12,
            })),
          );
          if (!data.some((p) => p.months === planMonths))
            setPlanMonths(data[0].months);
        }
      });
  }, []);
  const PLANS = plans;
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && role !== "merchant")
    return <Navigate to="/pending-approval" replace />;
  const submit = async (event) => {
    event.preventDefault();
    const fileError = validateImage(proof);
    if (fileError) return toast.error(fileError);
    const referenceError = validatePaymentReference(reference);
    if (referenceError) return toast.error(referenceError);
    setSubmitting(true);
    try {
      await ensurePaymentReferenceAvailable(reference);
      const plan = PLANS.find((item) => item.months === planMonths);
      const path = safeUploadPath(user.id, "subscription", proof);
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, proof);
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("subscription_requests")
        .insert({
          owner_id: user.id,
          plan_months: plan.months,
          amount: plan.amount,
          payment_method: method,
          reference_number: cleanText(reference, 120),
          proof_url: path,
        });
      if (error) throw error;
      toast.success("Subscription payment submitted for Admin approval.");
      navigate("/pending-approval");
    } catch (error) {
      toast.error(paymentReferenceErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(22,121,75,.12),transparent_35%),#F7FAF7] px-4 py-10">
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-black/[.06] bg-white shadow-2xl shadow-teal-900/10"
      >
        <header className="bg-gradient-to-br from-teal-950 to-teal-700 p-6 text-white sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
            <Database className="text-mango-300" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold sm:text-3xl">
            Choose your Merchant plan
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Your subscription helps maintain secure product storage, database
            backups, order tools, reports, and your connection to the reseller
            network.
          </p>
        </header>
        <div className="space-y-6 p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <button
                key={plan.months}
                type="button"
                onClick={() => setPlanMonths(plan.months)}
                className={`relative rounded-2xl border-2 p-5 text-left transition ${planMonths === plan.months ? "border-teal-500 bg-teal-50 shadow-md" : "border-black/10 hover:border-teal-200"}`}
              >
                {plan.featured && (
                  <span className="mb-2 inline-block rounded-full bg-teal-700 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
                    Best value
                  </span>
                )}
                {planMonths === plan.months && (
                  <Check
                    className="absolute right-3 top-3 text-teal-600"
                    size={17}
                  />
                )}
                <span className="block pr-5 text-sm font-semibold">
                  {plan.label}
                </span>
                <span className="mt-2 block font-display text-2xl font-bold text-teal-700">
                  ₱{plan.amount.toLocaleString()}
                </span>
                <span className="mt-1 block text-xs text-ink/45">
                  about ₱{plan.monthly}/month
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-xs text-ink/60 sm:grid-cols-2">
            <p className="flex gap-2">
              <ShieldCheck size={17} className="shrink-0 text-teal-700" />
              <span>
                <strong className="text-teal-900">Transparent pricing.</strong>{" "}
                A 3% success fee applies only when a product order is completed.
              </span>
            </p>
            <p className="flex gap-2">
              <Check size={17} className="shrink-0 text-teal-700" />
              <span>Cancelled orders do not incur a Merchant success fee.</span>
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Payment Method
              <select
                className="input-field mt-1"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Reference Number
              <input
                required
                minLength={6}
                maxLength={120}
                className="input-field mt-1"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <span className="mt-1 block text-[11px] leading-4 text-ink/45">A payment reference can only be used once across subscriptions and wallet top-ups.</span>
            </label>
          </div>
          <BankTransferQr />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-200 p-6 hover:bg-teal-50">
            <Upload size={20} className="text-teal-600" />
            <span className="text-sm text-ink/60">
              {proof ? proof.name : "Upload payment screenshot"}
            </span>
            <input
              required
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProof(e.target.files?.[0] || null)}
            />
          </label>
          <button
            disabled={submitting}
            className="btn-primary flex w-full justify-center gap-2 py-3"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Submitting..." : "Submit for Admin Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}
