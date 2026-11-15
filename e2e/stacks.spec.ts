import { expect, test } from "@playwright/test";
import { ACCOUNTS, admin, deleteRequests, expectToast, reportIssue, signIn } from "./helpers";

test("Smart Sort stacks one issue's reports; Claim and Resolve act on all of them", async ({ browser }) => {
  const stamp = Date.now();
  const student = await signIn(browser, ACCOUNTS.student);
  const a = await reportIssue(student, `E2E stack A ${stamp}`);
  const b = await reportIssue(student, `E2E stack B ${stamp}`);
  const priv = await reportIssue(student, `E2E stack private ${stamp}`, { private: true });
  const sb = admin();
  const groupTitle = `E2E stacked issue ${stamp}`;
  try {
    // Merge b into a's group, as the AI would for a duplicate.
    const { data: ra } = await sb.from("requests").select("group_id").eq("id", a).single();
    const { data: rb } = await sb.from("requests").select("group_id").eq("id", b).single();
    await sb.from("requests").update({ group_id: ra!.group_id }).eq("id", b);
    await sb.from("issue_groups").delete().eq("id", rb!.group_id);
    await sb.from("issue_groups").update({ title: groupTitle }).eq("id", ra!.group_id);
    await sb.from("users").update({ smart_sort: true }).eq("email", ACCOUNTS.tech);

    const tech = await signIn(browser, ACCOUNTS.tech);
    await tech.goto("/tech?tab=unassigned&building=" + (await sb.from("requests").select("building_id").eq("id", a).single()).data!.building_id);
    const stack = tech.getByRole("article", { name: groupTitle });
    await expect(stack.getByText("2 reports")).toBeVisible();
    // The private report stays its own card
    await expect(tech.getByRole("article").filter({ hasText: `E2E stack private ${stamp}` })).toBeVisible();

    // Expand: each report with its room and description
    await stack.getByRole("button", { name: new RegExp(groupTitle) }).click();
    const list = stack.getByRole("list", { name: `Reports in ${groupTitle}` });
    await expect(list.getByText(`E2E stack A ${stamp}`)).toBeVisible();
    await expect(list.getByText(`E2E stack B ${stamp}`)).toBeVisible();
    await expect(list.getByText(/Room 1447/).first()).toBeVisible();

    await stack.getByRole("button", { name: "Claim all 2" }).click();
    await expectToast(tech, "Claimed 2 reports.");

    await tech.goto("/tech?tab=mine");
    const mine = tech.getByRole("article", { name: groupTitle });
    await mine.getByRole("button", { name: "Start work on 2" }).click();
    await expectToast(tech, "Started 2 reports.");
    await mine.getByRole("button", { name: "Resolve all 2" }).click();
    await tech.getByLabel("What did you fix?").fill("Fixed the shared problem.");
    await tech.getByRole("button", { name: "Mark all 2 resolved" }).click();
    await expectToast(tech, "Resolved 2 reports.");

    // Each report has its own history and shows as resolved to the student
    for (const id of [a, b]) {
      const { data: ev } = await sb.from("request_events").select("to_status").eq("request_id", id).order("created_at");
      expect(ev!.map((e) => e.to_status)).toEqual(["submitted", "assigned", "in_progress", "resolved"]);
    }
    await student.goto("/my-requests?filter=resolved");
    for (const t of [`E2E stack A ${stamp}`, `E2E stack B ${stamp}`]) {
      await expect(student.getByRole("article").filter({ hasText: t }).getByText("Resolved").first()).toBeVisible();
    }
  } finally {
    await sb.from("users").update({ smart_sort: false }).eq("email", ACCOUNTS.tech);
    await deleteRequests([a, b, priv]);
  }
});
