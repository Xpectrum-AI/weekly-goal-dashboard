// ───────────────────────────────────────────────────────────────────────────
// WhatsApp nudge sender. Sends the "goal_alignment_v3" template to a person so
// they fill out their weekly alignment update. Shared by Missing Updates and
// the People & Teams post-save reminder.
// ───────────────────────────────────────────────────────────────────────────

const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID!;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;

/**
 * Notify a person on WhatsApp that a priority task was assigned to them.
 * Uses the "priority_assigned" template: name (assignee), name2 (assigner),
 * priority (the task text).
 */
export async function sendTaskAssigned(opts: {
  phone: string;
  assigneeName: string;
  assignerName: string;
  priority: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.phone.replace(/[^0-9+]/g, ""),
        type: "template",
        template: {
          name: "priority_assigned",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", parameter_name: "name", text: opts.assigneeName },
                { type: "text", parameter_name: "name2", text: opts.assignerName },
                { type: "text", parameter_name: "priority", text: opts.priority },
              ],
            },
          ],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to send task-assigned message:", e);
    return false;
  }
}

/** Send the weekly-alignment WhatsApp template to one person. Returns true on success. */
export async function sendNudge(name: string, phone: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/[^0-9+]/g, ""),
        type: "template",
        template: {
          name: "goal_alignment_v3",
          language: { code: "en" },
          components: [
            { type: "body", parameters: [{ type: "text", parameter_name: "name", text: name }] },
            { type: "button", sub_type: "flow", index: "0" },
          ],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to send nudge:", e);
    return false;
  }
}
