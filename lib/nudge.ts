// ───────────────────────────────────────────────────────────────────────────
// WhatsApp nudge sender. Sends the "goal_alignment_v3" template to a person so
// they fill out their weekly alignment update. Shared by Missing Updates and
// the People & Teams post-save reminder.
// ───────────────────────────────────────────────────────────────────────────

const WHATSAPP_PHONE_ID = "1139797872553332";
const WHATSAPP_TOKEN =
  "EAA66pZAqI130BRgV7FrZBIGpjpx3ScLZCdouf4u783MQ8Kkgr4AEOIaXaJHHZCwAhFhteVLnL3OwYITvv5kqZCYzgd6n840Jh08kERjvNXQuU1nq63oVeHxRdDINZBuUZCckpmjwGUByZB4HZBmzkY7Rjye8UFjgqElTC4LGij9ojhe6ac0WRKWjdqNaZCZCPL2w5MekvrBj7WzUjyGgdRrtJLFqZCKZBQ7RdDepPR4bj";

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
