import { expect, test } from "@playwright/test";
import { API_BASE, createActivatedUser, loginViaUi } from "./fixtures";

test.describe("Journey 5 — Support Ticket End-to-End Lifecycle", () => {
  test("traveller submits ticket, support agent assigns and replies, traveller sees reply, and unrelated user is denied", async ({
    browser,
    page
  }) => {
    const traveller = await createActivatedUser("TRAVELLER", "Ticket Traveller");
    const unrelatedUser = await createActivatedUser("TRAVELLER", "Unrelated User");
    const supportAgent = await createActivatedUser("SUPPORT", "Support Agent One");

    await loginViaUi(page, traveller.email, traveller.password);
    await page.goto("/contact");

    const subject = `Playwright Support Inquiry ${Date.now()}`;
    await page.getByPlaceholder("Your name").fill(traveller.displayName);
    await page.getByPlaceholder("you@example.com").fill(traveller.email);
    await page.getByPlaceholder("Brief summary of your inquiry").fill(subject);
    await page
      .getByPlaceholder("Share hub city, scheduled drop-off time, or question...")
      .fill("Testing end-to-end support ticket creation and agent reply visibility.");

    await page.getByRole("button", { name: "Submit Support Request" }).click();
    await expect(page.getByText("Support Ticket Submitted")).toBeVisible();

    await page.reload();
    await expect(page.getByText(subject)).toBeVisible();

    const myTicketsRes = await fetch(`${API_BASE}/support/tickets/me`, {
      headers: { authorization: `Bearer ${traveller.accessToken}` }
    });
    expect(myTicketsRes.status).toBe(200);
    const myTickets = ((await myTicketsRes.json()) as {
      data: { tickets: Array<{ id: string; subject: string }> };
    }).data.tickets;
    const createdTicket = myTickets.find((t) => t.subject === subject);
    expect(createdTicket).toBeDefined();

    const intruderRes = await fetch(`${API_BASE}/support/tickets/me/${createdTicket!.id}`, {
      headers: { authorization: `Bearer ${unrelatedUser.accessToken}` }
    });
    expect([403, 404]).toContain(intruderRes.status);

    const supportCtx = await browser.newContext();
    const supportPage = await supportCtx.newPage();
    try {
      await loginViaUi(supportPage, supportAgent.email, supportAgent.password);
      await supportPage.goto(`/admin/support/${createdTicket!.id}`);
      await expect(supportPage.getByText(subject)).toBeVisible();

      const assignRes = await fetch(`${API_BASE}/admin/support/tickets/${createdTicket!.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${supportAgent.accessToken}`
        },
        body: JSON.stringify({
          assignedToUserId: supportAgent.userId,
          status: "IN_PROGRESS"
        })
      });
      expect(assignRes.status).toBe(200);

      const agentReply = `Support team investigating ${Date.now()}`;
      await supportPage
        .getByPlaceholder(
          "Write clear troubleshooting guidance or resolution update for the requester..."
        )
        .fill(agentReply);
      await supportPage.getByRole("button", { name: "Send Public Reply" }).click();
      await expect(supportPage.getByText(agentReply)).toBeVisible();

      await page.reload();
      await page.getByText(subject).first().click();
      await expect(page.getByText(agentReply)).toBeVisible();
    } finally {
      await supportCtx.close();
    }
  });
});
