import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  QrCode,
  Camera,
  Lock,
  Phone,
  Mail,
  CheckCircle2,
  Scale,
  FileText,
  HelpCircle,
  Search,
  Building2,
  Calculator,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from "lucide-react";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
  type SupportTicketCreatedResponse
} from "@luggage-storage/contracts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatLkr } from "@/data/mock-marketplace";
import {
  useCreateSupportTicketMutation,
  useMySupportTicketDetailQuery,
  useMySupportTicketsQuery,
  useReplyMySupportTicketMutation
} from "@/hooks/queries/use-support-tickets";
import { formatDateTimeDisplay } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";

const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  BOOKING_ISSUE: "Booking Issue",
  CUSTODY_INCIDENT: "Custody or Baggage Incident",
  PAYMENT_REFUND: "Payment & Refund",
  HOST_ONBOARDING: "Host Onboarding",
  ACCOUNT_ACCESS: "Account & Sign-In",
  GENERAL_INQUIRY: "General Inquiry"
};

export function BecomeAHostLandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const isAlreadyHost =
    isAuthenticated &&
    Boolean(
      user?.roles?.some(
        (role) => role === "HOST_OWNER" || role === "HOST_STAFF" || role === "SUPERADMIN"
      )
    );
  const hostCtaTo = isAlreadyHost ? "/host/dashboard" : "/host/onboarding";
  const hostCtaLabel = isAlreadyHost
    ? "Open Host Dashboard"
    : "Apply to Host in Sri Lanka";
  const [dailyBags, setDailyBags] = useState(18);
  const [avgFeeLkr, setAvgFeeLkr] = useState(1400);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Become a Host Partner — LuggageStorage";
    }
  }, []);

  const grossMonthlyLkr = dailyBags * avgFeeLkr * 30;
  const hostNetLkr = Math.round(grossMonthlyLkr * 0.85);

  return (
    <div className="space-y-12 pb-12">
      <section className="rounded-3xl bg-navy-950 text-white p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="brand" size="md">
              Sri Lanka Partner Network
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
            Monetize Unused Space Into Predictable Partner Revenue
          </h1>
          <p className="text-sand-200 text-base leading-relaxed">
            Hotels, transit cafes, and retail counters keep 85% net revenue on every completed
            storage booking with digital custody logs and transparent bi-monthly settlement ledgers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={hostCtaTo}
              className="min-h-[44px] inline-flex items-center px-5 py-3 rounded-xl bg-terracotta-500 text-white text-sm font-bold hover:bg-terracotta-600 transition-colors"
            >
              {hostCtaLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="min-h-[44px] inline-flex items-center px-5 py-3 rounded-xl bg-white/10 border border-white/25 text-white text-sm font-bold hover:bg-white/20 transition-colors"
              >
                Create Partner Account
              </Link>
            )}
            <Link
              to="/how-it-works"
              className="min-h-[44px] inline-flex items-center px-5 py-3 rounded-xl border border-white/25 text-white text-sm font-bold hover:bg-white/10 transition-colors"
            >
              Review Counter Workflow
            </Link>
          </div>

          <div className="pt-2">
            <MascotIllustration
              mascot="high-five"
              size="sm"
              variant="inline"
              className="bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 [&_p]:text-sand-100"
              caption="Join verified Sri Lankan hospitality partners welcoming travellers every day."
            />
          </div>
        </div>

        <Card className="lg:col-span-5 p-6 bg-white text-navy-950 space-y-4">
          <div className="flex items-center gap-2 text-terracotta-600 font-bold text-xs uppercase tracking-wider">
            <Calculator className="h-4 w-4" />
            Partner Estimator
          </div>
          <h2 className="text-xl font-extrabold">Estimate Your Monthly Partner Earnings</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <label htmlFor="host-daily-bags-range">Average Bags Stored / Day</label>
                <span className="tabular-nums">{dailyBags} bags</span>
              </div>
              <input
                id="host-daily-bags-range"
                type="range"
                min={5}
                max={60}
                value={dailyBags}
                aria-label="Average Bags Stored Per Day"
                onChange={(e) => setDailyBags(Number(e.target.value))}
                className="w-full h-2 accent-terracotta-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <label htmlFor="host-avg-fee-range">Average Rate / Bag</label>
                <span className="tabular-nums">{formatLkr(avgFeeLkr)}</span>
              </div>
              <input
                id="host-avg-fee-range"
                type="range"
                min={800}
                max={2500}
                step={100}
                value={avgFeeLkr}
                aria-label="Average Rate Per Bag in LKR"
                onChange={(e) => setAvgFeeLkr(Number(e.target.value))}
                className="w-full h-2 accent-terracotta-500 cursor-pointer"
              />
            </div>
          </div>
          <div className="rounded-xl bg-sand-50 border border-sand-200 p-4 space-y-1">
            <p className="text-xs text-sand-700">Estimated Monthly Host Share (85%)</p>
            <p className="text-2xl font-black text-navy-950 tabular-nums">{formatLkr(hostNetLkr)}</p>
          </div>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-extrabold text-navy-950">Why Host With Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-2 bg-white">
            <Building2 className="h-6 w-6 text-terracotta-600" />
            <h3 className="font-bold text-navy-950">KYB Verified Onboarding</h3>
            <p className="text-sm text-sand-700">
              Receive verified marketplace status once premises safety and ownership documents pass
              review.
            </p>
          </Card>
          <Card className="p-6 space-y-2 bg-white">
            <QrCode className="h-6 w-6 text-terracotta-600" />
            <h3 className="font-bold text-navy-950">20-Second Counter Check-In</h3>
            <p className="text-sm text-sand-700">
              Scan traveller QR codes or verify 6-digit backup PINs to assign racks and seal tags.
            </p>
          </Card>
          <Card className="p-6 space-y-2 bg-white">
            <ShieldCheck className="h-6 w-6 text-terracotta-600" />
            <h3 className="font-bold text-navy-950">Ledger-Backed Settlement</h3>
            <p className="text-sm text-sand-700">
              Track every booking, refund adjustment, and eligible payout batch directly from your
              host finance console.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}

export function HowItWorksPage() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "How Verified Custody Works — LuggageStorage";
    }
  }, []);

  const steps = [
    {
      step: "STEP 01",
      title: "Discover & Reserve Storage Online",
      body: "Browse verified hubs around transit stations with approximate neighborhood maps before checkout.",
      icon: Search
    },
    {
      step: "STEP 02",
      title: "Unlock Door Directions & Custody Pass",
      body: "Once payment settles or host approval confirms, unlock exact directions and a single-use QR pass with 6-digit fallback PIN.",
      icon: QrCode
    },
    {
      step: "STEP 03",
      title: "Drop Off & Apply Tamper-Evident Seals",
      body: "Counter staff verify your QR/PIN credential, tag each bag, apply tamper-evident seals, and log zone custody.",
      icon: Lock
    },
    {
      step: "STEP 04",
      title: "Present Collection Credential & Release",
      body: "Return with a fresh single-use collection pass to verify unbroken seals and release bags quickly.",
      icon: Camera
    }
  ];

  return (
    <div className="space-y-10 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <Badge variant="brand" size="md">
            Custody Protocol
          </Badge>
          <h1 className="text-3xl font-extrabold text-navy-950">
            How Our Custody &amp; Protection Protocol Works
          </h1>
          <p className="text-sm text-sand-700 leading-relaxed">
            Four deterministic verification stages connect online reservations with physical baggage
            custody.
          </p>
        </div>
        <MascotIllustration
          mascot="suitcase-walk"
          size="md"
          variant="bare"
          decorative
          className="shrink-0"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {steps.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card key={item.step} className="p-6 bg-white space-y-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-terracotta-100 text-terracotta-800 text-xs font-extrabold inline-flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-extrabold tracking-widest text-terracotta-600">
                    {item.step}
                  </span>
                </div>
                <Icon className="h-5 w-5 text-navy-800" />
              </div>
              <h2 className="text-lg font-extrabold text-navy-950">{item.title}</h2>
              <p className="text-sm text-sand-700 leading-relaxed">{item.body}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 sm:p-8 bg-navy-950 text-white space-y-4">
        <div className="flex items-center gap-2 text-terracotta-400 text-xs font-bold uppercase tracking-wider">
          <Scale className="h-4 w-4" />
          Mandatory Protection Policy
        </div>
        <h2 className="text-xl font-extrabold">Decoupled Luggage Return &amp; Overdue Resolution</h2>
        <p className="text-sm text-sand-200 max-w-3xl leading-relaxed">
          Hosts cannot arbitrarily retain personal travel documents or refuse baggage inspection due
          to minor schedule delays. Overdue time beyond the partner&apos;s grace period is logged
          transparently and resolved cleanly through platform custody records.
        </p>
        <div className="pt-2">
          <Link
            to="/search"
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm font-bold transition-colors"
          >
            <span>Find Storage</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    id: "faq-qr-pin",
    q: "What happens if counter QR scanning is unavailable or I lose signal?",
    a: "Every Digital Custody Pass pairs its encrypted single-use QR code with an offline 6-digit numeric fallback PIN. Read that 6-digit PIN directly to host staff to verify drop-off or collection."
  },
  {
    id: "faq-address-masking",
    q: "When is the exact street address revealed?",
    a: "To protect host counter privacy, discovery results display an approximate ~200–400m corridor until your booking is confirmed. Exact street address and entry directions unlock immediately on confirmation."
  },
  {
    id: "faq-refunds",
    q: "What is the cancellation and refund policy?",
    a: "Traveller cancellations more than 2 hours before drop-off qualify for a 100% refund. Cancellations within 2 hours before drop-off qualify for a 50% refund. Host or platform cancellations always receive 100%."
  },
  {
    id: "faq-oversized",
    q: "Are oversize surfboards, strollers, or cycling boxes accepted?",
    a: "Filter for 'Accepts Oversized' during discovery or inspect the location's capacity details. Only hubs flagged as oversized-capable allow oversized items at checkout."
  }
];

export function HelpCentreFaqPage() {
  const [filterText, setFilterText] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FAQ_ITEMS.map((item) => [item.id, true]))
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Help Centre & FAQs — LuggageStorage";
    }
  }, []);

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      !filterText.trim() ||
      item.q.toLowerCase().includes(filterText.toLowerCase()) ||
      item.a.toLowerCase().includes(filterText.toLowerCase())
  );

  const toggleFaq = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-terracotta-600">
          <HelpCircle className="h-4 w-4" />
          Traveller Support
        </div>
        <h1 className="text-3xl font-extrabold text-navy-950">
          Help Centre &amp; Frequently Asked Questions
        </h1>
        <Input
          id="faq-search-input"
          label="Search help topics"
          placeholder="Search PINs, refunds, privacy masking..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {filteredFaqs.length === 0 ? (
        <EmptyState
          mascot="thinking"
          title="No matching FAQ topics found"
          description="Try another search term or contact our Colombo Operations Desk directly."
          action={
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setFilterText("")}
            >
              Clear Search
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = Boolean(openIds[faq.id]);
            const panelId = `${faq.id}-panel`;
            return (
              <Card key={faq.id} className="bg-white overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full min-h-[56px] px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-sand-50/70 transition-colors"
                >
                  <h2 className="text-base font-extrabold text-navy-950">{faq.q}</h2>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-sand-700 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-sand-700 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div id={panelId} className="px-6 pb-5 pt-1 text-sm text-sand-700 leading-relaxed border-t border-sand-100">
                    {faq.a}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-6 bg-sand-100 border border-sand-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-navy-950">Still need help with an active booking?</h3>
          <p className="text-xs text-sand-700">
            Reach our Colombo desk or submit an exception report from your bookings portal.
          </p>
        </div>
        <Link
          to="/contact"
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
        >
          Contact Support
        </Link>
      </Card>
    </div>
  );
}

export function ContactUsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [category, setCategory] = useState<SupportTicketCategory>("GENERAL_INQUIRY");
  const [subject, setSubject] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<SupportTicketCreatedResponse | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  const createTicketMutation = useCreateSupportTicketMutation();
  const myTicketsQuery = useMySupportTicketsQuery({ enabled: isAuthenticated });
  const myTicketDetailQuery = useMySupportTicketDetailQuery(selectedTicketId ?? undefined, {
    enabled: isAuthenticated && Boolean(selectedTicketId)
  });
  const replyTicketMutation = useReplyMySupportTicketMutation();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Contact Customer Care — LuggageStorage";
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setName((prev) => prev || user.displayName || "");
      setEmail((prev) => prev || user.email || "");
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim() || "Customer Support Request";
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2 || !trimmedEmail || trimmedMessage.length < 10) {
      setValidationError(
        "Please enter your name, valid email address, and at least 10 characters describing your request."
      );
      return;
    }

    try {
      const created = await createTicketMutation.mutateAsync({
        requesterName: trimmedName,
        requesterEmail: trimmedEmail,
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        ...(bookingRef.trim() ? { bookingReference: bookingRef.trim() } : {})
      });
      setCreatedTicket(created);
      setSubject("");
      setMessage("");
      setBookingRef("");
      if (isAuthenticated) {
        setSelectedTicketId(created.id);
      }
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : "Unable to submit support request right now."
      );
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId) return;
    setReplyError(null);
    if (followUpMessage.trim().length < 2) {
      setReplyError("Enter a follow-up message before sending.");
      return;
    }
    try {
      await replyTicketMutation.mutateAsync({
        ticketId: selectedTicketId,
        data: { message: followUpMessage.trim() }
      });
      setFollowUpMessage("");
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : "Unable to post reply.");
    }
  };

  const myTickets = myTicketsQuery.data ?? [];
  const activeDetail = myTicketDetailQuery.data ?? null;

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <div className="space-y-2">
        <Badge variant="brand" size="md">
          24/7 Traveller Care
        </Badge>
        <h1 className="text-3xl font-extrabold text-navy-950">
          Contact Customer Care &amp; Support
        </h1>
        <p className="text-sm text-sand-700">
          For urgent active-custody issues, report an exception directly on your booking or submit
          a tracked support request to our Colombo operations desk.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-5 p-6 bg-white space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-navy-950">Colombo Operations Desk</h2>
            <MascotIllustration mascot="phone" size="sm" variant="bare" decorative />
          </div>

          <div className="space-y-3 text-sm text-sand-800">
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-terracotta-600 mt-1" />
              <div>
                <p className="font-bold text-navy-950">Hotline (24/7 Emergencies)</p>
                <a href="tel:+94112345678" className="font-mono text-terracotta-700 font-semibold">
                  +94 11 234 5678
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-terracotta-600 mt-1" />
              <div>
                <p className="font-bold text-navy-950">Operations Support Email</p>
                <a
                  href="mailto:support@luggagestorage.lk"
                  className="font-mono text-terracotta-700 font-semibold"
                >
                  support@luggagestorage.lk
                </a>
              </div>
            </div>
          </div>

          <Alert variant="info" title="Booking-Specific Issue?">
            Signed-in travellers can report damage, missing items, or collection delays directly on
            any confirmed reservation inside the{" "}
            <Link to="/portal/bookings" className="underline font-bold">
              Traveller Portal
            </Link>
            .
          </Alert>
        </Card>

        <Card className="lg:col-span-7 p-6 bg-white space-y-4">
          <h2 className="text-lg font-extrabold text-navy-950">Submit a Tracked Support Ticket</h2>

          {validationError && <Alert variant="danger">{validationError}</Alert>}

          {createdTicket ? (
            <Alert variant="success" title="Support Ticket Submitted">
              <p className="mb-3">
                Your inquiry is logged under reference{" "}
                <span className="font-mono font-bold text-navy-950">
                  {createdTicket.referenceCode}
                </span>{" "}
                ({SUPPORT_CATEGORY_LABELS[createdTicket.category] ?? createdTicket.category} • Priority{" "}
                {createdTicket.priority}). For urgent live handover help call{" "}
                <span className="font-mono font-semibold">+94 11 234 5678</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreatedTicket(null)}
                >
                  Submit Another Request
                </Button>
              </div>
            </Alert>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="contact-name"
                  label="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
                <Input
                  id="contact-email"
                  label="Reply Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  id="contact-category"
                  label="Inquiry Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                >
                  {SUPPORT_TICKET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {SUPPORT_CATEGORY_LABELS[cat] ?? cat}
                    </option>
                  ))}
                </Select>
                <Input
                  id="contact-booking-ref"
                  label="Booking Reference (Optional)"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  placeholder="e.g. LSB-20261115-..."
                />
              </div>
              <Input
                id="contact-subject"
                label="Subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your inquiry"
              />
              <Textarea
                id="contact-message"
                label="How can we help?"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share hub city, scheduled drop-off time, or question..."
              />
              <Button
                type="submit"
                variant="primary"
                isLoading={createTicketMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Submit Support Request
              </Button>
            </form>
          )}
        </Card>
      </div>

      {isAuthenticated && (
        <Card className="p-6 bg-white space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-sand-200 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-terracotta-600" />
              <h2 className="text-lg font-extrabold text-navy-950">
                Your Recent Support Tickets
              </h2>
            </div>
            <span className="text-xs text-sand-700 font-semibold">{myTickets.length} ticket(s)</span>
          </div>

          {myTicketsQuery.isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton className="h-16 w-full" />
              <LoadingSkeleton className="h-16 w-full" />
            </div>
          ) : myTicketsQuery.isError ? (
            <Alert variant="danger" title="Unable to Load Support Tickets">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {myTicketsQuery.error instanceof Error
                    ? myTicketsQuery.error.message
                    : "Could not load your support ticket history."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void myTicketsQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          ) : myTickets.length === 0 ? (
            <p className="text-xs text-sand-700">
              Tickets you submit while signed in appear here with live agent replies and status
              updates.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
              <div className="lg:col-span-5 space-y-2">
                {myTickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition min-h-[44px] ${
                      selectedTicketId === t.id
                        ? "border-terracotta-500 bg-terracotta-50/40"
                        : "border-sand-200 hover:bg-sand-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-navy-950">{t.referenceCode}</span>
                      <span className="px-2 py-0.5 rounded-full bg-sand-100 text-navy-800 font-bold text-[10px]">
                        {t.status}
                      </span>
                    </div>
                    <p className="font-bold text-navy-900 mt-1 truncate">{t.subject}</p>
                    <p className="text-[11px] text-sand-700 mt-0.5">
                      {SUPPORT_CATEGORY_LABELS[t.category] ?? t.category} • Updated{" "}
                      {formatDateTimeDisplay(t.lastMessageAt)}
                    </p>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-7">
                {!selectedTicketId ? (
                  <p className="text-sand-700">Select a ticket to inspect agent updates.</p>
                ) : myTicketDetailQuery.isLoading ? (
                  <div className="space-y-3 rounded-xl border border-sand-200 p-4">
                    <LoadingSkeleton variant="text" className="w-1/2" />
                    <LoadingSkeleton className="h-24 w-full" />
                  </div>
                ) : myTicketDetailQuery.isError ? (
                  <Alert variant="danger" title="Unable to Load Ticket Conversation">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        {myTicketDetailQuery.error instanceof Error
                          ? myTicketDetailQuery.error.message
                          : "Could not load conversation messages."}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void myTicketDetailQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  </Alert>
                ) : !activeDetail ? (
                  <p className="text-sand-700">Select a ticket to inspect agent updates.</p>
                ) : (
                  <div className="rounded-xl border border-sand-200 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-sand-100 pb-2">
                      <div>
                        <p className="font-mono font-bold text-navy-950">
                          {activeDetail.referenceCode}
                        </p>
                        <p className="font-bold text-navy-900">{activeDetail.subject}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-sand-100 text-navy-800 font-bold text-[10px]">
                        {activeDetail.status}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activeDetail.messages.map((m) => (
                        <div key={m.id} className="p-2.5 rounded-lg bg-sand-50 border border-sand-200">
                          <div className="flex justify-between text-[10px] text-sand-700 mb-1">
                            <span className="font-bold text-navy-900">
                              {m.senderDisplayName} ({m.senderRole})
                            </span>
                            <span>{formatDateTimeDisplay(m.createdAt)}</span>
                          </div>
                          <p className="text-navy-900 whitespace-pre-wrap">{m.body}</p>
                        </div>
                      ))}
                    </div>

                    {replyError && <Alert variant="danger">{replyError}</Alert>}

                    {activeDetail.status !== "CLOSED" && (
                      <form onSubmit={(e) => void handleReplySubmit(e)} className="flex gap-2">
                        <label htmlFor="support-followup-input" className="sr-only">
                          Add a follow-up message
                        </label>
                        <input
                          id="support-followup-input"
                          type="text"
                          value={followUpMessage}
                          onChange={(e) => setFollowUpMessage(e.target.value)}
                          placeholder="Add a follow-up message..."
                          className="flex-1 min-h-[44px] rounded-xl border border-sand-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="md"
                          isLoading={replyTicketMutation.isPending}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function TermsPrivacyLegalPage() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Terms, Privacy & Legal Charter — LuggageStorage";
    }
  }, []);

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-terracotta-600">
          <FileText className="h-4 w-4" />
          Legal Governance
        </div>
        <h1 className="text-3xl font-extrabold text-navy-950">
          Terms of Service, Privacy &amp; Legal Charter
        </h1>
        <p className="text-sm text-sand-700">
          Transparent marketplace governance, Sri Lanka PDPA privacy protections, and luggage
          custody standards.
        </p>

        {/* Quick Anchor Navigation */}
        <nav aria-label="Legal sections" className="flex flex-wrap gap-2 pt-1">
          <a
            href="#terms"
            className="min-h-[40px] inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-sand-200 text-xs font-bold text-navy-900 hover:bg-sand-100 transition-colors"
          >
            Marketplace Terms
          </a>
          <a
            href="#privacy"
            className="min-h-[40px] inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-sand-200 text-xs font-bold text-navy-900 hover:bg-sand-100 transition-colors"
          >
            Privacy &amp; PDPA
          </a>
          <a
            href="#custody"
            className="min-h-[40px] inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-sand-200 text-xs font-bold text-navy-900 hover:bg-sand-100 transition-colors"
          >
            Custody Charter
          </a>
        </nav>
      </div>

      <Card id="terms" className="p-6 bg-white space-y-3 scroll-mt-24">
        <h2 className="text-lg font-extrabold text-navy-950">Marketplace Terms of Service</h2>
        <p className="text-sm text-sand-700 leading-relaxed">
          LuggageStorage acts as an independent digital booking and ledger-backed marketplace
          settlement facilitator between travellers and verified hospitality storage hosts in Sri
          Lanka. All booking totals, cancellation tiers, and LKR receipts are calculated
          authoritatively on the platform.
        </p>
      </Card>

      <Card id="privacy" className="p-6 bg-white space-y-3 scroll-mt-24">
        <h2 className="text-lg font-extrabold text-navy-950">Privacy &amp; PDPA Policy</h2>
        <p className="text-sm text-sand-700 leading-relaxed">
          Location addresses remain masked to approximate transit zones prior to confirmed payment.
          Custody pass tokens are cryptographically hashed and expire cleanly after 15 minutes or
          single counter verification.
        </p>
      </Card>

      <Card id="custody" className="p-6 bg-white space-y-3 scroll-mt-24">
        <h2 className="text-lg font-extrabold text-navy-950">
          Custody &amp; Mandatory Release Charter
        </h2>
        <p className="text-sm text-sand-700 leading-relaxed">
          Verified partner hosts acknowledge decoupled luggage return rules: travellers present
          single-use release credentials at collection, and any overdue duration outside grace
          windows is recorded transparently within booking exception logs.
        </p>
      </Card>

      <Card className="p-6 bg-sand-100 border border-sand-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-navy-950">Questions about custody or privacy rules?</h3>
          <p className="text-xs text-sand-700">
            Browse our traveller FAQ or open a tracked inquiry with our Colombo desk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/help"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl border border-sand-300 bg-white text-navy-900 text-xs font-bold hover:bg-sand-50 transition-colors"
          >
            Help Centre
          </Link>
          <Link
            to="/contact"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </Card>
    </div>
  );
}
