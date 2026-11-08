# Navigation and User Journey Maps

**Project:** Global Luggage Storage Marketplace  
**Document Type:** UX Architecture & User Journey Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** FRS, Technical Blueprint Section 6, Master Screen Registry (`master-screen-registry.md`), Screen-to-Workflow Matrix (`screen-to-workflow-matrix.md`).

---

## 1. Executive Summary & Flow Conventions

This document maps the primary and secondary navigation flows, operational loops, exception branches, and error recovery paths across the marketplace.

### Architectural Journey Principles:
1. **End-to-End Resilience:** Every user journey explicitly models failure paths (e.g., payment declined, capacity conflict, host rejection, overdue bags, disputed fees, refund failure).
2. **Decoupled Handover Recovery:** Luggage handover can complete safely even under cellular network disconnects via offline QR/PIN caching and store-and-forward sync.
3. **The No Possessory Lien Invariant:** The collection journey strictly separates bag release from disputed fee collection (`BR-035`, `BR-061`).

---

## 2. Core Traveller Journeys

### 2.1 Journey 1: Anonymous Visitor to Registration & Booking

```mermaid
flowchart TD
    Start([App Launch / Web Visit]) --> Splash[TM-001 / PW-001 Splash/Home]
    Splash --> Search[TM-011 / PW-002 Search Destination]
    Search --> Results[TM-012/013 / PW-002 Map & Listing Cards]
    
    Results --> Filter{Filter Applied?}
    Filter -- Yes --> ApplyFilter[TM-014 Select Amenities/Size]
    ApplyFilter --> Results
    Filter -- No --> ViewDetail[TM-015 / PW-003 Location Details]
    
    ViewDetail --> SelectDates[TM-017 / PW-004 Select Drop-off & Collection]
    SelectDates --> SelectBags[TM-018 / PW-004 Select Bag Quantities]
    SelectBags --> CalcPrice[TM-019 / PW-004 Price Breakdown]
    
    CalcPrice --> AuthCheck{User Authenticated?}
    AuthCheck -- No --> LoginPrompt[TM-005 Login / Register Modal]
    LoginPrompt --> Register[TM-006 Enter Email/Phone]
    Register --> OTP[TM-008 Verify OTP]
    OTP --> ReturnCheckout[TM-019 Ready to Reserve]
    AuthCheck -- Yes --> ReturnCheckout
```

---

### 2.2 Journey 2: Instant Booking vs. Host Approval Checkout & Payment

```mermaid
flowchart TD
    Checkout[TM-019 / PW-004 Checkout Screen] --> ModeCheck{Booking Mode?}
    
    %% Instant Booking Path
    ModeCheck -- INSTANT --> ReserveHold[Atomic DB Capacity Hold - 10m TTL]
    ReserveHold --> Gateway[TM-020 / PW-005 PayHere Hosted Checkout]
    
    %% Host Approval Path
    ModeCheck -- HOST_APPROVAL --> SubmitReq[TM-022 Request Sent to Host - 15m SLA]
    SubmitReq --> HostDecision{Host Action within 15m?}
    HostDecision -- Reject --> HostRej[TM-022 Rejected: Capacity Released]
    HostDecision -- Timeout --> Expired[TM-022 Expired: Auto-Cancelled]
    HostDecision -- Accept --> PayTimer[TM-019 Payment Link Active - 10m SLA]
    PayTimer --> Gateway
    
    %% Payment Processing
    Gateway --> PayAction{Gateway Result?}
    PayAction -- Failed / Declined --> PayFail[TM-023 Payment Failed Screen]
    PayFail --> Retry{Retry?}
    Retry -- Yes --> Gateway
    Retry -- No --> CancelHold[Capacity Released]
    
    PayAction -- Success / Webhook Verified --> Confirm[TM-024 / PW-005 Booking Confirmed Voucher]
    Confirm --> Active[TM-027 Active Booking Hub with QR & PIN]
```

---

### 2.3 Journey 3: Check-in, Bag Storage & Handover

```mermaid
flowchart TD
    Arrive[Traveller Arrives at Location] --> OpenPass[TM-028 Open Check-in Pass with QR & PIN]
    OpenPass --> HostScan[Host Opens HM-021 Scanner]
    
    HostScan --> ScanResult{QR Valid?}
    ScanResult -- No --> FallbackPIN[HM-021 Host Enters 6-digit PIN]
    FallbackPIN --> CheckStatus
    ScanResult -- Yes --> CheckStatus{Status Confirmed?}
    
    CheckStatus -- No --> ErrorModal[HM-021 Invalid Booking Status]
    CheckStatus -- Yes --> InspectBags[HM-022 Verify Bag Count & Sizes]
    
    InspectBags --> BagMismatch{Bags Match Booking?}
    BagMismatch -- Discrepancy --> AdjustLine[HM-022 Log Authorized Exception / Adjust]
    AdjustLine --> PhotoDoc
    BagMismatch -- Matches --> PhotoDoc[HM-023 Configurable Photo Evidence Capture]
    
    PhotoDoc --> CommitCheckin[Host Taps Confirm Handover]
    CommitCheckin --> TransCustody[Custody Transferred: Status IN_STORAGE]
    TransCustody --> AlertTraveller[TM-029 Traveller App Updates: Luggage Safe]
```

---

### 2.4 Journey 4: Collection, Overdue Handling & Decoupled Release

```mermaid
flowchart TD
    ReturnTraveller[Traveller Returns to Collect Luggage] --> PresentCheckout[TM-030 Present Collection QR / PIN Fallback]
    PresentCheckout --> HostScanOut[Host Scans QR or Enters PIN Fallback via HM-024]
    
    HostScanOut --> TimeCheck{Collection Time Window?}
    TimeCheck -- On Time / Within Configurable Grace Period --> ReleaseBags[HM-025 Reconcile Bag Count & Hand Over Bags]
    
    TimeCheck -- Overdue Past Configurable Grace --> OverdueNotice[HM-026 Overdue Alert Screen]
    OverdueNotice --> GenCharge[HM-027 Request In-App Overdue Fee per Disclosed Policy]
    GenCharge --> TravPayPrompt[TM-029 Traveller Prompted to Pay Overdue In-App]
    
    TravPayPrompt --> OverduePaymentDecision{Traveller Pays Overdue Fee?}
    OverduePaymentDecision -- Paid Online --> ReleaseBags
    OverduePaymentDecision -- Refuses / Disputes --> DecoupledRelease[HM-028 Disputed Release Handover]
    
    DecoupledRelease --> ReleaseBags
    Note over DecoupledRelease,ReleaseBags: INVARIANT: Host MUST Release Bags! No Hostage Luggage!
    DecoupledRelease --> SupportFlag[System Flags Account & Logs Support Incident]
    
    ReleaseBags --> MarkComplete[HM-025 Booking Completed]
    MarkComplete --> ReviewPrompt[TM-034 Traveller Promoted to Leave Review]
    MarkComplete --> AccrueEarnings[Finance Domain: 85% Host Payable Accrued]
```

---

## 3. Host Partner Journeys

### 3.1 Journey 5: Host Onboarding, KYC & Approval

```mermaid
flowchart TD
    StartHost[Host Visits Become a Host] --> RegHost[HM-002 / PW-006 Host Registration]
    RegHost --> BizDetails[HM-003 / HD-014 Business Entity & Legal Name]
    BizDetails --> BankDetails[HM-003 / HD-014 Payout Bank Account]
    BizDetails --> UploadDocs[HM-004 / HD-014 Upload National ID, BR, Utility Bill]
    
    UploadDocs --> SubmitKYC[HM-005 Application Status: PENDING_REVIEW]
    SubmitKYC --> AdminQueue[AD-002 Superadmin KYC Review Queue]
    
    AdminQueue --> AdminDecision{Superadmin Verification Decision}
    AdminDecision -- Reject --> RejHost[HM-005 Rejection Notice with Remedial Steps]
    RejHost --> UploadDocs
    AdminDecision -- Approve --> ApprHost[HM-005 Application Approved!]
    ApprHost --> EnterDashboard[HM-006 / HD-001 Host Operations Dashboard]
```

---

### 3.2 Journey 6: Location Setup, Capacity & Schedule Configuration

```mermaid
flowchart TD
    Dashboard[HD-001 Host Dashboard] --> NewLoc[HD-002 Add Storage Location]
    NewLoc --> BasicInfo[HD-003 Enter Address, GPS Pin, Photos, Amenities]
    BasicInfo --> Schedule[HD-004 Configure Weekly Opening Hours]
    Schedule --> Exceptions[HD-004 Add Holiday Closures / Poya Days]
    
    Exceptions --> Zones[HD-005 Setup Storage Zones e.g., Front Desk Locker, Backroom]
    Zones --> Quotas[HD-005 Configure Bag Capacity Limits & Oversized Opt-In]
    Quotas --> Rates[HD-006 Set Base Storage Rate in LKR & Category Multipliers]
    
    Rates --> SubmitReview[Location Submitted for Moderation]
    SubmitReview --> SuperReview[AD-004 Superadmin Moderates & Activates Location]
    SuperReview --> LiveSearch[Location Indexed in PostGIS Live Search!]
```

---

## 4. Superadmin & Platform Governance Journeys

### 4.1 Journey 7: Host Payout Run & Manual Bank Disbursement

```mermaid
flowchart TD
    FinPeriod[Scheduled / Ad-hoc Payout Cut-off] --> OpenBatches[AD-008 Host Payout Batches View]
    OpenBatches --> ScanEligible[System Scans for host_payables with status=ELIGIBLE]
    ScanEligible --> GenBatch[AD-008 Superadmin Clicks Generate Payout Batch]
    
    GenBatch --> ExportCSV[Download Payout Banking File with Account & Branch Codes]
    ExportCSV --> BankTransfer[Superadmin Executes Bulk Bank Transfer via Corporate Banking]
    
    BankTransfer --> RecordResult{Bank Transfer Completed?}
    RecordResult -- Success --> LogRef[AD-009 Enter Bank Reference Numbers]
    LogRef --> MarkDisbursed[System Updates Payout to COMPLETED & Debits Ledger]
    MarkDisbursed --> NotifyHosts[HM-031 / HD-011 Hosts Receive Payout Advice Receipt]
    
    RecordResult -- Transfer Failed --> FlagFailed[AD-009 Flag Payout as FAILED with Bank Error Code]
    FlagFailed --> ReturnEligible[Payable Returned to Host Balance for Account Correction]
```

---

### 4.2 Journey 8: Customer Dispute & Incident Resolution

```mermaid
flowchart TD
    DisputeTrigger[Customer or Host Logs Ticket] --> TriageQueue[AD-011 Support Ticket Queue]
    TriageQueue --> AgentAssign[Support Agent Assigned to Ticket]
    AgentAssign --> ReviewContext[AD-012 Inspect Booking, Custody Photos, Timeline]
    
    ReviewContext --> ActionRequired{Resolution Action Required?}
    ActionRequired -- General Question --> Reply[AD-012 Send In-App / Email Message]
    ActionRequired -- Damage / Loss Incident --> Escalate[AD-013 Escalate to Superadmin Investigation]
    
    Escalate --> ClaimEval{Approve Insurance / Goodwill Claim?}
    ClaimEval -- Denied --> CloseIncident[AD-013 Record Decision & Notify User]
    ClaimEval -- Approved --> IssueRefund[AD-007 Superadmin Authorizes Refund / Credit]
    
    IssueRefund --> GatewayRefund[Payment Provider API Dispatches Refund]
    GatewayRefund --> LedgerAdj[Finance Ledger Entries Updated]
    LedgerAdj --> CloseIncident
```
