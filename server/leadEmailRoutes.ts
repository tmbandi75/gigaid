import { Router, Request, Response } from "express";
import { db } from "./db";
import { leadEmails, leads, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { getUncachableSendGridClient } from "./sendgrid";
import { randomUUID } from "crypto";

const router = Router();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const defaultUserId = "demo-user";

function buildEmailSignature(user: typeof users.$inferSelect): { text: string; html: string } {
  const signatureText = user.emailSignatureText || "";
  const businessName = user.businessName || user.name || "";
  const phone = user.phone || "";
  const email = user.email || "";
  
  let textSignature = "\n\n---\n";
  if (signatureText) {
    textSignature += signatureText + "\n";
  } else {
    textSignature += businessName + "\n";
    if (phone) textSignature += phone + "\n";
    if (email) textSignature += email + "\n";
  }
  
  let htmlSignature = '<br><br><hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">';
  
  if (user.emailSignatureIncludeLogo && user.emailSignatureLogoUrl) {
    const safeLogoUrl = escapeHtml(user.emailSignatureLogoUrl);
    const safeBusinessName = escapeHtml(businessName);
    htmlSignature += `<img src="${safeLogoUrl}" alt="${safeBusinessName}" style="max-width: 150px; max-height: 60px; margin-bottom: 10px;"><br>`;
  }
  
  if (signatureText) {
    htmlSignature += `<p style="color: #666; font-size: 14px; margin: 0; white-space: pre-line;">${escapeHtml(signatureText)}</p>`;
  } else {
    htmlSignature += `<p style="color: #666; font-size: 14px; margin: 0;">`;
    htmlSignature += `<strong>${escapeHtml(businessName)}</strong><br>`;
    if (phone) htmlSignature += `${escapeHtml(phone)}<br>`;
    if (email) htmlSignature += `${escapeHtml(email)}`;
    htmlSignature += `</p>`;
  }
  
  return { text: textSignature, html: htmlSignature };
}

router.get("/leads/:leadId/emails", async (req: Request, res: Response) => {
  try {
    const userId = defaultUserId;
    
    const { leadId } = req.params;
    
    const lead = await db.select().from(leads).where(
      and(eq(leads.id, leadId), eq(leads.userId, userId))
    ).limit(1);
    
    if (lead.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    const emails = await db.select()
      .from(leadEmails)
      .where(eq(leadEmails.leadId, leadId))
      .orderBy(desc(leadEmails.createdAt));
    
    res.json(emails);
  } catch (error) {
    console.error("Error fetching lead emails:", error);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

router.post("/leads/:leadId/emails", async (req: Request, res: Response) => {
  try {
    const userId = defaultUserId;
    
    const { leadId } = req.params;
    const { subject, body, includeSignature = true } = req.body;
    
    if (!subject || !body) {
      return res.status(400).json({ error: "Subject and body are required" });
    }
    
    const [lead] = await db.select().from(leads).where(
      and(eq(leads.id, leadId), eq(leads.userId, userId))
    ).limit(1);
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    if (!lead.clientEmail) {
      return res.status(400).json({ error: "Lead does not have an email address" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const trackingId = randomUUID();
    
    let finalBodyText = body;
    let finalBodyHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`;
    
    if (includeSignature) {
      const signature = buildEmailSignature(user);
      finalBodyText += signature.text;
      finalBodyHtml += signature.html;
    }
    
    // Use subdomain for reply-to so replies route through SendGrid Inbound Parse
    const replyToEmail = `lead-${leadId}@replies.gigaid.ai`;
    
    const msg = {
      to: lead.clientEmail,
      from: {
        email: fromEmail,
        name: user.businessName || user.name || "GigAid"
      },
      replyTo: {
        email: replyToEmail,
        name: user.businessName || user.name || "GigAid"
      },
      subject: subject,
      text: finalBodyText,
      html: finalBodyHtml,
      customArgs: {
        trackingId: trackingId,
        leadId: leadId,
        userId: userId
      },
      headers: {
        "X-GigAid-Tracking-Id": trackingId,
        "X-GigAid-Lead-Id": leadId
      }
    };
    
    const [response] = await client.send(msg);
    const messageId = response?.headers?.["x-message-id"] || null;
    
    const now = new Date().toISOString();
    const [newEmail] = await db.insert(leadEmails).values({
      leadId: leadId,
      userId: userId,
      direction: "outbound",
      fromEmail: fromEmail,
      toEmail: lead.clientEmail,
      subject: subject,
      bodyText: finalBodyText,
      bodyHtml: finalBodyHtml,
      trackingId: trackingId,
      sendgridMessageId: messageId,
      sentAt: now,
      createdAt: now
    }).returning();
    
    await db.update(leads)
      .set({ 
        lastContactedAt: now,
        status: lead.status === "new" ? "response_sent" : lead.status
      })
      .where(eq(leads.id, leadId));
    
    res.json({ 
      success: true, 
      email: newEmail,
      message: `Email sent to ${lead.clientEmail}`
    });
  } catch (error) {
    console.error("Error sending email to lead:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

router.get("/user/email-signature", async (req: Request, res: Response) => {
  try {
    const userId = defaultUserId;
    
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      emailSignatureText: user.emailSignatureText || "",
      emailSignatureLogoUrl: user.emailSignatureLogoUrl || "",
      emailSignatureIncludeLogo: user.emailSignatureIncludeLogo ?? true
    });
  } catch (error) {
    console.error("Error fetching email signature:", error);
    res.status(500).json({ error: "Failed to fetch email signature" });
  }
});

router.put("/user/email-signature", async (req: Request, res: Response) => {
  try {
    const userId = defaultUserId;
    
    const { emailSignatureText, emailSignatureLogoUrl, emailSignatureIncludeLogo } = req.body;
    
    await db.update(users)
      .set({
        emailSignatureText: emailSignatureText || null,
        emailSignatureLogoUrl: emailSignatureLogoUrl || null,
        emailSignatureIncludeLogo: emailSignatureIncludeLogo ?? true
      })
      .where(eq(users.id, userId));
    
    res.json({ success: true, message: "Email signature updated" });
  } catch (error) {
    console.error("Error updating email signature:", error);
    res.status(500).json({ error: "Failed to update email signature" });
  }
});

router.post("/webhooks/sendgrid/inbound", async (req: Request, res: Response) => {
  try {
    const { from, to, subject, text, html, headers } = req.body;
    
    console.log("Received inbound email:", { from, to, subject });
    
    let trackingId: string | null = null;
    let leadId: string | null = null;
    
    // Extract lead ID from the "to" address (e.g., lead-{uuid}@replies.gigaid.ai)
    if (to) {
      const toMatch = to.match(/lead-([a-f0-9-]+)@replies\.gigaid\.ai/i);
      if (toMatch) {
        leadId = toMatch[1];
        console.log("Extracted leadId from to address:", leadId);
      }
    }
    
    if (headers) {
      const headerLines = headers.split("\n");
      for (const line of headerLines) {
        if (line.toLowerCase().startsWith("x-gigaid-tracking-id:")) {
          trackingId = line.split(":")[1]?.trim();
        }
        if (line.toLowerCase().startsWith("x-gigaid-lead-id:")) {
          leadId = leadId || line.split(":")[1]?.trim();
        }
        if (line.toLowerCase().startsWith("in-reply-to:")) {
          const inReplyTo = line.split(":")[1]?.trim();
          if (inReplyTo) {
            const match = inReplyTo.match(/<([^>]+)>/);
            if (match) {
              trackingId = match[1];
            }
          }
        }
      }
    }
    
    if (!leadId && trackingId) {
      const [originalEmail] = await db.select()
        .from(leadEmails)
        .where(eq(leadEmails.trackingId, trackingId))
        .limit(1);
      
      if (originalEmail) {
        leadId = originalEmail.leadId;
      }
    }
    
    if (!leadId) {
      const fromEmail = from?.match(/<([^>]+)>/)?.[1] || from;
      const [matchingLead] = await db.select()
        .from(leads)
        .where(eq(leads.clientEmail, fromEmail))
        .limit(1);
      
      if (matchingLead) {
        leadId = matchingLead.id;
      }
    }
    
    if (leadId) {
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      
      if (lead) {
        const fromEmail = from?.match(/<([^>]+)>/)?.[1] || from;
        const toEmail = to?.match(/<([^>]+)>/)?.[1] || to;
        const now = new Date().toISOString();
        
        await db.insert(leadEmails).values({
          leadId: leadId,
          userId: lead.userId,
          direction: "inbound",
          fromEmail: fromEmail,
          toEmail: toEmail,
          subject: subject || "(No subject)",
          bodyText: text || "",
          bodyHtml: html || null,
          inReplyToTrackingId: trackingId || null,
          receivedAt: now,
          createdAt: now
        });
        
        await db.update(leads)
          .set({ 
            followUpStatus: "replied",
            lastContactedAt: now
          })
          .where(eq(leads.id, leadId));
        
        console.log(`Inbound email saved for lead ${leadId}`);
      }
    } else {
      console.log("Could not match inbound email to a lead");
    }
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing inbound email:", error);
    res.status(200).send("OK");
  }
});

export default router;
