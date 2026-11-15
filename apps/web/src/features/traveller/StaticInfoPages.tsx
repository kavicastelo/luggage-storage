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
  Calculator
} from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatLkr } from "@/data/mock-marketplace";

export function BecomeAHostLandingPage() {
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
              to="/host"
              className="px-5 py-3 rounded-xl bg-terracotta-500 text-white text-sm font-bold hover:bg-terracotta-600"
            >
              Apply to Host in Sri Lanka
            </Link>
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [preparedMailto, setPreparedMailto] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Contact Customer Care — LuggageStorage";
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setValidationError("Please complete your name, email address, and inquiry details.");
      return;
    }

    const subject = bookingRef.trim()
      ? `LuggageStorage Support — Booking ${bookingRef.trim()}`
      : "LuggageStorage Customer Support Request";

    const bodyLines = [
      `Name: ${name.trim()}`,
      `Reply Email: ${email.trim()}`,
      bookingRef.trim() ? `Booking Reference: ${bookingRef.trim()}` : null,
      "",
      message.trim()
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const mailtoHref = `mailto:support@luggagestorage.lk?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(bodyLines)}`;

    setPreparedMailto(mailtoHref);
    if (typeof window !== "undefined") {
      window.location.href = mailtoHref;
    }
  };

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
          For urgent active-custody issues, report an exception directly on your booking or contact
          our Colombo operations team immediately.
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
          <h2 className="text-lg font-extrabold text-navy-950">Prepare Direct Email Inquiry</h2>

          {validationError && <Alert variant="danger">{validationError}</Alert>}

          {preparedMailto ? (
            <Alert variant="success" title="Email Draft Ready">
              <p className="mb-3">
                Your inquiry is addressed to{" "}
                <span className="font-mono font-semibold">support@luggagestorage.lk</span>. If your
                mail app did not open automatically, click below or call{" "}
                <span className="font-mono font-semibold">+94 11 234 5678</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={preparedMailto}
                  className="px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
                >
                  Open Email Client
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreparedMailto(null)}
                >
                  Edit Message
                </Button>
              </div>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Input
                label="Booking Reference (Optional)"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="e.g. LSB-20261115-..."
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
              <Button type="submit" variant="primary">
                <CheckCircle2 className="h-4 w-4" />
                Submit Support Request
              </Button>
            </form>
          )}
        </Card>
      </div>
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
