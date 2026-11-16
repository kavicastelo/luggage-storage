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
  Send
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
import { Input } from "@/components/ui/Input";
import { formatLkr } from "@/data/mock-marketplace";
import {
  useCreateSupportTicketMutation,
  useMySupportTicketDetailQuery,
  useMySupportTicketsQuery,
  useReplyMySupportTicketMutation
} from "@/hooks/queries/use-support-tickets";
import { formatDateTimeDisplay } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";

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
          <Badge variant="brand" size="md">
            Sri Lanka Partner Network
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
            Monetize Unused Space Into Predictable Partner Revenue
          </h1>
          <p className="text-sand-200 text-base">
            Hotels, transit cafes, and retail counters keep 85% net revenue on every completed
            storage booking with digital custody logs and transparent bi-monthly settlement ledgers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={hostCtaTo}
              className="px-5 py-3 rounded-xl bg-terracotta-500 text-white text-sm font-bold hover:bg-terracotta-600"
            >
              {hostCtaLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="px-5 py-3 rounded-xl bg-white/10 border border-white/25 text-white text-sm font-bold hover:bg-white/20"
              >
                Create Partner Account
              </Link>
            )}
            <Link
              to="/how-it-works"
              className="px-5 py-3 rounded-xl border border-white/25 text-white text-sm font-bold hover:bg-white/10"
            >
              Review Counter Workflow
            </Link>
          </div>
        </div>

        <Card className="lg:col-span-5 p-6 bg-white text-navy-950 space-y-4">
          <div className="flex items-center gap-2 text-terracotta-600 font-bold text-xs uppercase tracking-wider">
            <Calculator className="h-4 w-4" />
            Partner Estimator
          </div>
          <h2 className="text-xl font-extrabold">Estimate Your Monthly Partner Earnings</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Average Bags Stored / Day</span>
                <span>{dailyBags} bags</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                value={dailyBags}
                onChange={(e) => setDailyBags(Number(e.target.value))}
                className="w-full accent-terracotta-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Average Rate / Bag</span>
                <span>{formatLkr(avgFeeLkr)}</span>
              </div>
              <input
                type="range"
                min={800}
                max={2500}
                step={100}
                value={avgFeeLkr}
                onChange={(e) => setAvgFeeLkr(Number(e.target.value))}
                className="w-full accent-terracotta-500"
              />
            </div>
          </div>
          <div className="rounded-xl bg-sand-50 border border-sand-200 p-4 space-y-1">
            <p className="text-xs text-sand-700">Estimated Monthly Host Share (85%)</p>
            <p className="text-2xl font-black text-navy-950">{formatLkr(hostNetLkr)}</p>
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
      <div className="space-y-2 max-w-3xl">
        <Badge variant="brand" size="md">
          Custody Protocol
        </Badge>
        <h1 className="text-3xl font-extrabold text-navy-950">
          How Our Custody &amp; Protection Protocol Works
        </h1>
        <p className="text-sm text-sand-700">
          Four deterministic verification stages connect online reservations with physical baggage
          custody.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.step} className="p-6 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold tracking-widest text-terracotta-600">
                  {item.step}
                </span>
                <Icon className="h-5 w-5 text-navy-800" />
              </div>
              <h2 className="text-lg font-extrabold text-navy-950">{item.title}</h2>
              <p className="text-sm text-sand-700">{item.body}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 sm:p-8 bg-navy-950 text-white space-y-3">
        <div className="flex items-center gap-2 text-terracotta-400 text-xs font-bold uppercase tracking-wider">
          <Scale className="h-4 w-4" />
          Mandatory Protection Policy
        </div>
        <h2 className="text-xl font-extrabold">Decoupled Luggage Return &amp; Overdue Resolution</h2>
        <p className="text-sm text-sand-200 max-w-3xl">
          Hosts cannot arbitrarily retain personal travel documents or refuse baggage inspection due
          to minor schedule delays. Overdue time beyond the partner&apos;s grace period is logged
          transparently and resolved cleanly through platform custody records.
        </p>
      </Card>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "What happens if counter QR scanning is unavailable or I lose signal?",
    a: "Every Digital Custody Pass pairs its encrypted single-use QR code with an offline 6-digit numeric fallback PIN. Read that 6-digit PIN directly to host staff to verify drop-off or collection."
  },
  {
    q: "When is the exact street address revealed?",
    a: "To protect host counter privacy, discovery results display an approximate ~200–400m corridor until your booking is confirmed. Exact street address and entry directions unlock immediately on confirmation."
  },
  {
    q: "What is the cancellation and refund policy?",
    a: "Traveller cancellations more than 2 hours before drop-off qualify for a 100% refund. Cancellations within 2 hours before drop-off qualify for a 50% refund. Host or platform cancellations always receive 100%."
  },
  {
    q: "Are oversize surfboards, strollers, or cycling boxes accepted?",
    a: "Filter for 'Accepts Oversized' during discovery or inspect the location's capacity details. Only hubs flagged as oversized-capable allow oversized items at checkout."
  }
];

export function HelpCentreFaqPage() {
  const [filterText, setFilterText] = useState("");

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
          label="Search help topics"
          placeholder="Search PINs, refunds, privacy masking..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredFaqs.map((faq) => (
          <Card key={faq.q} className="p-6 bg-white space-y-2">
            <h2 className="text-base font-extrabold text-navy-950">{faq.q}</h2>
            <p className="text-sm text-sand-700">{faq.a}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-sand-100 border border-sand-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-navy-950">Still need help with an active booking?</h3>
          <p className="text-xs text-sand-700">
            Reach our Colombo desk or submit an exception report from your bookings portal.
          </p>
        </div>
        <Link
          to="/contact"
          className="px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
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
          <h2 className="text-lg font-extrabold text-navy-950">Colombo Operations Desk</h2>
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
                ({createdTicket.category} • Priority {createdTicket.priority}). For urgent live
                handover help call{" "}
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
                  label="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
                <Input
                  label="Reply Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-navy-900 mb-1.5">
                    Inquiry Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                    className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                  >
                    {SUPPORT_TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Booking Reference (Optional)"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  placeholder="e.g. LSB-20261115-..."
                />
              </div>
              <Input
                label="Subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your inquiry"
              />
              <div>
                <label className="block text-sm font-semibold text-navy-900 mb-1.5">
                  How can we help?
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share hub city, scheduled drop-off time, or question..."
                  className="w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>
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

          {myTickets.length === 0 ? (
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
                    className={`w-full text-left p-3.5 rounded-xl border transition ${
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
                      {t.category} • Updated {formatDateTimeDisplay(t.lastMessageAt)}
                    </p>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-7">
                {!activeDetail ? (
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
                        <input
                          type="text"
                          value={followUpMessage}
                          onChange={(e) => setFollowUpMessage(e.target.value)}
                          placeholder="Add a follow-up message..."
                          className="flex-1 rounded-xl border border-sand-300 px-3 py-2 text-xs"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
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
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-terracotta-600">
          <FileText className="h-4 w-4" />
          Legal Governance
        </div>
        <h1 className="text-3xl font-extrabold text-navy-950">
          Terms of Service, Privacy &amp; Legal Charter
        </h1>
      </div>

      <Card className="p-6 bg-white space-y-3">
        <h2 className="text-lg font-extrabold text-navy-950">Marketplace Terms of Service</h2>
        <p className="text-sm text-sand-700">
          LuggageStorage acts as an independent digital booking and ledger-backed marketplace
          settlement facilitator between travellers and verified hospitality storage hosts in Sri
          Lanka.
        </p>
      </Card>

      <Card className="p-6 bg-white space-y-3">
        <h2 className="text-lg font-extrabold text-navy-950">Privacy &amp; PDPA Policy</h2>
        <p className="text-sm text-sand-700">
          Location addresses remain masked to approximate transit zones prior to confirmed payment.
          Custody pass tokens are cryptographically hashed and expire cleanly after 15 minutes or
          single counter verification.
        </p>
      </Card>

      <Card className="p-6 bg-white space-y-3">
        <h2 className="text-lg font-extrabold text-navy-950">
          Custody &amp; Mandatory Release Charter
        </h2>
        <p className="text-sm text-sand-700">
          Verified partner hosts acknowledge decoupled luggage return rules: travellers present
          single-use release credentials at collection, and any overdue duration outside grace
          windows is recorded transparently within booking exception logs.
        </p>
      </Card>
    </div>
  );
}
