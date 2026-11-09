# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 07: Brand Character & Mascot Personality Audit

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-007`  
**Brand Character:** "Kiri" the Sri Lankan Palm Squirrel (*Funambulus palmarum*)  
**Source Asset Location:** `Assets/` (Canonical 20 PNG Files preserved untouched)  
**Date:** November 9, 2026

---

### 1. Mascot Library Inventory & Technical Analysis

The project contains a professionally illustrated library of **20 distinct PNG illustrations** depicting the brand character "Kiri", a friendly Sri Lankan palm squirrel wearing a signature navy-blue crossbody luggage tag satchel.

#### 1.1 Technical Asset Specifications

- **Format:** Uncompressed 24-bit PNG with alpha transparency channel.
- **Resolution:** Uniformly rendered at $2048 \times 2048$ pixels.
- **Individual File Size:** Ranging from $1,290,800$ bytes ($1.29$ MB) to $1,625,109$ bytes ($1.63$ MB).
- **Total Library Payload:** **$29,540,652$ bytes ($29.54$ MB)** across the 20 files.
- **Critical Performance Finding:** In both Web (`apps/web/public/assets/mascots/`) and Mobile (`apps/mobile/assets/mascots/`), full-resolution 1.5MB PNGs are loaded directly over the network to render small $64\times 64$px or $128\times 128$px badges. This causes unacceptable layout shift (CLS), high data usage for international roaming tourists, and slow first-contentful-paint (FCP).

---

### 2. Complete 20-Mascot Character Roster & Usage Inventory

| Asset Filename | Pose & Character Action | Emotional Tone | Intended Brand Role | Current Application Usage | Contextual Suitability |
|---|---|---|---|---|:---:|
| `LS-mascot_01_wave.png` | Waving right paw with warm, friendly smile | Welcoming, open, hospitable | App splash, initial onboarding, homepage hero | `TM-001`, `TM-002`, `PW-001`, `HM-001` | **HIGH** (Excellent brand greeting) |
| `LS-mascot_02_suitcase-walk.png` | Striding briskly pulling a rolling navy suitcase | Active, purposeful, travel-ready | How-it-works, travel search, portal | `PW-007`, `TM-011`, `PW-011` | **HIGH** (Perfect for hands-free travel) |
| `LS-mascot_03_suitcase-peek.png` | Peeking curiously from behind a large suitcase | Inquisitive, playful, gentle | Empty states (no bookings, no saved items) | `TM-035`, `TM-036`, `HD-007` | **HIGH** (Warm empty-state companion) |
| `LS-mascot_04_blank-tag.png` | Holding up a blank luggage tag with both paws | Transparent, detail-oriented | Pricing breakdown, tag inspection, promos | `TM-018`, `PW-004`, `HD-006`, `AD-015` | **HIGH** (Directly reinforces bag tagging) |
| `LS-mascot_05_pointing.png` | Pointing upward/right with an encouraging smile | Informative, helpful, guiding | Permissions prompt, setup tips, language | `TM-003`, `TM-004`, `HM-009`, `AD-016` | **MODERATE** (Overused across admin settings) |
| `LS-mascot_06_thinking.png` | Finger on chin looking upward thoughtfully | Analytical, contemplative, inquisitive | Help FAQs, search filters, support triage | `PW-008`, `TM-014`, `TM-039`, `AD-011` | **HIGH** (Helpful for FAQ and filters) |
| `LS-mascot_07_sleeping.png` | Curled up asleep on a pillow with "Zzz" | Peaceful, quiet, resting | Notification inbox empty, closed store hours | `TM-037`, `HM-010`, `HD-004` | **HIGH** (Great for "All caught up" inboxes) |
| `LS-mascot_08_phone.png` | Holding up smartphone displaying screen | Connected, verified, prompt | Phone/OTP verification, contact, QR scan | `TM-008`, `PW-009`, `TM-028`, `HM-021` | **HIGH** (Directly reinforces mobile QR/PIN) |
| `LS-mascot_09_jump.png` | Leaping in mid-air with outstretched arms | Celebratory, triumphant, joyous | Booking confirmed, bag collection complete | `TM-024`, `PW-005`, `HM-025`, `AD-009` | **HIGH** (High-emotion celebratory moments) |
| `LS-mascot_10_map.png` | Holding and studying an unfolded travel map | Exploratory, navigational, adventurous | Geospatial map discovery, location directions | `TM-012`, `PW-002`, `HD-002`, `AD-004` | **HIGH** (Ideal for map exploration) |
| `LS-mascot_11_sun-hat.png` | Wearing a tropical straw hat with luggage | Relaxed, holiday, leisurely | Holiday calendar, Sri Lanka regional hubs | `TM-013`, `HM-011` | **HIGH** (Communicates tropical island vibe) |
| `LS-mascot_12_high-five.png` | Raising paw for an energetic high-five | Collaborative, appreciative, partner | Become a host, review submission, thanks | `PW-006`, `TM-034`, `HM-035`, `HD-012` | **HIGH** (Excellent for host partnership) |
| `LS-mascot_13_alarm-clock.png` | Holding a ringing twin-bell alarm clock | Alert, urgent, punctual | 15-minute host SLA queue, overdue alert | `HM-018`, `HM-026`, `TM-030`, `AD-008` | **MODERATE** (Effective for SLA; too cute for overdue fines) |
| `LS-mascot_14_key.png` | Holding a golden key upright | Secure, protective, confidential | Account login, security update, RBAC | `TM-005`, `TM-043`, `HM-002`, `AD-018` | **MODERATE** (Suitable for login; awkward in admin RBAC) |
| `LS-mascot_15_suitcase-hug.png` | Hugging a suitcase with eyes closed in affection | Trustworthy, caring, protective | In-storage live custody, luggage guarantee | `TM-027`, `TM-029`, `PW-003`, `AD-005` | **HIGH** (Strongest visual metaphor for safe custody) |
| `LS-mascot_16_selfie.png` | Holding a camera taking a photo | Attentive, evidence-gathering | KYC document upload, bag inspection photo | `HM-004`, `HM-022`, `HM-023`, `AD-002` | **MODERATE** (A selfie pose feels casual for KYC identity) |
| `LS-mascot_17_king-coconut.png` | Sipping a fresh orange Thambili with straw | Carefree, refreshed, hands-free | Hero companion, relaxation during storage | `PW-001`, `TM-029`, `HM-029`, `TM-044` | **HIGH** (Distinctive Sri Lankan cultural icon) |
| `LS-mascot_18_salute.png` | Standing at attention delivering a crisp salute | Dutiful, compliant, professional | Host operational counter, platform command | `HM-006`, `HD-001`, `AD-001`, `PW-010` | **MODERATE** (Effective for host counter; too casual for superadmin) |
| `LS-mascot_19_shrug.png` | Shrugging with open paws and apologetic grin | Empathetic, apologetic, humble | Payment declined, 404 not found, dispute | `TM-023`, `TM-031`, `HM-028`, `AD-013` | **POOR in AD-013** (Trivializes lost luggage disputes) |
| `LS-mascot_20_sitting-suitcase.png` | Sitting patiently atop luggage resting chin | Patient, calm, awaiting | Pending host approval, payment polling | `TM-021`, `TM-022`, `HM-005`, `TM-033` | **HIGH** (Perfect visual for waiting states) |

---

### 3. Current Implementation Deficiencies & Mascot Anti-Patterns

1. **Repetitive "Stamp" Placement:**
   On virtually every web and mobile screen, the mascot is inserted as a static header badge inside a uniform yellow container (`bg-amber-50 border border-amber-200 p-4`) alongside a generic caption. It functions as a repetitive rubber stamp rather than a contextual conversational guide.
2. **Contextual Inappropriateness in High-Gravity Workflows:**
   - In `AD-013` (Custody Incident & Dispute Investigation), where platform administrators adjudicate serious claims regarding stolen, lost, or damaged passenger luggage, Kiri is shown shrugging (`LS-mascot_19_shrug.png`) alongside the text "OQ-015 / BR-035 Enforcement". This conveys amateurism and callousness during legal disputes.
   - In `TM-023` (Payment Failed), displaying a playful shrugging squirrel when a traveller's credit card fails at an overseas airport causes customer frustration.
3. **Payload Bloat & Lack of Optimization:**
   The 20 raw PNG files consume 29.5MB. They have not been compressed, converted to modern formats (WebP/AVIF), or compiled into an SVG/CSS sprite sheet.

---

### 4. Strategic Mascot Guidelines & Brand Principles

The mascot must be treated with the same intentionality as Duolingo's "Duo" or Mailchimp's "Freddie": **a personality that guides and celebrates, but steps aside during high-stress operational moments.**

#### 4.1 Golden Rules for Kiri's Deployment

1. **Celebrate Success & Milestones:** Appear prominently during joyous moments—booking confirmation (`MASCOT-09 jump`), review submission (`MASCOT-12 high-five`), and first-time onboarding completion.
2. **Transform Empty States into Delight:** Use Kiri peeking behind a suitcase (`MASCOT-03`) or sleeping peacefully (`MASCOT-07`) to reassure travellers when lists, notifications, or booking histories are currently empty.
3. **Clarify Unfamiliar Concepts:** Use Kiri holding a luggage tag (`MASCOT-04`) to explain tamper-evident seal numbering, or studying a map (`MASCOT-10`) to introduce transit hub radius searching.
4. **Strict "Zero Mascot" Zones:** Kiri must **never** appear in:
   - Payment gateway entry or credit card processing forms.
   - Real-time fraud detection and security audit event logs (`AD-017`).
   - Formal luggage damage, theft, or police report incident investigations (`AD-013`).
   - Host payout bank account credential entry forms (`HD-011`).

---

### 5. Recommended WebP Optimization Strategy (Non-Destructive)

To maintain strict compliance with Constraint 3 ("Do not replace, regenerate, delete, rename, or modify mascot PNG assets"), the original 20 PNG files in `Assets/` must remain permanently untouched.

During the Phase 2C redesign implementation:
1. Generate an optimized derivative asset folder: `apps/web/public/assets/mascots/optimized/` and `apps/mobile/assets/mascots/optimized/`.
2. Convert PNGs into losslessly compressed WebP images with dual resolutions:
   - `@1x` (128px): $\approx 12$ KB per image.
   - `@2x` (256px for Retina): $\approx 35$ KB per image.
3. Total library bundle size will decrease from **29.5 MB $\rightarrow$ 850 KB (a 97.1% bandwidth reduction)**, radically boosting mobile web performance.
